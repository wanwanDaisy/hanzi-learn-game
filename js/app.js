import { CHARACTERS, GROUPS, getCharacter, charactersByGroup } from "./data.js?v=20260819o";
import { StrokeBoard } from "./stroke.js?v=20260819o";
import {
  speakSyllableParts,
  getRecognition,
  scorePart,
  getSpeechSupportInfo,
  isWeChat,
  splitPinyin,
  getStepGuide,
  displayFinal,
  stopDemoAudio,
} from "./pronounce.js?v=20260819o";

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

const ICON_EAR = `<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 2a6 6 0 0 0-6 6v4.5c0 1.3.8 2.4 1.9 2.9l1.1.5V18a3 3 0 0 0 3 3h1a1 1 0 1 0 0-2h-1a1 1 0 0 1-1-1v-1.4l1.6-.7A4.5 4.5 0 0 0 15 12.5V8a3 3 0 0 1 6 0v1.2a1 1 0 1 0 2 0V8A5 5 0 0 0 13 2zm-2.2 8.8a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"/></svg>`;
const ICON_MOUTH = `<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 4c-4.2 0-7.5 2.1-8.7 5.2-.3.8.3 1.6 1.1 1.6h15.2c.8 0 1.4-.8 1.1-1.6C19.5 6.1 16.2 4 12 4zm-6.2 9.2c-.7 0-1.2.7-.9 1.3C6.3 17.3 8.9 20 12 20s5.7-2.7 7.1-5.5c.3-.6-.2-1.3-.9-1.3H5.8zM9.2 14.5h5.6c.4 0 .7.4.5.8-.5 1.1-1.7 2.2-3.3 2.2s-2.8-1.1-3.3-2.2c-.2-.4.1-.8.5-.8z"/></svg>`;

function setListenBtnIdle(btn) {
  if (!btn) return;
  btn.innerHTML = `${ICON_EAR}<span>听一听</span>`;
}

function setSpeakBtnIdle(btn) {
  if (!btn) return;
  btn.innerHTML = `${ICON_MOUTH}<span>我来读</span>`;
}

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

  const item = state.currentId ? getCharacter(state.currentId) : null;
  const ini = parts?.initial || "";
  const fin = parts?.finalPlain || "";

  $$(".syl-part").forEach((el) => {
    const p = el.dataset.part;
    el.hidden = p === "initial" && !parts?.hasInitial;
    el.classList.toggle("active", p === step);
    el.classList.toggle("passed", Boolean(state.soundPassed[p]));
  });

  const initialPart = document.querySelector('.syl-part[data-part="initial"]');
  const plusAfterInitial = initialPart?.nextElementSibling;
  if (plusAfterInitial?.classList.contains("syl-plus")) {
    plusAfterInitial.hidden = !parts?.hasInitial;
  }

  const labels = {
    initial: ini ? `读声母 ${ini}` : "读声母",
    final: fin ? `读韵母 ${fin}` : "读韵母",
    full: `拼一拼，读「${item?.char || ""}」`,
  };
  const prompt = $("#pronounce-prompt");
  if (prompt) prompt.textContent = labels[step] || "先听一听，再跟着读";

  const guideBox = $("#step-guide");
  const guideTitle = $("#guide-title");
  const guideBody = $("#guide-body");
  if (guideBox && guideTitle && guideBody) {
    const guide = getStepGuide(step, parts, item?.char);
    if (guide) {
      guideBox.hidden = false;
      guideBox.dataset.kind = guide.kind;
      guideTitle.textContent = guide.title;
      guideBody.textContent = guide.body;
    } else {
      guideBox.hidden = true;
      guideTitle.textContent = "";
      guideBody.textContent = "";
    }
  }
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
  $("#syl-final").textContent = displayFinal(state.soundParts.finalPlain) || "—";
  $("#syl-full").textContent = item.pinyin;
  $("#pronounce-feedback").hidden = true;
  $("#pronounce-meter").hidden = true;
  $("#meter-fill").style.width = "0%";
  $("#btn-speak").classList.remove("listening");
  setSpeakBtnIdle($("#btn-speak"));
  $("#btn-skip-speak").hidden = false;
  $("#btn-finish").hidden = true;

  const support = getSpeechSupportInfo();
  $("#mic-note").textContent = support.browserTip;
  $("#block-pronounce").dataset.mode = support.recognition ? "mic" : "listen-only";

  $("#btn-speak").hidden = !support.recognition;
  const skip = $("#btn-skip-speak");
  skip.className = support.recognition ? "btn ghost" : "btn primary";
  if (support.wechat) {
    skip.textContent = "先写字（可稍后再读）";
  } else {
    skip.textContent = support.recognition ? "会读了，去写字" : "听完了，去写字";
  }

  // Chrome：默认展示三步，并自动播一遍组合示范更易发现功能
  const tip = $("#mic-note");
  if (support.recognition && tip) {
    tip.textContent =
      "先点「听一听」，跟着读声母、韵母，再拼成整字哦。需要麦克风权限。";
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

async function onListenAll() {
  const item = getCharacter(state.currentId);
  const btn = $("#btn-listen-all");
  const feedback = $("#pronounce-feedback");
  btn.disabled = true;
  btn.textContent = "正在读给你听…";
  const prompt = $("#pronounce-prompt");
  const ok = await speakSyllableParts(item.char, item.pinyin, (step) => {
    if (step.phase === "preview") {
      if (prompt) prompt.textContent = `先听整字「${item.char}」怎么读`;
      const g = $("#step-guide");
      if (g) g.hidden = true;
      $$(".syl-part").forEach((el) => el.classList.toggle("active", el.dataset.part === "full"));
      return;
    }
    setSoundStep(step.key);
  });
  btn.disabled = false;
  setListenBtnIdle(btn);
  if (!ok) {
    feedback.hidden = false;
    feedback.className = "feedback bad";
    feedback.textContent = "组合示范失败，请确认未静音后重试。";
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
    setSpeakBtnIdle(btn);
    return;
  }

  state.recognizing = true;
  btn.classList.add("listening");
  btn.textContent = "正在听你读…";
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
    setSpeakBtnIdle(btn);
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
    setSpeakBtnIdle(btn);
  };

  try {
    recognition.start();
  } catch {
    state.recognizing = false;
    btn.classList.remove("listening");
    setSpeakBtnIdle(btn);
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
    feedback.textContent = state.soundStep === "full" ? "拼对啦！真棒！" : "读得真好！继续下一步～";
    setSoundStep(state.soundStep);
    setTimeout(() => advanceSoundStepOrUnlock(), 650);
  } else {
    feedback.className = "feedback bad";
    feedback.textContent = "再听一听，慢慢读，你可以的！";
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

  $("#btn-listen-all").addEventListener("click", onListenAll);
  $("#btn-speak").addEventListener("click", onSpeak);
  $("#btn-skip-speak").addEventListener("click", () => unlockStroke());
  $("#btn-finish").addEventListener("click", () => openDone());
  $("#btn-next-char").addEventListener("click", nextCharacter);

  $("#syllable-split")?.addEventListener("click", (e) => {
    const part = e.target.closest(".syl-part");
    if (!part || part.hidden) return;
    setSoundStep(part.dataset.part);
  });

  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
  }

  const banner = $("#env-banner");
  if (banner && isWeChat()) {
    banner.hidden = false;
    banner.textContent =
      "正在微信中打开：朗读校准不可用。请点右上角 ··· → 在浏览器打开（推荐 Chrome）；也可先写笔画。";
  }

  showScreen("home");
}

init();
