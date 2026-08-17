/** 读音：标准朗读 + 声母/韵母/整字校准 */

/** 约为原语速的 0.5 倍（更慢、更清晰） */
export const SPEECH_RATE = 0.42;

function stripTone(pinyin) {
  return pinyin
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[āáǎà]/g, "a")
    .replace(/[ēéěè]/g, "e")
    .replace(/[īíǐì]/g, "i")
    .replace(/[ōóǒò]/g, "o")
    .replace(/[ūúǔù]/g, "u")
    .replace(/[ǖǘǚǜü]/g, "v")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** 教学用声母读法（便于 TTS 发声） */
const INITIAL_DEMO = {
  b: "bo",
  p: "po",
  m: "mo",
  f: "fo",
  d: "de",
  t: "te",
  n: "ne",
  l: "le",
  g: "ge",
  k: "ke",
  h: "he",
  j: "ji",
  q: "qi",
  x: "xi",
  zh: "zhi",
  ch: "chi",
  sh: "shi",
  r: "ri",
  z: "zi",
  c: "ci",
  s: "si",
  y: "yi",
  w: "wu",
};

const INITIALS = [
  "zh",
  "ch",
  "sh",
  "b",
  "p",
  "m",
  "f",
  "d",
  "t",
  "n",
  "l",
  "g",
  "k",
  "h",
  "j",
  "q",
  "x",
  "r",
  "z",
  "c",
  "s",
  "y",
  "w",
];

/**
 * 拆分带调拼音为声母 / 韵母
 */
export function splitPinyin(pinyin) {
  const raw = (pinyin || "").trim();
  const plain = stripTone(raw);
  let initial = "";
  let finalPlain = plain;

  for (const ini of INITIALS) {
    if (plain.startsWith(ini)) {
      initial = ini;
      finalPlain = plain.slice(ini.length) || plain;
      break;
    }
  }

  let final = raw;
  if (initial) {
    const re = new RegExp(`^${initial}`, "i");
    final = raw.replace(re, "") || raw;
  }

  if (!finalPlain) {
    finalPlain = plain;
    final = raw;
  }

  return {
    initial,
    final,
    initialPlain: initial,
    finalPlain,
    initialDemo: initial ? INITIAL_DEMO[initial] || initial : "",
    hasInitial: Boolean(initial),
  };
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  const dist = levenshtein(a, b);
  const lev = 1 - dist / Math.max(a.length, b.length);
  return Math.max(lev, (matches / longer.length) * 0.7);
}

function levenshtein(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[a.length][b.length];
}

function isLikelySafari() {
  const ua = navigator.userAgent || "";
  return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox|MicroMessenger/i.test(ua);
}

function isLikelyFirefox() {
  return /Firefox/i.test(navigator.userAgent || "");
}

export function isWeChat() {
  return /MicroMessenger/i.test(navigator.userAgent || "");
}

export function canUseSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return false;
  if (isWeChat()) return false;
  if (isLikelySafari()) return false;
  if (isLikelyFirefox()) return false;
  return true;
}

export function getSpeechSupportInfo() {
  const recognition = canUseSpeechRecognition();
  const tts = Boolean(window.speechSynthesis);
  const wechat = isWeChat();
  let browserTip = "";
  if (wechat) {
    browserTip =
      "微信内置浏览器不支持朗读校准，播报也可能无声。请点右上角「···」→「在浏览器打开」（建议 Chrome）；或直接点下方按钮继续写字。";
  } else if (!recognition) {
    if (isLikelySafari()) {
      browserTip =
        "当前是 Safari，不支持朗读校准。可先听声母/韵母/整字，再点「已会读，开始写字」，或改用 Chrome。";
    } else if (isLikelyFirefox()) {
      browserTip =
        "当前是 Firefox，不支持朗读校准。可先听声母/韵母/整字，再点「已会读，开始写字」，或改用 Chrome。";
    } else {
      browserTip =
        "当前浏览器不支持朗读校准。可先听声母/韵母/整字，再点「已会读，开始写字」，或改用 Chrome / Edge。";
    }
  } else {
    browserTip = "按步骤听：声母 → 韵母 → 整字；听完后朗读校准。需允许麦克风权限。";
  }
  return { recognition, tts, wechat, browserTip };
}

function pickChineseVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return (
    voices.find((v) => /zh[-_]?CN/i.test(v.lang)) ||
    voices.find((v) => /Chinese|中文|普通话|国语/i.test(v.lang + v.name)) ||
    null
  );
}

function waitForVoices() {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve([]);
      return;
    }
    const ready = window.speechSynthesis.getVoices();
    if (ready.length) {
      resolve(ready);
      return;
    }
    const done = () => {
      window.speechSynthesis.onvoiceschanged = null;
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.onvoiceschanged = done;
    setTimeout(done, 400);
  });
}

export async function speakText(text, { rate = SPEECH_RATE, lang = "zh-CN" } = {}) {
  if (!window.speechSynthesis || !text) return false;

  await waitForVoices();
  window.speechSynthesis.cancel();
  try {
    window.speechSynthesis.resume();
  } catch {
    /* ignore */
  }

  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = lang;
    u.rate = rate;
    const zh = pickChineseVoice();
    if (zh) u.voice = zh;

    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    u.onend = () => finish(true);
    u.onerror = () => finish(false);

    setTimeout(() => {
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(u);
      } catch {
        finish(false);
      }
    }, isLikelySafari() ? 80 : 0);

    setTimeout(() => finish(true), Math.max(5000, String(text).length * 800));
  });
}

export async function speakCharacter(char, pinyin) {
  void pinyin;
  return speakText(char, { rate: SPEECH_RATE });
}

/** 按声母 → 韵母 → 整字依次慢速示范 */
export async function speakSyllableParts(char, pinyin, onStep) {
  const parts = splitPinyin(pinyin);
  const steps = [];
  if (parts.hasInitial) {
    steps.push({
      key: "initial",
      label: "声母",
      speak: parts.initialDemo || parts.initial,
      show: parts.initial,
    });
  }
  steps.push({
    key: "final",
    label: "韵母",
    speak: parts.finalPlain || parts.final,
    show: parts.final,
  });
  steps.push({ key: "full", label: "整字", speak: char, show: pinyin });

  for (const step of steps) {
    onStep?.(step);
    const ok = await speakText(step.speak, {
      rate: step.key === "full" ? SPEECH_RATE : Math.min(SPEECH_RATE, 0.4),
      lang: "zh-CN",
    });
    if (!ok) return false;
    await new Promise((r) => setTimeout(r, 280));
  }
  return true;
}

export function getRecognition() {
  if (!canUseSpeechRecognition()) return null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = "zh-CN";
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  return rec;
}

export function scorePronunciation(results, targetChar, targetPinyin) {
  return scorePart(results, { mode: "full", char: targetChar, pinyin: targetPinyin });
}

/** 分项打分：initial / final / full */
export function scorePart(results, { mode, char, pinyin, parts }) {
  const p = parts || splitPinyin(pinyin);
  let targets = [];
  if (mode === "initial") {
    targets = [p.initial, p.initialDemo, p.initialPlain].filter(Boolean);
  } else if (mode === "final") {
    targets = [p.final, p.finalPlain, stripTone(p.final)].filter(Boolean);
  } else {
    targets = [char, pinyin, stripTone(pinyin)].filter(Boolean);
  }

  let best = 0;
  let heard = "";

  for (const alt of results) {
    const transcript = (alt.transcript || "").trim();
    heard = heard || transcript;
    const tPlain = stripTone(transcript);

    if (mode === "full" && transcript.includes(char)) {
      best = Math.max(best, 0.95 + (alt.confidence || 0) * 0.05);
    }

    for (const t of targets) {
      const tp = stripTone(t);
      best = Math.max(best, similarity(tPlain, tp));
      best = Math.max(best, similarity(transcript.toLowerCase(), String(t).toLowerCase()));
      if (transcript.includes(t) || tPlain.includes(tp) || tp.includes(tPlain)) {
        best = Math.max(best, 0.8);
      }
    }
  }

  const threshold = mode === "full" ? 0.62 : 0.55;
  return {
    score: Math.round(Math.min(1, best) * 100),
    heard,
    pass: best >= threshold,
    mode,
  };
}

export { stripTone };
