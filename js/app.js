import { CHARACTERS, getCharacter, XINHUA_LETTERS, pinyinLetter } from "./data.js?v=20260820f";
import { StrokeBoard } from "./stroke.js?v=20260820f";
import { getExamples } from "./examples.js?v=20260820f";
import {
  speakSyllableParts,
  speakText,
  isWeChat,
  splitPinyin,
  getStepGuide,
  displayFinal,
  stopDemoAudio,
} from "./pronounce.js?v=20260820f";

const STORAGE_KEY = "zijijing-progress-v2";

const state = {
  screen: "home",
  currentId: null,
  letter: null,
  completed: loadProgress(),
  pronounceDone: false,
  strokeReady: false,
  examplesReady: false,
  soundStep: "initial",
  soundParts: null,
  soundPassed: { initial: false, final: false, full: false },
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const ICON_EAR = `<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 2a6 6 0 0 0-6 6v4.5c0 1.3.8 2.4 1.9 2.9l1.1.5V18a3 3 0 0 0 3 3h1a1 1 0 1 0 0-2h-1a1 1 0 0 1-1-1v-1.4l1.6-.7A4.5 4.5 0 0 0 15 12.5V8a3 3 0 0 1 6 0v1.2a1 1 0 1 0 2 0V8A5 5 0 0 0 13 2zm-2.2 8.8a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"/></svg>`;

const ICON_HORN = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9v6h3.2L12 19V5L7.2 9H4zm12.2 3c0-1.7-1-3.2-2.4-3.9v7.8c1.4-.7 2.4-2.2 2.4-3.9zm-2.4-7.2v2.05A6.02 6.02 0 0 1 18.2 12a6.02 6.02 0 0 1-4.4 5.15v2.05A8.03 8.03 0 0 0 20.2 12a8.03 8.03 0 0 0-6.4-7.2z"/></svg>`;
const EXAMPLE_RATE = 0.5;

function setListenBtnIdle(btn) {
  if (!btn) return;
  btn.innerHTML = `${ICON_EAR}<span>听一听</span>`;
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
  if (name !== "practice") hideStrokePraise();
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
function charCardHtml(c) {
  const done = state.completed.includes(c.id) ? " done" : "";
  return `
      <button type="button" class="char-card${done}" data-id="${c.id}">
        <span class="glyph">${c.char}</span>
        <span class="py">${c.pinyin}</span>
        <span class="mean">${c.meaning}</span>
      </button>`;
}

function bindCharCards(grid) {
  grid.querySelectorAll(".char-card").forEach((btn) => {
    btn.addEventListener("click", () => startCharacter(btn.dataset.id));
  });
}

function charsByLetter(list) {
  const map = new Map();
  for (const c of list) {
    const L = pinyinLetter(c.pinyin);
    if (!L) continue;
    if (!map.has(L)) map.set(L, []);
    map.get(L).push(c);
  }
  return map;
}

function firstPresentLetter(byLetter) {
  for (const L of XINHUA_LETTERS) {
    if (byLetter.has(L)) return L;
  }
  return "A";
}

function setOpenLetter(letter) {
  state.letter = letter;
  renderSelect();
}

function renderLetterRail(byLetter) {
  const rail = $("#letter-rail");
  rail.innerHTML = XINHUA_LETTERS.map((L) => {
    const on = byLetter.has(L);
    const active = state.letter === L ? " active" : "";
    return `<button type="button" class="letter-tab${active}" data-letter="${L}" role="tab" aria-selected="${state.letter === L}" ${on ? "" : "disabled"}>${L}</button>`;
  }).join("");
  rail.querySelectorAll(".letter-tab:not(:disabled)").forEach((btn) => {
    btn.addEventListener("click", () => setOpenLetter(btn.dataset.letter));
  });
}

function renderSelect() {
  const list = CHARACTERS;
  const byLetter = charsByLetter(list);
  if (!state.letter || !byLetter.has(state.letter)) {
    state.letter = firstPresentLetter(byLetter);
  }
  const chars = byLetter.get(state.letter) || [];
  const doneCount = list.filter((c) => state.completed.includes(c.id)).length;
  $("#select-meta").textContent = `${state.letter} · ${chars.length} 字 · 字库共 ${list.length} · 已通关 ${doneCount}`;
  renderLetterRail(byLetter);

  const grid = $("#char-grid");
  grid.innerHTML = `<div class="letter-cards">${chars.map(charCardHtml).join("")}</div>`;
  bindCharCards(grid);
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
    onStrokeComplete(ok, score, isDemo) {
      const feedback = $("#stroke-feedback");
      if (ok && !isDemo) {
        showStrokePraise();
        $("#btn-to-examples").hidden = false;
        return;
      }
      hideStrokePraise();
      feedback.hidden = false;
      if (ok) {
        feedback.className = "feedback ok";
        feedback.textContent = "笔顺演示完成。可以点「重写」再练，或点完成。";
        $("#btn-to-examples").hidden = false;
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
  hideStrokePraise();
  $("#btn-to-examples").hidden = true;

  ensureBoard().setCharacter({
    char: item.char,
    strokeNames: names,
  });

  requestAnimationFrame(() => {
    $("#block-stroke").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setExamplesLocked(locked) {
  const block = $("#block-examples");
  if (!block) return;
  block.dataset.locked = locked ? "true" : "false";
  const hint = $("#examples-lock-hint");
  const panel = $("#examples-panel");
  if (hint) hint.hidden = !locked;
  if (panel) panel.hidden = locked;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function highlightExample(sentence, char) {
  const safeChar = escapeHtml(char);
  return escapeHtml(sentence).split(safeChar).join(`<em class="ex-hit">${safeChar}</em>`);
}

function renderExamples(item) {
  const list = $("#example-list");
  if (!list) return;
  const sentences = getExamples(item.char);
  list.innerHTML = sentences
    .map(
      (s, i) => `
    <li class="example-item">
      <p class="example-text">${highlightExample(s, item.char)}</p>
      <button type="button" class="ex-play" data-ex="${i}" aria-label="播放例句">${ICON_HORN}</button>
    </li>`
    )
    .join("");
  list.dataset.sentences = JSON.stringify(sentences);
}

let examplePlayGen = 0;

async function playExample(index) {
  const list = $("#example-list");
  const sentences = JSON.parse(list?.dataset.sentences || "[]");
  const text = sentences[index];
  if (!text) return;
  const gen = ++examplePlayGen;
  $$(".ex-play").forEach((b) => b.classList.remove("playing"));
  const btn = list.querySelector(`.ex-play[data-ex="${index}"]`);
  if (btn) btn.classList.add("playing");
  await speakText(text, { rate: EXAMPLE_RATE });
  if (gen === examplePlayGen && btn) btn.classList.remove("playing");
}

function unlockExamples() {
  if (state.examplesReady) {
    $("#block-examples")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const item = getCharacter(state.currentId);
  if (!item) return;
  hideStrokePraise();
  state.examplesReady = true;
  renderExamples(item);
  setExamplesLocked(false);
  $("#btn-finish").hidden = false;
  requestAnimationFrame(() => {
    $("#block-examples")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

let praiseTimer = null;

function hideStrokePraise() {
  if (praiseTimer) {
    clearTimeout(praiseTimer);
    praiseTimer = null;
  }
  const el = $("#stroke-praise");
  if (!el) return;
  el.hidden = true;
  el.classList.remove("show");
}

function showStrokePraise() {
  const el = $("#stroke-praise");
  if (!el) return;
  if (praiseTimer) {
    clearTimeout(praiseTimer);
    praiseTimer = null;
  }
  el.hidden = false;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  $("#stroke-feedback").hidden = true;
  praiseTimer = setTimeout(() => hideStrokePraise(), 1800);
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

function openPractice() {
  const item = getCharacter(state.currentId);
  state.pronounceDone = false;
  state.strokeReady = false;
  state.examplesReady = false;
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
  $("#btn-skip-speak").hidden = false;
  $("#btn-skip-speak").textContent = isWeChat() ? "先写字" : "听完了，去写字";
  $("#btn-finish").hidden = true;
  $("#btn-to-examples").hidden = true;
  hideStrokePraise();
  stopDemoAudio();

  if (!window.speechSynthesis) {
    $("#pronounce-feedback").hidden = false;
    $("#pronounce-feedback").className = "feedback bad";
    $("#pronounce-feedback").textContent = "当前浏览器不支持播报读音，可直接点下方按钮进入写字。";
  }

  setSoundStep(state.soundParts.hasInitial ? "initial" : "final");
  setStrokeLocked(true);
  setExamplesLocked(true);
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

function openDone() {
  const item = getCharacter(state.currentId);
  markDone(state.currentId);
  $("#done-char").textContent = item.char;
  $("#done-msg").textContent = `${item.pinyin} · ${item.meaning} · 读音、笔画与例句已完成`;
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
    if (!state.strokeReady) return;
    hideStrokePraise();
    $("#btn-to-examples").hidden = true;
    $("#stroke-feedback").hidden = true;
    ensureBoard().undo();
  });
  $("#btn-stroke-clear").addEventListener("click", () => {
    if (!state.strokeReady) return;
    ensureBoard().clear();
    $("#btn-to-examples").hidden = true;
    $("#stroke-feedback").hidden = true;
    hideStrokePraise();
  });
  $("#btn-stroke-hint").addEventListener("click", () => {
    if (!state.strokeReady) return;
    hideStrokePraise();
    ensureBoard().playDemo();
  });

  $("#btn-listen-all").addEventListener("click", onListenAll);
  $("#btn-skip-speak").addEventListener("click", () => unlockStroke());
  $("#stroke-praise")?.addEventListener("click", () => hideStrokePraise());
  $("#btn-to-examples").addEventListener("click", () => unlockExamples());
  $("#btn-finish").addEventListener("click", () => openDone());
  $("#example-list")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".ex-play");
    if (!btn || !state.examplesReady) return;
    playExample(Number(btn.dataset.ex));
  });
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
      "正在微信中打开：播报可能无声。请点右上角 ··· → 在浏览器打开；也可先去写字。";
  }

  showScreen("home");
}

init();
