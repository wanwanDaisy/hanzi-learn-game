/** 四线三格拼音描红 + 笔顺演示 */

import {
  parsePinyinUnits,
  layoutUnits,
  TONE_PATHS,
  samplePath,
  strokeCanvasPath,
} from "./pinyinGlyphs.js?v=20260824d";

function pointerPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const src = event.touches ? event.touches[0] : event;
  if (!src) return null;
  return {
    x: (src.clientX - rect.left) * (canvas.width / rect.width),
    y: (src.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function toUmlaut(text) {
  return String(text || "").replace(/v/g, "ü").replace(/V/g, "Ü");
}

const KAI_STACK = '"LXGW WenKai", "STKaiti", "KaiTi", "Kaiti SC", serif';

/** 读音关：用楷体把拼音写在四线三格基线上 */
export function paintPinyinKai(ctx, text, { color = "#1a2332" } = {}) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const src = toUmlaut(text);
  if (!src) return;
  const top = h * 0.08;
  const band = (h * 0.84) / 3;
  const baseline = top + band * 2;
  let fontSize = band * 1.92;
  ctx.font = `${fontSize}px ${KAI_STACK}`;
  const maxW = w * 0.86;
  const tw = ctx.measureText(src).width;
  if (tw > maxW) fontSize *= maxW / Math.max(tw, 1);
  ctx.font = `${fontSize}px ${KAI_STACK}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(src, w / 2, baseline);
}

/** 在已按设备像素设好宽高的 canvas 上画出四线三格拼音字形 */
export function paintPinyinGlyphs(ctx, text, { color = "#1e3a34" } = {}) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const src = toUmlaut(text);
  if (!src) return;
  const top = h * 0.08;
  const band = (h * 0.84) / 3;
  const layout = layoutUnits(parsePinyinUnits(src));
  const inner = w * 0.86;
  let scaleX = band;
  if (layout.width * scaleX > inner) scaleX = inner / Math.max(layout.width, 0.01);
  const originX = (w - layout.width * scaleX) / 2;
  const mapper = (ox) => (x, y) => ({
    x: originX + (ox + x) * scaleX,
    y: top + y * band,
  });
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3.2, band * 0.15);
  for (const item of layout.items) {
    const map = mapper(item.x);
    for (const d of item.strokes) strokeCanvasPath(ctx, d, map);
    if (item.tone && TONE_PATHS[item.tone]) {
      const ox = item.x + (item.w - 0.68) / 2;
      strokeCanvasPath(ctx, TONE_PATHS[item.tone], mapper(ox));
    }
  }
}

/** 读音关只看不写的四线三格字模 */
export class PinyinGlyphPreview {
  constructor(el) {
    this.el = el;
    this.text = "";
    this.canvas = document.createElement("canvas");
    this.canvas.className = "syl-glyph";
    const lines = document.createElement("div");
    lines.className = "four-line";
    lines.setAttribute("aria-hidden", "true");
    lines.innerHTML = "<span></span><span></span><span></span><span></span>";
    el.innerHTML = "";
    el.append(lines, this.canvas);
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(el);
    document.fonts?.load?.(`48px ${KAI_STACK}`).then(() => this.draw());
    document.fonts?.ready?.then(() => this.draw());
  }

  setText(text) {
    this.text = toUmlaut(text || "");
    this.el.setAttribute("aria-label", this.text || "");
    this.draw();
  }

  draw() {
    const rect = this.el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    paintPinyinKai(this.canvas.getContext("2d"), this.text);
  }

  destroy() {
    this.ro?.disconnect();
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class PinyinSlot {
  constructor(root, { label, text }) {
    this.root = root;
    this.label = label;
    this.text = text;
    this.strokes = [];
    this.current = null;
    this.dpr = 1;
    this._drawing = false;
    this._demoing = false;
    this._demoGen = 0;

    root.innerHTML = `
      <div class="pinyin-row-head">
        <span class="pinyin-row-label">${label}</span>
        <div class="pinyin-row-actions">
          <button type="button" class="btn ghost sm pinyin-demo">演示</button>
          <button type="button" class="btn ghost sm pinyin-clear">重写</button>
        </div>
      </div>
      <div class="pinyin-slot" aria-label="${label}四线三格">
        <div class="four-line" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
        <canvas class="pinyin-model"></canvas>
        <canvas class="pinyin-demo-layer"></canvas>
        <canvas class="pinyin-ink"></canvas>
      </div>
    `;

    this.box = root.querySelector(".pinyin-slot");
    this.model = root.querySelector(".pinyin-model");
    this.demoLayer = root.querySelector(".pinyin-demo-layer");
    this.ink = root.querySelector(".pinyin-ink");
    this.demoBtn = root.querySelector(".pinyin-demo");
    root.querySelector(".pinyin-clear").addEventListener("click", () => this.clear());
    this.demoBtn.addEventListener("click", () => this.playDemo());

    this.ink.addEventListener("pointerdown", (e) => this.onStart(e));
    this.ink.addEventListener("pointermove", (e) => this.onMove(e));
    this.ink.addEventListener("pointerup", (e) => this.onEnd(e));
    this.ink.addEventListener("pointercancel", (e) => this.onEnd(e));
    this.ink.addEventListener("pointerleave", (e) => this.onEnd(e));

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.box);
    this.resize();
  }

  metrics() {
    const w = this.model.width;
    const h = this.model.height;
    const top = h * 0.08;
    const band = (h * 0.84) / 3;
    const layout = layoutUnits(parsePinyinUnits(this.text));
    const inner = w * 0.9;
    let scaleX = band;
    if (layout.width * scaleX > inner) scaleX = inner / Math.max(layout.width, 0.01);
    const originX = (w - layout.width * scaleX) / 2;
    return { w, h, top, band, scaleX, originX, layout };
  }

  mapper(m, ox = 0) {
    return (x, y) => ({
      x: m.originX + (ox + x) * m.scaleX,
      y: m.top + y * m.band,
    });
  }

  collectPaths(m) {
    const paths = [];
    for (const item of m.layout.items) {
      for (const d of item.strokes) {
        paths.push(samplePath(d).map((p) => this.mapper(m, item.x)(p.x, p.y)));
      }
      if (item.tone && TONE_PATHS[item.tone]) {
        const ox = item.x + (item.w - 0.68) / 2;
        paths.push(samplePath(TONE_PATHS[item.tone]).map((p) => this.mapper(m, ox)(p.x, p.y)));
      }
    }
    return paths;
  }

  resize() {
    const rect = this.box.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.dpr = dpr;
    for (const canvas of [this.model, this.demoLayer, this.ink]) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    this.drawModel();
    this.redrawInk();
    this.clearDemoLayer();
  }

  drawModel() {
    const ctx = this.model.getContext("2d");
    paintPinyinGlyphs(ctx, this.text, { color: "rgba(47, 122, 107, 0.34)" });
  }

  clearDemoLayer() {
    const ctx = this.demoLayer.getContext("2d");
    ctx.clearRect(0, 0, this.demoLayer.width, this.demoLayer.height);
  }

  paintDemo(done, partial) {
    const ctx = this.demoLayer.getContext("2d");
    const m = this.metrics();
    ctx.clearRect(0, 0, this.demoLayer.width, this.demoLayer.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = Math.max(4, m.band * 0.15);
    const strokePts = (pts) => {
      if (!pts || pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    };
    done.forEach(strokePts);
    strokePts(partial);
  }

  redrawInk() {
    const ctx = this.ink.getContext("2d");
    ctx.clearRect(0, 0, this.ink.width, this.ink.height);
    ctx.strokeStyle = "#1a2332";
    ctx.lineWidth = Math.max(4.5, 5.5 * this.dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of this.strokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
  }

  onStart(e) {
    if (this._demoing) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    this.ink.setPointerCapture?.(e.pointerId);
    const pt = pointerPoint(e, this.ink);
    if (!pt) return;
    this._drawing = true;
    this.current = [pt];
    this.strokes.push(this.current);
  }

  onMove(e) {
    if (!this._drawing || !this.current) return;
    e.preventDefault();
    const pt = pointerPoint(e, this.ink);
    if (!pt) return;
    this.current.push(pt);
    this.redrawInk();
  }

  onEnd(e) {
    if (!this._drawing) return;
    e.preventDefault();
    this._drawing = false;
    this.current = null;
    this.redrawInk();
  }

  clear() {
    this._demoGen += 1;
    this._demoing = false;
    this.strokes = [];
    this.current = null;
    this._drawing = false;
    this.redrawInk();
    this.clearDemoLayer();
    if (this.demoBtn) this.demoBtn.disabled = false;
  }

  async playDemo() {
    if (this._demoing) return;
    const gen = ++this._demoGen;
    this._demoing = true;
    if (this.demoBtn) this.demoBtn.disabled = true;
    this.clearDemoLayer();

    const m = this.metrics();
    const paths = this.collectPaths(m);
    const done = [];
    for (const pts of paths) {
      if (gen !== this._demoGen) return;
      await this.animateStroke(done, pts, gen);
      done.push(pts);
      if (gen !== this._demoGen) return;
      await wait(80);
    }
    if (gen !== this._demoGen) return;
    await wait(450);
    if (gen !== this._demoGen) return;
    this.clearDemoLayer();
    this._demoing = false;
    if (this.demoBtn) this.demoBtn.disabled = false;
  }

  animateStroke(done, pts, gen) {
    if (!pts || pts.length < 2) return Promise.resolve();
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const duration = Math.max(260, Math.min(860, len * 0.42));
    const t0 = performance.now();
    return new Promise((resolve) => {
      const tick = (now) => {
        if (gen !== this._demoGen) return resolve();
        const p = Math.min(1, (now - t0) / duration);
        const target = 1 + (pts.length - 1) * p;
        const last = Math.min(pts.length - 1, Math.floor(target));
        const partial = pts.slice(0, last + 1);
        if (last < pts.length - 1) {
          const t = target - last;
          const a = pts[last];
          const b = pts[last + 1];
          partial.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
        this.paintDemo(done, partial);
        if (p < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  hasInk() {
    let len = 0;
    for (const stroke of this.strokes) {
      for (let i = 1; i < stroke.length; i++) {
        len += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
      }
    }
    return len > 90 * this.dpr;
  }

  destroy() {
    this._demoGen += 1;
    this.ro?.disconnect();
  }
}

export class PinyinWriter {
  constructor(container) {
    this.container = container;
    this.slots = [];
  }

  setup({ initial, final, full }) {
    this.destroy();
    const rows = [];
    if (initial) rows.push({ key: "initial", label: "声母", text: toUmlaut(initial) });
    if (final) rows.push({ key: "final", label: "韵母", text: toUmlaut(final) });
    rows.push({ key: "full", label: "整字", text: toUmlaut(full) });

    this.container.innerHTML = rows
      .map((row) => `<div class="pinyin-row" data-key="${row.key}"></div>`)
      .join("");

    this.slots = rows.map((row) => {
      const el = this.container.querySelector(`[data-key="${row.key}"]`);
      return new PinyinSlot(el, row);
    });

    requestAnimationFrame(() => this.slots.forEach((s) => s.resize()));
  }

  allWritten() {
    return this.slots.length > 0 && this.slots.every((s) => s.hasInk());
  }

  async playDemo() {
    for (const slot of this.slots) await slot.playDemo();
  }

  destroy() {
    this.slots.forEach((s) => s.destroy());
    this.slots = [];
    this.container.innerHTML = "";
  }
}
