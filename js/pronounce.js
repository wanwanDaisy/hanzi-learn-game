/** 读音：标准朗读 + 语音识别校准 */

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
  // Levenshtein-ish ratio
  const dist = levenshtein(a, b);
  const lev = 1 - dist / Math.max(a.length, b.length);
  return Math.max(lev, matches / longer.length * 0.7);
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

export function speakCharacter(char, pinyin) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve(false);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(char);
    u.lang = "zh-CN";
    u.rate = 0.85;
    // Prefer a Chinese voice if available
    const voices = window.speechSynthesis.getVoices();
    const zh = voices.find((v) => /zh[-_]?CN|Chinese/i.test(v.lang + v.name));
    if (zh) u.voice = zh;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    // Some browsers need a brief delay after getVoices
    window.speechSynthesis.speak(u);
    // Also speak pinyin as fallback cue after short delay if needed
    void pinyin;
  });
}

export function getRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = "zh-CN";
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  return rec;
}

export function scorePronunciation(results, targetChar, targetPinyin) {
  const plain = stripTone(targetPinyin);
  let best = 0;
  let heard = "";

  for (const alt of results) {
    const transcript = (alt.transcript || "").trim();
    heard = heard || transcript;
    if (transcript.includes(targetChar)) {
      best = Math.max(best, 0.95 + (alt.confidence || 0) * 0.05);
    }
    const tPlain = stripTone(transcript);
    best = Math.max(best, similarity(tPlain, plain));
    best = Math.max(best, similarity(transcript, targetChar));
  }

  return {
    score: Math.round(Math.min(1, best) * 100),
    heard,
    pass: best >= 0.62,
  };
}

export { stripTone };
