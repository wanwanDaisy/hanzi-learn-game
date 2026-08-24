/**
 * 部编一年级四线三格拼音书写体
 * 坐标：y=0 第一线，y=1 第二线，y=2 第三线（红基线），y=3 第四线
 *
 * 口诀：中格写满顶两边；住上格的不顶线；住下格的不贴边。
 * j 靠「点 + 中格竖 + 下格钩」占上中下三格。
 */

const ASC = 0.14;
const DESC = 2.86;
const T_ASC = 0.34;

const TONE_MARK = {
  ā: ["a", 1], á: ["a", 2], ǎ: ["a", 3], à: ["a", 4],
  ē: ["e", 1], é: ["e", 2], ě: ["e", 3], è: ["e", 4],
  ī: ["i", 1], í: ["i", 2], ǐ: ["i", 3], ì: ["i", 4],
  ō: ["o", 1], ó: ["o", 2], ǒ: ["o", 3], ò: ["o", 4],
  ū: ["u", 1], ú: ["u", 2], ǔ: ["u", 3], ù: ["u", 4],
  ǖ: ["ü", 1], ǘ: ["ü", 2], ǚ: ["ü", 3], ǜ: ["ü", 4],
  ń: ["n", 2], ň: ["n", 3], ǹ: ["n", 4],
};

export function parsePinyinUnits(text) {
  const units = [];
  for (const ch of String(text || "")) {
    if (ch === " " || ch === "'") continue;
    const mapped = TONE_MARK[ch];
    if (mapped) {
      units.push({ letter: mapped[0], tone: mapped[1] });
      continue;
    }
    const lower = ch.toLowerCase();
    if (lower === "v") units.push({ letter: "ü", tone: 0 });
    else if (/[a-zü]/.test(lower)) units.push({ letter: lower, tone: 0 });
  }
  return units;
}

/** 声调画在上格，不顶第一线；相对字母宽度水平居中 */
export const TONE_PATHS = {
  1: "M 0.08 0.18 L 0.56 0.18",
  2: "M 0.10 0.38 L 0.54 0.14",
  3: "M 0.08 0.16 L 0.32 0.40 L 0.56 0.16",
  4: "M 0.10 0.14 L 0.54 0.40",
};

/**
 * w：字母宽度（一格高度为 1）
 * strokes：主体笔顺
 * dots：i / ü / j 的点；带调 i 用调号代替点
 */
export const GLYPHS = {
  a: {
    w: 0.82,
    strokes: [
      "M 0.60 1.06 C 0.46 0.98 0.10 1.06 0.08 1.50 C 0.06 1.90 0.28 2.02 0.58 1.90",
      "M 0.60 1.00 L 0.60 1.86 C 0.60 1.98 0.66 2.00 0.76 1.98",
    ],
  },
  o: {
    w: 0.84,
    strokes: [
      `M 0.42 1.00 C 0.16 1.00 0.08 1.28 0.08 1.50 C 0.08 1.88 0.20 2.00 0.42 2.00 C 0.64 2.00 0.76 1.88 0.76 1.50 C 0.76 1.28 0.68 1.00 0.42 1.00`,
    ],
  },
  e: {
    w: 0.82,
    strokes: [
      "M 0.12 1.50 L 0.58 1.50 C 0.72 1.42 0.68 1.02 0.42 1.00 C 0.14 0.98 0.06 1.24 0.08 1.50 C 0.10 1.90 0.30 2.02 0.58 1.90",
    ],
  },
  i: {
    w: 0.42,
    strokes: ["M 0.21 1.00 L 0.21 2.00"],
    dots: ["M 0.21 0.28 L 0.21 0.48"],
  },
  u: {
    w: 0.82,
    strokes: [
      "M 0.12 1.00 L 0.12 1.68 C 0.12 1.94 0.28 2.00 0.40 2.00 C 0.56 2.00 0.66 1.88 0.66 1.58 L 0.66 1.00 L 0.66 1.86 C 0.66 1.98 0.72 2.00 0.80 1.98",
    ],
  },
  ü: {
    w: 0.82,
    keepDotsWithTone: true,
    strokes: [
      "M 0.12 1.00 L 0.12 1.68 C 0.12 1.94 0.28 2.00 0.40 2.00 C 0.56 2.00 0.66 1.88 0.66 1.58 L 0.66 1.00 L 0.66 1.86 C 0.66 1.98 0.72 2.00 0.80 1.98",
    ],
    dots: ["M 0.24 0.52 L 0.24 0.70", "M 0.54 0.52 L 0.54 0.70"],
  },
  n: {
    w: 0.80,
    strokes: [
      "M 0.12 2.00 L 0.12 1.00 C 0.26 0.96 0.56 0.98 0.66 1.28 L 0.66 2.00",
    ],
  },
  m: {
    w: 1.16,
    strokes: [
      "M 0.12 2.00 L 0.12 1.00 C 0.24 0.96 0.44 0.98 0.52 1.30 C 0.62 0.96 0.90 0.96 1.02 1.30 L 1.02 2.00",
    ],
  },
  h: {
    w: 0.80,
    strokes: [
      `M 0.14 ${ASC} L 0.14 2.00`,
      "M 0.14 1.06 C 0.26 0.96 0.56 0.96 0.66 1.28 L 0.66 2.00",
    ],
  },
  l: {
    w: 0.40,
    strokes: [`M 0.20 ${ASC} L 0.20 2.00`],
  },
  b: {
    w: 0.82,
    strokes: [
      `M 0.16 ${ASC} L 0.16 2.00`,
      "M 0.16 1.00 C 0.58 0.98 0.74 1.24 0.72 1.50 C 0.70 1.90 0.40 2.02 0.16 1.92",
    ],
  },
  d: {
    w: 0.82,
    strokes: [
      "M 0.66 1.06 C 0.52 0.98 0.12 1.06 0.10 1.50 C 0.08 1.90 0.32 2.02 0.66 1.90",
      `M 0.66 ${ASC} L 0.66 2.00`,
    ],
  },
  p: {
    w: 0.82,
    strokes: [
      `M 0.16 1.00 L 0.16 ${DESC}`,
      "M 0.16 1.00 C 0.58 0.98 0.74 1.24 0.72 1.50 C 0.70 1.90 0.40 2.02 0.16 1.92",
    ],
  },
  q: {
    w: 0.82,
    strokes: [
      "M 0.66 1.06 C 0.52 0.98 0.12 1.06 0.10 1.50 C 0.08 1.90 0.32 2.02 0.66 1.90",
      `M 0.66 1.00 L 0.66 ${DESC}`,
    ],
  },
  g: {
    w: 0.82,
    strokes: [
      "M 0.64 1.06 C 0.50 0.98 0.12 1.06 0.10 1.50 C 0.08 1.90 0.32 2.02 0.64 1.88",
      `M 0.64 1.00 L 0.64 2.22 C 0.64 2.62 0.48 2.88 0.22 ${DESC} C 0.08 2.82 0.10 2.64 0.24 2.66`,
    ],
  },
  t: {
    w: 0.62,
    strokes: [`M 0.31 ${T_ASC} L 0.31 2.00`, "M 0.06 1.00 L 0.56 1.00"],
  },
  f: {
    w: 0.62,
    strokes: [
      `M 0.46 0.20 C 0.42 0.12 0.18 0.12 0.18 0.32 L 0.18 2.00`,
      "M 0.04 1.00 L 0.50 1.00",
    ],
  },
  k: {
    w: 0.78,
    strokes: [
      `M 0.14 ${ASC} L 0.14 2.00`,
      "M 0.64 1.00 L 0.18 1.48 L 0.66 2.00",
    ],
  },
  r: {
    w: 0.54,
    strokes: ["M 0.12 2.00 L 0.12 1.00 C 0.28 0.96 0.48 1.02 0.50 1.22"],
  },
  c: {
    w: 0.76,
    strokes: [
      "M 0.64 1.16 C 0.52 0.98 0.12 1.04 0.10 1.50 C 0.08 1.90 0.30 2.02 0.62 1.88",
    ],
  },
  s: {
    w: 0.70,
    strokes: [
      "M 0.56 1.18 C 0.50 0.98 0.16 1.00 0.16 1.24 C 0.16 1.46 0.36 1.50 0.48 1.60 C 0.66 1.74 0.62 2.00 0.32 2.00 C 0.12 2.00 0.08 1.84 0.18 1.80",
    ],
  },
  z: {
    w: 0.72,
    strokes: ["M 0.08 1.00 L 0.64 1.00 L 0.08 2.00 L 0.64 2.00"],
  },
  w: {
    w: 1.10,
    strokes: ["M 0.06 1.00 L 0.26 2.00 L 0.48 1.00 L 0.70 2.00 L 0.92 1.00"],
  },
  x: {
    w: 0.76,
    strokes: ["M 0.10 1.00 L 0.66 2.00", "M 0.66 1.00 L 0.10 2.00"],
  },
  y: {
    w: 0.80,
    strokes: [
      "M 0.08 1.00 L 0.38 2.00",
      `M 0.70 1.00 L 0.38 2.00 C 0.34 2.42 0.26 2.84 0.10 ${DESC}`,
    ],
  },
  j: {
    w: 0.50,
    dots: ["M 0.32 0.28 L 0.32 0.48"],
    strokes: [
      `M 0.32 1.00 L 0.32 2.38 C 0.32 2.72 0.12 2.88 0.08 ${DESC} C 0.04 2.72 0.10 2.66 0.18 2.70`,
    ],
  },
  v: {
    w: 0.72,
    strokes: ["M 0.08 1.00 L 0.36 2.00 L 0.64 1.00"],
  },
};

const GAP = 0.12;

function strokesFor(g, tone) {
  const strokes = [...g.strokes];
  if (g.dots?.length && (g.keepDotsWithTone || !tone)) strokes.push(...g.dots);
  return strokes;
}

export function measureUnits(units) {
  let w = 0;
  units.forEach((u, i) => {
    const g = GLYPHS[u.letter];
    w += g ? g.w : 0.7;
    if (i < units.length - 1) w += GAP;
  });
  return w;
}

export function layoutUnits(units) {
  const items = [];
  let x = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const g = GLYPHS[u.letter] || GLYPHS.a;
    items.push({
      letter: u.letter,
      tone: u.tone,
      x,
      w: g.w,
      strokes: strokesFor(g, u.tone),
    });
    x += g.w + GAP;
  }
  return { items, width: Math.max(0, x - GAP) };
}

function tokenize(d) {
  return String(d).match(/[MLCQZmlcqz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
}

export function parsePath(d) {
  const tok = tokenize(d);
  const cmds = [];
  let i = 0;
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    const c = tok[i++];
    if (c === "M" || c === "m") cmds.push({ t: "M", x: num(), y: num() });
    else if (c === "L" || c === "l") cmds.push({ t: "L", x: num(), y: num() });
    else if (c === "C" || c === "c") cmds.push({ t: "C", x1: num(), y1: num(), x2: num(), y2: num(), x: num(), y: num() });
    else if (c === "Q" || c === "q") cmds.push({ t: "Q", x1: num(), y1: num(), x: num(), y: num() });
    else if (c === "Z" || c === "z") cmds.push({ t: "Z" });
  }
  return cmds;
}

function cubic(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return mt ** 3 * p0 + 3 * mt ** 2 * t * p1 + 3 * mt * t ** 2 * p2 + t ** 3 * p3;
}

function quad(p0, p1, p2, t) {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

export function samplePath(d, density = 0.06) {
  const cmds = parsePath(d);
  const pts = [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const push = (px, py) => pts.push({ x: px, y: py });
  for (const c of cmds) {
    if (c.t === "M") {
      x = c.x;
      y = c.y;
      sx = x;
      sy = y;
      push(x, y);
    } else if (c.t === "L") {
      const dist = Math.hypot(c.x - x, c.y - y);
      const n = Math.max(1, Math.ceil(dist / density));
      for (let i = 1; i <= n; i++) push(x + ((c.x - x) * i) / n, y + ((c.y - y) * i) / n);
      x = c.x;
      y = c.y;
    } else if (c.t === "C") {
      const n = 18;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        push(cubic(x, c.x1, c.x2, c.x, t), cubic(y, c.y1, c.y2, c.y, t));
      }
      x = c.x;
      y = c.y;
    } else if (c.t === "Q") {
      const n = 12;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        push(quad(x, c.x1, c.x, t), quad(y, c.y1, c.y, t));
      }
      x = c.x;
      y = c.y;
    } else if (c.t === "Z") {
      const dist = Math.hypot(sx - x, sy - y);
      const n = Math.max(1, Math.ceil(dist / density));
      for (let i = 1; i <= n; i++) push(x + ((sx - x) * i) / n, y + ((sy - y) * i) / n);
      x = sx;
      y = sy;
    }
  }
  return pts;
}

export function strokeCanvasPath(ctx, d, mapPt) {
  const cmds = parsePath(d);
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  ctx.beginPath();
  for (const c of cmds) {
    if (c.t === "M") {
      const p = mapPt(c.x, c.y);
      ctx.moveTo(p.x, p.y);
      x = c.x;
      y = c.y;
      sx = x;
      sy = y;
    } else if (c.t === "L") {
      const p = mapPt(c.x, c.y);
      ctx.lineTo(p.x, p.y);
      x = c.x;
      y = c.y;
    } else if (c.t === "C") {
      const p1 = mapPt(c.x1, c.y1);
      const p2 = mapPt(c.x2, c.y2);
      const p = mapPt(c.x, c.y);
      ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p.x, p.y);
      x = c.x;
      y = c.y;
    } else if (c.t === "Q") {
      const p1 = mapPt(c.x1, c.y1);
      const p = mapPt(c.x, c.y);
      ctx.quadraticCurveTo(p1.x, p1.y, p.x, p.y);
      x = c.x;
      y = c.y;
    } else if (c.t === "Z") {
      ctx.closePath();
      x = sx;
      y = sy;
    }
  }
  ctx.stroke();
}
