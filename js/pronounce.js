/** 读音：标准朗读 + 声母/韵母/整字校准 */

/** 跟读示范：声母预录放慢；韵母预录保持原速；整字 TTS 慢速 */
export const SPEECH_RATE = 0.16;
export const DEMO_RATE = 0.16;
const INITIAL_CLIP_RATE = 0.65;
const FINAL_CLIP_RATE = 1;

function stripTone(pinyin) {
  return pinyin
    .replace(/[ǖǘǚǜü]/g, "v")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[āáǎà]/g, "a")
    .replace(/[ēéěè]/g, "e")
    .replace(/[īíǐì]/g, "i")
    .replace(/[ōóǒò]/g, "o")
    .replace(/[ūúǔù]/g, "u")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** 界面展示用：v → ü（j/q/x/y 后的 u 也按 ü 显示） */
export function displayFinal(finalPlain) {
  const f = (finalPlain || "").toLowerCase();
  if (!f) return "";
  return f
    .replace(/^van$/, "üan")
    .replace(/^vn$/, "ün")
    .replace(/^ve$/, "üe")
    .replace(/^v/, "ü");
}

/**
 * 声母示范：用《汉语拼音方案》课堂读音汉字，避免 Chrome 把拉丁字母读成英文
 * b玻 p坡 m摸 f佛 …
 */
const INITIAL_DEMO_CHAR = {
  b: "玻",
  p: "坡",
  m: "摸",
  f: "佛",
  d: "得",
  t: "特",
  n: "讷",
  l: "勒",
  g: "哥",
  k: "科",
  h: "喝",
  j: "基",
  q: "欺",
  x: "希",
  zh: "知",
  ch: "吃",
  sh: "诗",
  r: "日",
  z: "资",
  c: "雌",
  s: "思",
  y: "衣",
  w: "乌",
};

/** 拉丁形式仍用于识别比对 */
const INITIAL_DEMO_LATIN = {
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

/**
 * 声母示范音：一律第一声平声（优先一声汉字；l/n/f/t/r 等用带调拼音）
 * 本批重点：b/l/m/n/y/sh
 */
const INITIAL_DEMO_TTS = {
  b: "玻",
  p: "坡",
  m: "摸",
  f: "佛",
  d: "嘚",
  t: "特",
  // 「勒」常被读成 lēi，改「嘞」(lē)；n 用「nē」保一声（汉字「讷」易读错）
  n: "讷",
  l: "勒",
  g: "哥",
  k: "科",
  h: "喝",
  j: "基",
  q: "欺",
  x: "希",
  zh: "知",
  ch: "吃",
  sh: "诗",
  r: "日",
  z: "资",
  c: "疵",
  s: "思",
  y: "衣",
  w: "乌",
};

/**
 * 声母口型提示（按发音部位纠正）
 * 双唇 / 唇齿 / 舌尖前 / 舌尖中 / 舌尖后 / 舌面 / 舌根
 */
const INITIAL_TIP = {
  b: "双唇音：双唇紧闭后突然放开，不送气，轻短爆破",
  p: "双唇音：动作同 b，送出强气流，有明显爆发力",
  m: "双唇音：双唇紧闭，气流从鼻腔透出，声带振动",
  f: "唇齿音：上齿轻触下唇留窄缝，气流摩擦成声，声带不振动",
  z: "舌尖前音：舌尖抵住上齿背，弱气流冲开阻碍摩擦出声",
  c: "舌尖前音：部位同 z，送出强气流，送气明显",
  s: "舌尖前音：舌尖靠近上齿背留窄缝，气流直接摩擦成声",
  d: "舌尖中音：舌尖抵住上齿龈，弱气流爆破出声",
  t: "舌尖中音：部位同 d，送出强气流",
  n: "舌尖中音：舌尖抵上齿龈，气流从鼻腔透出，声带振动",
  l: "舌尖中音：舌尖抵上齿龈，气流从舌头两侧流出，声带振动",
  zh: "舌尖后音：舌尖上翘抵住硬腭前部，弱气流冲开阻碍摩擦出声",
  ch: "舌尖后音：部位同 zh，送出强气流",
  sh: "舌尖后音：舌尖上翘靠近硬腭留窄缝，气流摩擦成声",
  r: "舌尖后音：舌尖位置同 sh，声带振动，浊摩擦成声",
  j: "舌面音：舌面前部抵住硬腭前部，弱气流冲开阻碍摩擦出声",
  q: "舌面音：部位同 j，送出强气流",
  x: "舌面音：舌面前部靠近硬腭留窄缝，气流直接摩擦成声",
  g: "舌根音：舌根抵住软腭，弱气流爆破出声",
  k: "舌根音：部位同 g，送出强气流",
  h: "舌根音：舌根靠近软腭留窄缝，气流摩擦成声",
  y: "零声母：口形像「衣」，起音轻短",
  w: "零声母：嘴唇拢圆，像「乌」",
};

export function getInitialTip(initial) {
  return INITIAL_TIP[initial] || "";
}

/**
 * 韵母口型提示（单韵母 / 复韵母 / 鼻韵母）
 */
const FINAL_TIP = {
  a: "单韵母：嘴巴张大，舌位放低，声音响亮",
  o: "单韵母：嘴唇拢圆，舌位半高，声音圆润",
  e: "单韵母：嘴角向两边展，舌位半高，不圆唇",
  i: "单韵母：嘴角展开，舌位最高，像微笑",
  u: "单韵母：嘴唇拢圆前突，舌位后高",
  v: "单韵母 ü：嘴形像 u，舌位像 i",
  ü: "单韵母 ü：嘴形像 u，舌位像 i",
  ai: "复韵母：由 a 滑向 i，口形由大变小",
  ei: "复韵母：由 ê 滑向 i，口形略收",
  ui: "复韵母：实际接近 uei，由 u 滑向 ei",
  ao: "复韵母：由 a 滑向 o，口形由大变圆",
  ou: "复韵母：由 o 滑向 u，嘴唇逐渐拢圆",
  iu: "复韵母：实际接近 iou，由 i 滑向 ou",
  ie: "复韵母：由 i 滑向 ê，口形略开",
  ve: "复韵母 üe：由 ü 滑向 ê",
  er: "特殊韵母：舌尖卷起，发卷舌音",
  an: "前鼻韵母：先发 a，舌尖抵上齿龈收鼻音",
  en: "前鼻韵母：先发 e，舌尖抵上齿龈收鼻音",
  in: "前鼻韵母：先发 i，舌尖抵上齿龈收鼻音",
  un: "前鼻韵母：实际接近 uen，收前鼻音",
  vn: "前鼻韵母 ün：先发 ü，收前鼻音",
  ang: "后鼻韵母：先发 a，舌根抵软腭收鼻音",
  eng: "后鼻韵母：先发 e，舌根抵软腭收鼻音",
  ing: "后鼻韵母：先发 i，舌根抵软腭收鼻音",
  ong: "后鼻韵母：先发 o，舌根抵软腭收鼻音",
  ia: "复韵母：由 i 滑向 a",
  iao: "复韵母：由 i 滑向 ao",
  ian: "前鼻韵母：由 i 滑向 an",
  iang: "后鼻韵母：由 i 滑向 ang",
  iong: "后鼻韵母：由 i 滑向 ong",
  ua: "复韵母：由 u 滑向 a",
  uo: "复韵母：由 u 滑向 o",
  uai: "复韵母：由 u 滑向 ai",
  uan: "前鼻韵母：由 u 滑向 an",
  uang: "后鼻韵母：由 u 滑向 ang",
  ueng: "后鼻韵母：由 u 滑向 eng",
  van: "前鼻韵母 üan：由 ü 滑向 an",
};

export function getFinalTip(finalPlain) {
  const f = (finalPlain || "").toLowerCase();
  if (!f) return "";
  if (FINAL_TIP[f]) return FINAL_TIP[f];
  if (f.endsWith("ng")) return "后鼻韵母：气流从鼻腔透出，舌根抵软腭";
  if (f.endsWith("n")) return "前鼻韵母：气流从鼻腔透出，舌尖抵上齿龈";
  if (f.length >= 2) return "复韵母：口形连贯滑动，一气呵成";
  return "把韵母读清楚、读完整";
}

/** 按当前步骤返回带标题的发音指导 */
export function getStepGuide(step, parts, char) {
  if (step === "initial" && parts?.hasInitial) {
    const ini = parts.initial;
    const tip = getInitialTip(ini);
    if (!tip) return null;
    return { kind: "initial", title: `声母 ${ini} 的发音指导`, body: tip };
  }
  if (step === "final") {
    const fin = parts?.finalPlain || "";
    const tip = getFinalTip(fin);
    if (!tip) return null;
    return { kind: "final", title: `韵母 ${displayFinal(fin)} 的发音指导`, body: tip };
  }
  if (step === "full") {
    const ini = parts?.hasInitial ? parts.initial : "";
    const fin = parts?.finalPlain || "";
    const body = ini
      ? `先发声母 ${ini}，再接韵母 ${displayFinal(fin)}，一口气拼成「${char || ""}」`
      : `直接读韵母 ${displayFinal(fin)}，拼成「${char || ""}」`;
    return { kind: "full", title: "拼读指导", body };
  }
  return null;
}

/**
 * 韵母示范汉字（近似课堂读音，供 TTS；识别仍用拼音）
 */
const FINAL_DEMO_CHAR = {
  a: "阿",
  o: "喔",
  e: "婀",
  i: "衣",
  u: "乌",
  v: "迂",
  ai: "哀",
  ei: "欸",
  ui: "威",
  ao: "熬",
  ou: "欧",
  iu: "优",
  ie: "耶",
  ve: "约",
  er: "儿",
  an: "安",
  en: "恩",
  in: "因",
  un: "温",
  vn: "晕",
  ang: "肮",
  eng: "鞥",
  ing: "英",
  ong: "翁",
  ia: "呀",
  iao: "腰",
  ian: "烟",
  iang: "央",
  iong: "雍",
  ua: "蛙",
  uo: "窝",
  uai: "歪",
  uan: "弯",
  uang: "汪",
  ueng: "翁",
  van: "冤",
};

/**
 * 韵母示范音：一律第一声平声（优先一声汉字）
 * 本批重点：a/ai/e/iu/ang；声母 l/n 用课堂字「勒」「讷」
 */
const FINAL_DEMO_TTS = {
  a: "阿",
  o: "喔",
  e: "婀",
  i: "衣",
  u: "乌",
  v: "迂",
  ai: "哀",
  ei: "欸",
  ui: "威",
  ao: "凹",
  ou: "欧",
  iu: "优",
  ie: "耶",
  ve: "约",
  er: "儿",
  an: "安",
  en: "恩",
  in: "因",
  un: "温",
  vn: "晕",
  ang: "肮",
  eng: "鞥",
  ing: "英",
  ong: "翁",
  ia: "呀",
  iao: "腰",
  ian: "烟",
  iang: "央",
  iong: "雍",
  ua: "蛙",
  uo: "窝",
  uai: "歪",
  uan: "弯",
  uang: "汪",
  ueng: "翁",
  van: "冤",
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

  // j/q/x/y 后的 u 实际是 ü（you 除外）
  if (["j", "q", "x"].includes(initial) && finalPlain.startsWith("u") && !finalPlain.startsWith("uo")) {
    finalPlain = `v${finalPlain.slice(1)}`;
  }
  if (initial === "y" && finalPlain.startsWith("u") && finalPlain !== "ou") {
    finalPlain = `v${finalPlain.slice(1)}`;
  }

  return {
    initial,
    final,
    initialPlain: initial,
    finalPlain,
    finalDisplay: displayFinal(finalPlain),
    initialDemo: initial ? INITIAL_DEMO_LATIN[initial] || initial : "",
    initialDemoChar: initial ? INITIAL_DEMO_CHAR[initial] || "" : "",
    finalDemoChar: FINAL_DEMO_CHAR[finalPlain] || "",
    hasInitial: Boolean(initial),
  };
}

function isLikelySafari() {
  const ua = navigator.userAgent || "";
  return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox|MicroMessenger/i.test(ua);
}

/** iPad / iPhone，含 iPadOS 桌面 UA、iPad Chrome（CriOS，仍是 WebKit） */
function isIOSWebKit() {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1) return true;
  return false;
}

export function isWeChat() {
  return /MicroMessenger/i.test(navigator.userAgent || "");
}

function voiceScore(v) {
  const s = `${v.lang || ""} ${v.name || ""}`;
  if (/zh[-_]?CN/i.test(v.lang) || /Ting[- ]?Ting|Tingting|普通话|Chinese \(China\)/i.test(s)) return 3;
  if (/zh[-_]?TW|Mei[- ]?Jia|Meijia|国语/i.test(s)) return 2;
  if (/zh[-_]?HK|Sin[- ]?Ji|Sinji/i.test(s)) return 1;
  if (/zh|Chinese|中文/i.test(s)) return 1;
  return 0;
}

function pickChineseVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return voices.filter((v) => voiceScore(v) > 0).sort((a, b) => voiceScore(b) - voiceScore(a))[0] || null;
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
      resolve(window.speechSynthesis.getVoices() || []);
    };
    window.speechSynthesis.onvoiceschanged = done;
    setTimeout(done, isIOSWebKit() ? 800 : 400);
  });
}

function effectiveTtsRate(rate) {
  if (isIOSWebKit() && rate < 0.7) return 0.85;
  return rate;
}

const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let audioCtx = null;
let sharedAudio = null;
let currentBufferSource = null;
const clipCache = new Map();

function ensureAudioCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function ensureSharedAudio() {
  if (sharedAudio) return sharedAudio;
  const a = document.getElementById("demo-audio") || new Audio();
  a.preload = "auto";
  a.playsInline = true;
  a.setAttribute("playsinline", "true");
  a.setAttribute("webkit-playsinline", "true");
  if (!a.parentNode && document.body) {
    a.hidden = true;
    document.body.appendChild(a);
  }
  sharedAudio = a;
  return a;
}

/** 必须在点击等手势里同步调用，之后 iOS 才允许异步播录音 / TTS */
export function unlockPlayback() {
  try {
    const synth = window.speechSynthesis;
    if (synth) {
      synth.getVoices();
      const silent = new SpeechSynthesisUtterance(" ");
      silent.volume = 0;
      silent.rate = 1;
      silent.lang = "zh-CN";
      synth.speak(silent);
    }
  } catch {
    /* ignore */
  }
  try {
    const a = ensureSharedAudio();
    a.muted = true;
    a.src = SILENT_WAV;
    a.play().catch(() => {});
  } catch {
    /* ignore */
  }
  try {
    ensureAudioCtx();
    if (audioCtx) {
      const buf = audioCtx.createBuffer(1, 1, audioCtx.sampleRate || 22050);
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(audioCtx.destination);
      src.start(0);
    }
  } catch {
    /* ignore */
  }
}

/**
 * 韵母播报：优先用课堂汉字，避免拉丁字母被读成英文
 */
export function finalSpeakText(finalPlain) {
  const f = (finalPlain || "").toLowerCase();
  if (!f) return "";
  if (FINAL_DEMO_TTS[f]) return FINAL_DEMO_TTS[f];
  if (FINAL_DEMO_CHAR[f]) return FINAL_DEMO_CHAR[f];

  const via = {
    yi: "衣",
    ya: "呀",
    ye: "耶",
    yao: "腰",
    you: "优",
    yan: "烟",
    yin: "因",
    yang: "央",
    ying: "英",
    yong: "雍",
    wu: "乌",
    wa: "蛙",
    wo: "窝",
    wai: "歪",
    wei: "威",
    wan: "弯",
    wen: "温",
    wang: "汪",
    weng: "翁",
    yu: "迂",
    yue: "约",
    yuan: "冤",
    yun: "晕",
  };

  if (f === "i") return FINAL_DEMO_TTS.i;
  if (f === "u") return FINAL_DEMO_TTS.u;
  if (f === "v" || f === "ü") return FINAL_DEMO_TTS.v;
  if (f === "iu") return FINAL_DEMO_TTS.iu;
  if (f === "ui") return FINAL_DEMO_TTS.ui;
  if (f === "un") return FINAL_DEMO_TTS.un;
  if (f === "uen") return FINAL_DEMO_TTS.un;

  if (f.startsWith("i")) {
    const mapped = `y${f.slice(1)}`
      .replace(/^yia/, "ya")
      .replace(/^yio/, "yo")
      .replace(/^yie/, "ye")
      .replace(/^yiu/, "you");
    const key = mapped === "you" ? "iu" : mapped === "yi" ? "i" : mapped.replace(/^y/, "i") === f ? f : null;
    if (FINAL_DEMO_TTS[mapped]) return FINAL_DEMO_TTS[mapped];
    if (mapped === "you") return FINAL_DEMO_TTS.iu;
    if (mapped === "yi") return FINAL_DEMO_TTS.i;
    return via[mapped] || mapped;
  }
  if (f.startsWith("u")) {
    const rest = f.slice(1);
    const mapped = !rest
      ? "wu"
      : `w${rest}`.replace(/^wui/, "wei").replace(/^wun/, "wen");
    if (mapped === "wu") return FINAL_DEMO_TTS.u;
    if (mapped === "wei") return FINAL_DEMO_TTS.ui;
    if (mapped === "wen") return FINAL_DEMO_TTS.un;
    if (FINAL_DEMO_TTS[mapped]) return FINAL_DEMO_TTS[mapped];
    return via[mapped] || mapped;
  }
  if (f.startsWith("v")) {
    const rest = f.slice(1);
    const mapped = rest ? `yu${rest}` : "yu";
    if (mapped === "yu") return FINAL_DEMO_TTS.v;
    if (mapped === "yue") return FINAL_DEMO_TTS.ve;
    if (mapped === "yuan") return FINAL_DEMO_TTS.van;
    return via[mapped] || via.yu;
  }
  return f;
}

export async function speakText(text, { rate = SPEECH_RATE, lang = "zh-CN", pitch = 1 } = {}) {
  if (!window.speechSynthesis || !text) return false;

  stopDemoAudio();
  await waitForVoices();
  const zh = pickChineseVoice();
  // 没有中文语音时不要用英语引擎念汉字（iPad 上听起来就像读错）
  if (!zh) return false;

  const playRate = effectiveTtsRate(rate);
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
  try {
    window.speechSynthesis.resume();
  } catch {
    /* ignore */
  }

  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = zh.lang || lang;
    u.voice = zh;
    u.rate = playRate;
    u.pitch = pitch;

    let settled = false;
    let started = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    u.onstart = () => {
      started = true;
    };
    u.onend = () => finish(true);
    u.onerror = () => finish(false);

    const kick = isIOSWebKit() || isLikelySafari() ? 80 : 0;
    setTimeout(() => {
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(u);
      } catch {
        finish(false);
      }
    }, kick);

    const maxMs = Math.max(5000, Math.ceil(String(text).length * (1200 / Math.max(playRate, 0.25))));
    setTimeout(() => finish(started), maxMs);
  });
}

export async function speakCharacter(char, pinyin) {
  void pinyin;
  return speakText(char, { rate: SPEECH_RATE });
}

/** 声母/韵母示范：课堂汉字（上一版正确读音） */
export function partSpeakText(stepKey, parts) {
  if (stepKey === "initial") {
    if (!parts?.hasInitial) return "";
    const ini = parts.initial;
    // 一声平声示范（bō/lē/shī…）
    return INITIAL_DEMO_TTS[ini] || parts.initialDemoChar || parts.initialDemo || ini;
  }
  if (stepKey === "final") {
    const plain = parts?.finalPlain || stripTone(parts?.final || "");
    // 一声平声示范（ā/āi/ē/yōu/āng…）
    return FINAL_DEMO_TTS[plain] || finalSpeakText(plain);
  }
  return "";
}

/**
 * 读音示范音源：
 * - 声母：主持人小史 BV1nUUhYHESM，按用户标定时间切两遍呼读中的一遍（y/w 未标定，仍用 TTS）
 * - 韵母：BV1Xm4y1R7c3《24个韵母正确发音及发音口型》预录
 * - 整字：系统 TTS
 */
const INITIAL_AUDIO = Object.fromEntries(
  ["b","p","m","f","d","t","n","l","g","k","h","j","q","x","zh","ch","sh","r","z","c","s"].map(
    (k) => [k, `audio/initial-${k}.m4a?v=20260819n`]
  )
);

const FINAL_AUDIO = Object.fromEntries(
  ["a","o","e","i","u","v","ai","ei","ui","ao","ou","iu","ie","ve","er","an","en","in","un","vn","ang","eng","ing","ong"].map(
    (k) => [k, `audio/final-${k}.m4a?v=20260818`]
  )
);

function finalAudioKey(finalPlain) {
  let f = (finalPlain || "").toLowerCase().replace(/ü/g, "v");
  if (!f) return "";
  if (FINAL_AUDIO[f]) return f;
  const aliases = {
    ü: "v",
    ue: "ve",
    üe: "ve",
    ün: "vn",
    uen: "un",
    uei: "ui",
    iou: "iu",
  };
  if (aliases[f] && FINAL_AUDIO[aliases[f]]) return aliases[f];
  return "";
}

let currentDemoAudio = null;
let playTimer = null;
let playGen = 0;

export function stopDemoAudio() {
  playGen += 1;
  if (playTimer) {
    clearTimeout(playTimer);
    playTimer = null;
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
  if (currentBufferSource) {
    try {
      currentBufferSource.stop();
    } catch {
      /* ignore */
    }
    currentBufferSource = null;
  }
  const a = currentDemoAudio || sharedAudio;
  currentDemoAudio = null;
  if (!a) return;
  a.onended = null;
  a.onerror = null;
  a.onplaying = null;
  a.onloadedmetadata = null;
  try {
    a.pause();
    a.muted = false;
  } catch {
    /* ignore */
  }
}

function applyClipRate(a, rate) {
  a.preservesPitch = true;
  a.webkitPreservesPitch = true;
  a.mozPreservesPitch = true;
  a.defaultPlaybackRate = rate;
  a.playbackRate = rate;
}

function clipTimeoutMs(duration, rate) {
  const dur = Number(duration);
  if (!Number.isFinite(dur) || dur <= 0) return 4500;
  return Math.ceil((dur / rate) * 1000) + 600;
}

function clipPlayRate(rate) {
  // WebKit 对 m4a 降速容易变调/无声，iPad 上按原速播课堂录音
  if (isIOSWebKit()) return 1;
  return rate;
}

async function decodeClip(src) {
  if (clipCache.has(src)) return clipCache.get(src);
  const ctx = ensureAudioCtx();
  if (!ctx) throw new Error("no-audioctx");
  const res = await fetch(src);
  if (!res.ok) throw new Error("fetch");
  const arr = await res.arrayBuffer();
  const buf = await ctx.decodeAudioData(arr.slice(0));
  clipCache.set(src, buf);
  return buf;
}

function playDecodedBuffer(buf, rate, gen) {
  return new Promise((resolve) => {
    const ctx = ensureAudioCtx();
    if (!ctx || gen !== playGen) {
      resolve(false);
      return;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.connect(ctx.destination);
    currentBufferSource = src;
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      if (playTimer) {
        clearTimeout(playTimer);
        playTimer = null;
      }
      if (currentBufferSource === src) currentBufferSource = null;
      resolve(ok && gen === playGen);
    };
    src.onended = () => finish(true);
    try {
      src.start(0);
    } catch {
      finish(false);
      return;
    }
    playTimer = setTimeout(() => finish(true), clipTimeoutMs(buf.duration, rate));
  });
}

function playHtmlAudio(src, rate, gen) {
  return new Promise((resolve) => {
    const a = ensureSharedAudio();
    currentDemoAudio = a;
    a.muted = false;
    a.playsInline = true;
    a.setAttribute("playsinline", "true");
    a.preload = "auto";
    a.src = src;
    applyClipRate(a, rate);
    let done = false;
    let started = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      if (playTimer) {
        clearTimeout(playTimer);
        playTimer = null;
      }
      if (currentDemoAudio === a) currentDemoAudio = null;
      resolve(ok && started && gen === playGen);
    };
    const armTimeout = (duration) => {
      if (done || gen !== playGen) return;
      if (playTimer) clearTimeout(playTimer);
      playTimer = setTimeout(() => finish(started), clipTimeoutMs(duration, rate));
    };
    a.onloadedmetadata = () => {
      applyClipRate(a, rate);
      armTimeout(a.duration);
    };
    a.onplaying = () => {
      started = true;
      applyClipRate(a, rate);
    };
    a.onended = () => finish(started);
    a.onerror = () => finish(false);
    a.play().catch(() => finish(false));
    armTimeout();
  });
}

async function playAudio(src, rate = INITIAL_CLIP_RATE) {
  stopDemoAudio();
  const gen = playGen;
  const playRate = clipPlayRate(rate);
  // 桌面 Chrome 走 HTMLAudio，才能 preservesPitch 慢放；iPad 用 Web Audio，避免 play() 被手势策略拦住
  if (isIOSWebKit()) {
    ensureAudioCtx();
    try {
      const buf = await decodeClip(src);
      if (gen !== playGen) return false;
      return await playDecodedBuffer(buf, playRate, gen);
    } catch {
      if (gen !== playGen) return false;
      return playHtmlAudio(src, playRate, gen);
    }
  }
  return playHtmlAudio(src, playRate, gen);
}

async function playClipPair(parts) {
  let any = false;
  if (parts.hasInitial && INITIAL_AUDIO[parts.initial]) {
    if (await playAudio(INITIAL_AUDIO[parts.initial])) any = true;
  }
  const key = finalAudioKey(parts.finalPlain || stripTone(parts.final || ""));
  if (key && FINAL_AUDIO[key]) {
    if (await playAudio(FINAL_AUDIO[key], FINAL_CLIP_RATE)) any = true;
  }
  return any;
}

/** 单步播报（只播示范音，不口播步骤名） */
export async function speakSoundStep(stepKey, char, pinyin) {
  const parts = splitPinyin(pinyin);
  if (stepKey === "initial") {
    const ini = parts.initial;
    if (INITIAL_AUDIO[ini]) {
      const ok = await playAudio(INITIAL_AUDIO[ini]);
      if (ok) return true;
    }
    const text = partSpeakText("initial", parts);
    if (!text) return true;
    return speakText(text, { rate: DEMO_RATE });
  }
  if (stepKey === "final") {
    const key = finalAudioKey(parts.finalPlain || stripTone(parts.final || ""));
    if (key && FINAL_AUDIO[key]) {
      const ok = await playAudio(FINAL_AUDIO[key], FINAL_CLIP_RATE);
      if (ok) return true;
    }
    const text = partSpeakText("final", parts);
    if (!text) return true;
    return speakText(text, { rate: DEMO_RATE });
  }
  if (isIOSWebKit()) {
    const clips = await playClipPair(parts);
    if (clips) return true;
  }
  const tts = await speakText(char, { rate: DEMO_RATE });
  if (tts) return true;
  return playClipPair(parts);
}

export const CHART_INITIAL_KEYS = [
  "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x",
  "zh", "ch", "sh", "r", "z", "c", "s", "y", "w",
];

export const CHART_FINAL_ITEMS = [
  { key: "a", label: "a" },
  { key: "o", label: "o" },
  { key: "e", label: "e" },
  { key: "i", label: "i" },
  { key: "u", label: "u" },
  { key: "v", label: "ü" },
  { key: "ai", label: "ai" },
  { key: "ei", label: "ei" },
  { key: "ui", label: "ui" },
  { key: "ao", label: "ao" },
  { key: "ou", label: "ou" },
  { key: "iu", label: "iu" },
  { key: "ie", label: "ie" },
  { key: "ve", label: "üe" },
  { key: "er", label: "er" },
  { key: "an", label: "an" },
  { key: "en", label: "en" },
  { key: "in", label: "in" },
  { key: "un", label: "un" },
  { key: "vn", label: "ün" },
  { key: "ang", label: "ang" },
  { key: "eng", label: "eng" },
  { key: "ing", label: "ing" },
  { key: "ong", label: "ong" },
];

/** 字表核对：直接播预录，失败再 TTS */
export async function playChartSound(kind, key) {
  if (kind === "initial") {
    if (INITIAL_AUDIO[key]) {
      const ok = await playAudio(INITIAL_AUDIO[key]);
      if (ok) return true;
    }
    const dummy = key === "y" ? "yī" : key === "w" ? "wū" : `${key}ā`;
    return speakSoundStep("initial", "", dummy);
  }
  if (kind === "final") {
    const audioKey = finalAudioKey(key);
    if (audioKey && FINAL_AUDIO[audioKey]) {
      const ok = await playAudio(FINAL_AUDIO[audioKey], FINAL_CLIP_RATE);
      if (ok) return true;
    }
    const dummy = key === "v" ? "ü" : key;
    return speakSoundStep("final", "", dummy);
  }
  return false;
}

/**
 * 组合示范：先整字 → 停 2 秒 → 声母 → 韵母 → 再组合整字
 * iPad/WebKit 整字也用课堂录音，不走系统 TTS（英语引擎会把汉字念错）。
 */
export async function speakSyllableParts(char, pinyin, onStep) {
  const parts = splitPinyin(pinyin);

  onStep?.({ key: "full", speak: char, show: pinyin, phase: "preview" });
  const previewOk = isIOSWebKit()
    ? await playClipPair(parts)
    : await speakText(char, { rate: DEMO_RATE });
  if (previewOk) {
    await new Promise((r) => setTimeout(r, 2000));
  }

  const steps = [];
  if (parts.hasInitial) {
    steps.push({
      key: "initial",
      speak: partSpeakText("initial", parts),
      show: parts.initial,
      phase: "calibrate",
    });
  }
  steps.push({
    key: "final",
    speak: partSpeakText("final", parts),
    show: parts.finalPlain,
    phase: "calibrate",
  });
  steps.push({ key: "full", speak: char, show: pinyin, phase: "calibrate" });

  let any = previewOk;
  for (const step of steps) {
    onStep?.(step);
    const ok = await speakSoundStep(step.key, char, pinyin);
    if (ok) any = true;
    await new Promise((r) => setTimeout(r, 750));
  }
  return any;
}

export { stripTone };
