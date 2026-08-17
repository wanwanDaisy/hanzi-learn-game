import { CHARACTERS, GROUPS, BOOK_SOURCE, getCharacter, charactersByGroup } from "./data.js";
import { StrokeBoard } from "./stroke.js";
import {
  speakCharacter,
  getRecognition,
  scorePronunciation,
  getSpeechSupportInfo,
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

function openPractice() {
  const item = getCharacter(state.currentId);
  state.pronounceDone = false;
  state.strokeReady = false;
  state.recognizing = false;

  $("#practice-char-label").textContent = item.char;
  $("#pronounce-char").textContent = item.char;
  $("#pronounce-pinyin").textContent = item.pinyin;
  $("#pronounce-meaning").textContent = item.meaning;
  $("#pronounce-feedback").hidden = true;
  $("#pronounce-meter").hidden = true;
  $("#meter-fill").style.width = "0%";
  $("#btn-speak").classList.remove("listening");
  $("#btn-speak").textContent = "🎤 开始朗读";
  $("#btn-skip-speak").hidden = false;
  $("#btn-finish").hidden = true;

  const support = getSpeechSupportInfo();
  $("#mic-note").textContent = support.browserTip;
  $("#block-pronounce").dataset.mode = support.recognition ? "mic" : "listen-only";

  // 无语音识别时：隐藏朗读按钮，把「已会读」提升为主按钮
  $("#btn-speak").hidden = !support.recognition;
  const skip = $("#btn-skip-speak");
  skip.className = support.recognition ? "btn ghost" : "btn primary";
  skip.textContent = support.recognition ? "已会读，开始写字" : "听完了，开始写字";

  const prompt = $("#block-pronounce .prompt");
  if (prompt) {
    prompt.textContent = support.recognition
      ? "先听标准读音，再朗读校准"
      : "先听标准读音，跟读练习后继续写字";
  }

  if (!support.tts) {
    $("#pronounce-feedback").hidden = false;
    $("#pronounce-feedback").className = "feedback bad";
    $("#pronounce-feedback").textContent = "当前浏览器不支持播报读音，可直接点下方按钮进入写字。";
  }

  setStrokeLocked(true);
  showScreen("practice");
}

async function onListen() {
  const item = getCharacter(state.currentId);
  const btn = $("#btn-listen");
  const feedback = $("#pronounce-feedback");
  btn.disabled = true;
  btn.textContent = "朗读中…";
  const ok = await speakCharacter(item.char, item.pinyin);
  btn.disabled = false;
  btn.textContent = "▶ 听标准音";
  if (!ok) {
    feedback.hidden = false;
    feedback.className = "feedback bad";
    feedback.textContent = "播报失败。请确认设备未静音；也可直接点下方按钮继续写字。";
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
    btn.textContent = "🎤 开始朗读";
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
    const result = scorePronunciation(alts, item.char, item.pinyin);
    showPronounceResult(result);
  };
  recognition.onerror = (event) => {
    state.recognizing = false;
    btn.classList.remove("listening");
    btn.textContent = "🎤 开始朗读";
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
    btn.textContent = "🎤 开始朗读";
  };

  try {
    recognition.start();
  } catch {
    state.recognizing = false;
    btn.classList.remove("listening");
    btn.textContent = "🎤 开始朗读";
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
    feedback.className = "feedback ok";
    feedback.textContent = "读音通过！下面开始写笔画。";
    $("#btn-skip-speak").hidden = true;
    unlockStroke();
  } else {
    feedback.className = "feedback bad";
    feedback.textContent = "再听一遍标准音，尽量读准声调。";
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
  $("#btn-speak").addEventListener("click", onSpeak);
  $("#btn-skip-speak").addEventListener("click", () => unlockStroke());
  $("#btn-finish").addEventListener("click", () => openDone());
  $("#btn-next-char").addEventListener("click", nextCharacter);

  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
  }

  const homeCredit = $("#home-credit");
  if (homeCredit) homeCredit.textContent = BOOK_SOURCE.credit;

  showScreen("home");
}

init();
