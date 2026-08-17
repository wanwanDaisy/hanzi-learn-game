import { CHARACTERS, GROUPS, BOOK_SOURCE, getCharacter, charactersByGroup } from "./data.js";
import { StrokeBoard } from "./stroke.js";
import {
  speakText,
  speakSyllableParts,
  getRecognition,
  scorePart,
  getSpeechSupportInfo,
  isWeChat,
  splitPinyin,
  SPEECH_RATE,
} from "./pronounce.js";

const STORAGE_KEY = "zijijing-progress-v2";

const state = {
  screen: "home",
  currentId: null,
  group: "all",
  completed: loadProgress(),
  recognizing: false,
  pronounceDone: false,
  strokeReady: false,
  soundStep: "initial",
  soundParts: null,
  soundPassed: { initial: false, final: false, full: false },
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.completed));
}

function showScreen(name) {
  state.screen = name;
  $$(".screen").forEach((el) => {
    el.classList.toggle("active", el.dataset.screen === name);
  });
}

function markDone(id) {
  if (!state.completed.includes(id)) {
    state.completed.push(id);
    saveProgress();
  }
}

/* ---------- Select ---------- */
function renderSelect() {
  const tabs = $("#group-tabs");
  tabs.innerHTML = GROUPS.map(
    (g) =>
      `<button type="button" class="group-tab${state.group === g.id ? " active" : ""}" data-group="${g.id}">${g.name}</button>`
  ).join("");
  tabs.querySelectorAll(".group-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.group = btn.dataset.group;
      renderSelect();
    });
  });

  const list = charactersByGroup(state.group);
  const doneCount = list.filter((c) => state.completed.includes(c.id)).length;
  $("#select-meta").textContent = `楷书字库 · ${list.length} 字 · 已通关 ${doneCount}`;
  const credit = $("#select-credit");
  if (credit) credit.textContent = BOOK_SOURCE.credit;

  const grid = $("#char-grid");
  grid.innerHTML = list
    .map((c) => {
      const done = state.completed.includes(c.id) ? " done" : "";
      return `
      <button type="button" class="char-card${done}" data-id="${c.id}">
        <span class="glyph">${c.char}</span>
        <span class="py">${c.pinyin}</span>
        <span class="mean">${c.meaning}</span>
      </button>`;
    })
    .join("");

  grid.querySelectorAll(".char-card").forEach((btn) => {
    btn.addEventListener("click", () => startCharacter(btn.dataset.id));
  });
}

function startCharacter(id) {
  state.currentId = id;
  openPractice();
}

/* ---------- Combined practice ---------- */
let board;

function ensureBoard() {
  if (board) return board;
  const target = $("#stroke-target");
  board = new StrokeBoard(target, {
    onProgress(cur, total, strokeName) {
      $("#stroke-count").textContent =
        cur < total
          ? `第 ${cur + 1}/${total} 笔${strokeName ? ` · ${strokeName}` : ""}`
          : `笔画 ${total}/${total} · 完成`;
    },
    onStrokeComplete(ok, _score, isDemo) {
      const feedback = $("#stroke-feedback");
      feedback.hidden = false;
      if (ok) {
        feedback.className = "feedback ok";
        feedback.textContent = isDemo
          ? "笔顺演示完成。可以点「重写」再练，或点完成。"
          : "描红完成！笔顺正确。";
        $("#btn-finish").hidden = false;
      } else {
        feedback.className = "feedback bad";
        feedback.textContent = "这一笔不太对，顺着灰色字模再写一次。";
        setTimeout(() => {
          if (feedback.textContent.includes("不太对")) feedback.hidden = true;
        }, 1200);
      }
    },
    onError(err) {
      const feedback = $("#stroke-feedback");
      feedback.hidden = false;
      feedback.className = "feedback bad";
      feedback.textContent = err?.message || "笔画字模加载失败，请刷新重试";
    },
  });
  return board;
}

function setStrokeLocked(locked) {
  const block = $("#block-stroke");
  block.dataset.locked = locked ? "true" : "false";
  $("#stroke-lock-hint").hidden = !locked;
  $("#stroke-panel").hidden = locked;
}

function unlockStroke() {
  if (state.strokeReady) {
    $("#block-stroke").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  state.pronounceDone = true;
  state.strokeReady = true;
  setStrokeLocked(false);

  const item = getCharacter(state.currentId);
  const names = item.strokeNames || [];
  $("#stroke-prompt").textContent = names.length
    ? `「${item.char}」· 绿虚线为当前笔引导（${names.join("、")}）`
    : `「${item.char}」· 从红点起笔，顺着绿虚线描`;
  $("#stroke-feedback").hidden = true;
  $("#btn-finish").hidden = true;

  ensureBoard().setCharacter({
    char: item.char,
    strokeNames: names,
  });

  requestAnimationFrame(() => {
    $("#block-stroke").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function soundStepOrder(parts) {
  const steps = [];
  if (parts?.hasInitial) steps.push("initial");
  steps.push("final", "full");
  return steps;
}

function setSoundStep(step) {
  const parts = state.soundParts;
  const order = soundStepOrder(parts);
  if (!order.includes(step)) step = order[0];
  state.soundStep = step;

  $$(".sound-step").forEach((btn) => {
    const s = btn.dataset.step;
    btn.hidden = s === "initial" && !parts?.hasInitial;
    btn.classList.toggle("active", s === step);
    btn.classList.toggle("passed", Boolean(state.soundPassed[s]));
  });

  $$(".syl-part").forEach((el) => {
    const p = el.dataset.part;
    el.classList.toggle("active", p === step);
    el.classList.toggle("passed", Boolean(state.soundPassed[p]));
  });

  const labels = {
    initial: `先听声母「${parts?.initial || ""}」，再朗读`,
    final: `再听韵母「${parts?.final || ""}」，再朗读`,
    full: `最后听整字组合「${parts ? getCharacter(state.currentId).pinyin : ""}」，再朗读`,
  };
  const prompt = $("#pronounce-prompt");
  if (prompt) prompt.textContent = labels[step] || "听标准音后朗读校准";
}

function advanceSoundStepOrUnlock() {
  const order = soundStepOrder(state.soundParts);
  const allPassed = order.every((s) => state.soundPassed[s]);
  if (allPassed) {
    $("#btn-skip-speak").hidden = true;
    unlockStroke();
    return;
  }
  const idx = order.indexOf(state.soundStep);
  const next = order.slice(idx + 1).find((s) => !state.soundPassed[s]) || order.find((s) => !state.soundPassed[s]);
  if (next) setSoundStep(next);
}

function openPractice() {
  const item = getCharacter(state.currentId);
  state.pronounceDone = false;
  state.strokeReady = false;
  state.recognizing = false;
  state.soundParts = splitPinyin(item.pinyin);
  state.soundPassed = { initial: !state.soundParts.hasInitial, final: false, full: false };

  $("#practice-char-label").textContent = item.char;
  $("#pronounce-char").textContent = item.char;
  $("#pronounce-pinyin").textContent = item.pinyin;
  $("#pronounce-meaning").textContent = item.meaning;
  $("#syl-initial").textContent = state.soundParts.hasInitial ? state.soundParts.initial : "（无）";
  $("#syl-final").textContent = state.soundParts.final || "—";
  $("#syl-full").textContent = item.pinyin;
  $("#pronounce-feedback").hidden = true;
  $("#pronounce-meter").hidden = true;
  $("#meter-fill").style.width = "0%";
  $("#btn-speak").classList.remove("listening");
  $("#btn-speak").textContent = "🎤 读这一步";
  $("#btn-skip-speak").hidden = false;
  $("#btn-finish").hidden = true;
  $("#btn-listen").textContent = "▶ 听这一步";

  const support = getSpeechSupportInfo();
  $("#mic-note").textContent = support.browserTip;
  $("#block-pronounce").dataset.mode = support.recognition ? "mic" : "listen-only";

  $("#btn-speak").hidden = !support.recognition;
  const skip = $("#btn-skip-speak");
  skip.className = support.recognition ? "btn ghost" : "btn primary";
  if (support.wechat) {
    skip.textContent = "先写字（可稍后再读）";
  } else {
    skip.textContent = support.recognition ? "已会读，开始写字" : "听完了，开始写字";
  }

  if (!support.tts) {
    $("#pronounce-feedback").hidden = false;
    $("#pronounce-feedback").className = "feedback bad";
    $("#pronounce-feedback").textContent = "当前浏览器不支持播报读音，可直接点下方按钮进入写字。";
  }

  setSoundStep(state.soundParts.hasInitial ? "initial" : "final");
  setStrokeLocked(true);
  showScreen("practice");
}

function currentStepSpeakTarget(item) {
  const parts = state.soundParts;
  const step = state.soundStep;
  if (step === "initial") {
    return { text: parts.initialDemo || parts.initial, mode: "initial" };
  }
  if (step === "final") {
    return { text: parts.finalPlain || parts.final, mode: "final" };
  }
  return { text: item.char, mode: "full" };
}

async function onListen() {
  const item = getCharacter(state.currentId);
  const btn = $("#btn-listen");
  const feedback = $("#pronounce-feedback");
  btn.disabled = true;
  btn.textContent = "朗读中…";
  const target = currentStepSpeakTarget(item);
  const ok = await speakText(target.text, { rate: SPEECH_RATE });
  btn.disabled = false;
  btn.textContent = "▶ 听这一步";
  if (!ok) {
    feedback.hidden = false;
    feedback.className = "feedback bad";
    feedback.textContent = isWeChat()
      ? "微信内常无法播报。请看拼音跟读，或点下方按钮直接写字；完整读音请用浏览器打开。"
      : "播报失败。请确认设备未静音；也可直接点下方按钮继续写字。";
  }
}

async function onListenAll() {
  const item = getCharacter(state.currentId);
  const btn = $("#btn-listen-all");
  const feedback = $("#pronounce-feedback");
  btn.disabled = true;
  $("#btn-listen").disabled = true;
  btn.textContent = "示范中…";
  const ok = await speakSyllableParts(item.char, item.pinyin, (step) => {
    setSoundStep(step.key);
  });
  btn.disabled = false;
  $("#btn-listen").disabled = false;
  btn.textContent = "▶ 听组合示范";
  if (!ok) {
    feedback.hidden = false;
    feedback.className = "feedback bad";
    feedback.textContent = "组合示范失败，可改点「听这一步」。";
  }
}

function onSpeak() {
  const item = getCharacter(state.currentId);
  const rec = getRecognition();
  const btn = $("#btn-speak");
  const feedback = $("#pronounce-feedback");

  if (!rec) {
    feedback.hidden = false;
    feedback.className = "feedback bad";
    feedback.textContent = "无法使用语音识别，请改用「已会读，开始写字」。";
    return;
  }

  if (state.recognizing) {
    try {
      rec.abort?.();
    } catch {
      /* ignore */
    }
    state.recognizing = false;
    btn.classList.remove("listening");
    btn.textContent = "🎤 读这一步";
    return;
  }

  state.recognizing = true;
  btn.classList.add("listening");
  btn.textContent = "正在听… 再点可取消";
  feedback.hidden = true;

  const recognition = getRecognition();
  recognition.onresult = (event) => {
    const alts = [];
    for (let i = 0; i < event.results[0].length; i++) {
      alts.push(event.results[0][i]);
    }
    const result = scorePart(alts, {
      mode: state.soundStep,
      char: item.char,
      pinyin: item.pinyin,
      parts: state.soundParts,
    });
    showPronounceResult(result);
  };
  recognition.onerror = (event) => {
    state.recognizing = false;
    btn.classList.remove("listening");
    btn.textContent = "🎤 读这一步";
    feedback.hidden = false;
    feedback.className = "feedback bad";
    const err = event?.error || "";
    if (err === "not-allowed" || err === "service-not-allowed") {
      feedback.textContent = "未获得麦克风权限。请在浏览器设置中允许，或改用「已会读，开始写字」。";
    } else if (err === "network") {
      feedback.textContent = "语音识别需要联网。请检查网络，或改用「已会读，开始写字」。";
    } else {
      feedback.textContent = "没听清或当前浏览器识别不稳定。可再试，或点「已会读，开始写字」。";
    }
  };
  recognition.onend = () => {
    state.recognizing = false;
    btn.classList.remove("listening");
    btn.textContent = "🎤 读这一步";
  };

  try {
    recognition.start();
  } catch {
    state.recognizing = false;
    btn.classList.remove("listening");
    btn.textContent = "🎤 读这一步";
  }
}

function showPronounceResult(result) {
  const feedback = $("#pronounce-feedback");
  const meter = $("#pronounce-meter");
  meter.hidden = false;
  $("#meter-fill").style.width = `${result.score}%`;
  $("#meter-label").textContent = `匹配度 ${result.score}%${result.heard ? ` · 听到「${result.heard}」` : ""}`;

  feedback.hidden = false;
  if (result.pass) {
    state.soundPassed[state.soundStep] = true;
    feedback.className = "feedback ok";
    const names = { initial: "声母", final: "韵母", full: "整字" };
    feedback.textContent = `${names[state.soundStep] || "这一步"}通过！`;
    setSoundStep(state.soundStep);
    setTimeout(() => advanceSoundStepOrUnlock(), 650);
  } else {
    feedback.className = "feedback bad";
    feedback.textContent = "再听一遍，尽量读准；也可切换步骤练习。";
  }
}

function openDone() {
  const item = getCharacter(state.currentId);
  markDone(state.currentId);
  $("#done-char").textContent = item.char;
  $("#done-msg").textContent = `${item.pinyin} · ${item.meaning} · 读音与笔画已完成`;
  showScreen("done");
}

function nextCharacter() {
  const idx = CHARACTERS.findIndex((c) => c.id === state.currentId);
  const next = CHARACTERS[(idx + 1) % CHARACTERS.length];
  startCharacter(next.id);
}

/* ---------- Wire up ---------- */
function init() {
  $("#btn-start").addEventListener("click", () => {
    renderSelect();
    showScreen("select");
  });

  $$("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.goto;
      if (target === "select") renderSelect();
      showScreen(target);
    });
  });

  $("#practice-back").addEventListener("click", () => {
    renderSelect();
    showScreen("select");
  });

  $("#btn-stroke-undo").addEventListener("click", () => {
    if (state.strokeReady) ensureBoard().undo();
  });
  $("#btn-stroke-clear").addEventListener("click", () => {
    if (!state.strokeReady) return;
    ensureBoard().clear();
    $("#btn-finish").hidden = true;
    $("#stroke-feedback").hidden = true;
  });
  $("#btn-stroke-hint").addEventListener("click", () => {
    if (state.strokeReady) ensureBoard().playDemo();
  });

  $("#btn-listen").addEventListener("click", onListen);
  $("#btn-listen-all").addEventListener("click", onListenAll);
  $("#btn-speak").addEventListener("click", onSpeak);
  $("#btn-skip-speak").addEventListener("click", () => unlockStroke());
  $("#btn-finish").addEventListener("click", () => openDone());
  $("#btn-next-char").addEventListener("click", nextCharacter);

  $("#sound-steps")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".sound-step");
    if (!btn || btn.hidden) return;
    setSoundStep(btn.dataset.step);
  });

  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
  }

  const homeCredit = $("#home-credit");
  if (homeCredit) homeCredit.textContent = BOOK_SOURCE.credit;

  const banner = $("#env-banner");
  if (banner && isWeChat()) {
    banner.hidden = false;
    banner.textContent =
      "正在微信中打开：朗读校准不可用。请点右上角 ··· → 在浏览器打开（推荐 Chrome）；也可先写笔画。";
  }

  showScreen("home");
}

init();
