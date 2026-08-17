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
  return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/i.test(ua);
}

function isLikelyFirefox() {
  return /Firefox/i.test(navigator.userAgent || "");
}

/** 语音识别：目前仅 Chromium 系（Chrome / Edge 等）较可靠 */
export function canUseSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return false;
  // Safari 即使有接口也常无法正常识别中文
  if (isLikelySafari()) return false;
  if (isLikelyFirefox()) return false;
  return true;
}

export function getSpeechSupportInfo() {
  const recognition = canUseSpeechRecognition();
  const tts = Boolean(window.speechSynthesis);
  let browserTip = "";
  if (!recognition) {
    if (isLikelySafari()) {
      browserTip =
        "当前是 Safari，不支持朗读校准。请听标准音后点「已会读，开始写字」，或改用 Chrome。";
    } else if (isLikelyFirefox()) {
      browserTip =
        "当前是 Firefox，不支持朗读校准。请听标准音后点「已会读，开始写字」，或改用 Chrome。";
    } else {
      browserTip =
        "当前浏览器不支持朗读校准。请听标准音后点「已会读，开始写字」，或改用 Chrome / Edge。";
    }
  } else {
    browserTip = "听标准音后，清晰读出该字。需允许麦克风权限。";
  }
  return { recognition, tts, browserTip };
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

export async function speakCharacter(char, pinyin) {
  if (!window.speechSynthesis) return false;

  await waitForVoices();
  window.speechSynthesis.cancel();
  // Safari 常把合成引擎挂起，需要 resume
  try {
    window.speechSynthesis.resume();
  } catch {
    /* ignore */
  }

  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(char);
    u.lang = "zh-CN";
    u.rate = 0.85;
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

    // Safari：部分机型首句不响，短延迟再播
    setTimeout(() => {
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(u);
      } catch {
        finish(false);
      }
    }, isLikelySafari() ? 80 : 0);

    // 兜底：超时仍无回调则当作结束
    setTimeout(() => finish(true), 4000);
    void pinyin;
  });
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
