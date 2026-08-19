/** 笔画书写：引导层挂到 Hanzi Writer 同一坐标变换下，贴合字模 */

function getHanziWriter() {
  const HW = window.HanziWriter;
  if (!HW || typeof HW.create !== "function") {
    throw new Error("Hanzi Writer 未加载，请检查网络后刷新");
  }
  return HW;
}

export class StrokeBoard {
  constructor(targetEl, options = {}) {
    this.target = targetEl;
    this.onStrokeComplete = options.onStrokeComplete || (() => {});
    this.onProgress = options.onProgress || (() => {});
    this.onError = options.onError || (() => {});
    this.writer = null;
    this.char = "";
    this.strokeNames = [];
    this.charData = null;
    this.totalStrokes = 0;
    this.currentIndex = 0;
    this.mistakes = 0;
    this._demoing = false;
    this._seq = 0;
  }

  async setCharacter({ char, strokeNames = [] }) {
    const seq = ++this._seq;
    this.char = char;
    this.strokeNames = strokeNames.slice();
    this.currentIndex = 0;
    this.mistakes = 0;
    this._demoing = false;
    this.charData = null;

    try {
      const HW = getHanziWriter();

      if (this.writer) {
        try {
          this.writer.cancelQuiz();
        } catch {
          /* ignore */
        }
        this.writer = null;
      }

      this.target.innerHTML = "";

      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (seq !== this._seq) return;

      const size = Math.max(240, Math.min(360, Math.floor(this.target.clientWidth || 360)));
      const padding = 24;

      this.writer = HW.create(this.target, char, {
        width: size,
        height: size,
        padding,
        showOutline: true,
        showCharacter: false,
        strokeAnimationSpeed: 1.05,
        delayBetweenStrokes: 200,
        strokeColor: "#1a2332",
        outlineColor: "#cfd6de",
        drawingColor: "#2c3a4f",
        drawingWidth: 22,
        highlightColor: "#2f7a6b",
        highlightCompleteColor: "#3d9a87",
        showHintAfterMisses: 1,
        highlightOnComplete: true,
        leniency: 1.12,
      });

      try {
        this.charData = await HW.loadCharacterData(char);
        if (seq !== this._seq) return;
        this.totalStrokes = this.charData.strokes?.length || strokeNames.length || 0;
      } catch {
        this.totalStrokes = strokeNames.length || 0;
      }

      this.onProgress(0, this.totalStrokes, this._name(0));
      this._startQuiz(0);
    } catch (err) {
      console.error(err);
      this.onError(err);
    }
  }

  _name(i) {
    return this.strokeNames[i] || "";
  }

  /** 找到 Hanzi Writer 根变换组，引导与字模共用同一坐标系 */
  _attachGuideLayer() {
    const svg = this.target.querySelector("svg");
    if (!svg) return null;
    const root = [...svg.querySelectorAll(":scope > g")].find((g) =>
      (g.getAttribute("transform") || "").includes("scale")
    );
    if (!root) return null;

    let guide = root.querySelector("#zijijing-guide");
    if (!guide) {
      guide = document.createElementNS("http://www.w3.org/2000/svg", "g");
      guide.setAttribute("id", "zijijing-guide");
      guide.setAttribute("pointer-events", "none");
      root.appendChild(guide);
    }
    return guide;
  }

  _drawGuide(strokeIndex) {
    const g = this._attachGuideLayer();
    if (!g || !this.charData?.medians) return;
    g.innerHTML = "";
    if (strokeIndex < 0 || strokeIndex >= this.charData.medians.length) return;

    const median = this.charData.medians[strokeIndex];
    if (!median?.length) return;

    const d = median
      .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
      .join(" ");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#2f7a6b");
    path.setAttribute("stroke-width", "28");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-dasharray", "42 36");
    path.setAttribute("opacity", "0.82");
    path.classList.add("guide-path-char");
    g.appendChild(path);

    const midIdx = Math.max(1, Math.min(median.length - 1, Math.floor(median.length * 0.32)));
    const a = median[Math.max(0, midIdx - 1)];
    const b = median[midIdx];
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const len = 48;
    const wing = 0.5;
    const tip = b;
    const left = [
      tip[0] - len * Math.cos(angle - wing),
      tip[1] - len * Math.sin(angle - wing),
    ];
    const right = [
      tip[0] - len * Math.cos(angle + wing),
      tip[1] - len * Math.sin(angle + wing),
    ];
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    arrow.setAttribute(
      "points",
      `${tip[0]},${tip[1]} ${left[0]},${left[1]} ${right[0]},${right[1]}`
    );
    arrow.setAttribute("fill", "#2f7a6b");
    arrow.setAttribute("opacity", "0.9");
    g.appendChild(arrow);

    const start = median[0];
    const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ring.setAttribute("cx", start[0]);
    ring.setAttribute("cy", start[1]);
    ring.setAttribute("r", "46");
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "#b8433a");
    ring.setAttribute("stroke-width", "10");
    ring.classList.add("guide-pulse-char");
    g.appendChild(ring);

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", start[0]);
    dot.setAttribute("cy", start[1]);
    dot.setAttribute("r", "26");
    dot.setAttribute("fill", "#b8433a");
    g.appendChild(dot);

    const core = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    core.setAttribute("cx", start[0]);
    core.setAttribute("cy", start[1]);
    core.setAttribute("r", "10");
    core.setAttribute("fill", "#fff");
    g.appendChild(core);
  }

  _clearGuide() {
    const g = this._attachGuideLayer();
    if (g) g.innerHTML = "";
  }

  _flashStroke(strokeIndex) {
    if (!this.writer || strokeIndex < 0 || strokeIndex >= this.totalStrokes) return;
    try {
      this.writer.highlightStroke(strokeIndex, { strokeHighlightSpeed: 1.15 });
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => this._drawGuide(strokeIndex));
  }

  _startQuiz(fromStroke = 0) {
    if (!this.writer || this._demoing) return;
    this.currentIndex = fromStroke;
    this.onProgress(fromStroke, this.totalStrokes, this._name(fromStroke));

    try {
      this.writer.cancelQuiz();
    } catch {
      /* ignore */
    }

    this.writer.quiz({
      quizStartStrokeNum: fromStroke,
      showHintAfterMisses: 1,
      onCorrectStroke: (d) => {
        const next = (d.strokeNum ?? this.currentIndex) + 1;
        const total = d.strokeCount || this.totalStrokes;
        this.totalStrokes = total;
        this.currentIndex = next;
        this.onProgress(next, total, this._name(next));
        if (next < total) {
          setTimeout(() => {
            this._drawGuide(next);
            this._flashStroke(next);
          }, 120);
        } else {
          this._clearGuide();
        }
      },
      onMistake: () => {
        this.mistakes += 1;
        this._drawGuide(this.currentIndex);
        this._flashStroke(this.currentIndex);
        this.onStrokeComplete(false);
      },
      onComplete: () => {
        this.currentIndex = this.totalStrokes;
        this._clearGuide();
        this.onProgress(this.totalStrokes, this.totalStrokes, "");
        const score = Math.max(60, 100 - this.mistakes * 10);
        this.onStrokeComplete(true, score, false);
      },
    });

    // quiz() 会重建节点，启动后再画引导，确保贴合字模
    requestAnimationFrame(() => {
      this._drawGuide(fromStroke);
      setTimeout(() => this._flashStroke(fromStroke), 40);
    });
  }

  undo() {
    if (!this.writer || this.currentIndex <= 0 || this._demoing) return;
    this._startQuiz(this.currentIndex - 1);
  }

  clear() {
    if (!this.writer || this._demoing) return;
    try {
      this.writer.cancelQuiz();
    } catch {
      /* ignore */
    }
    this.writer.hideCharacter();
    this.writer.showOutline();
    this.mistakes = 0;
    this._startQuiz(0);
  }

  async playDemo() {
    if (!this.writer || this._demoing) return;
    this._demoing = true;
    this._clearGuide();
    try {
      this.writer.cancelQuiz();
    } catch {
      /* ignore */
    }
    this.writer.hideCharacter();
    this.writer.showOutline();
    this.currentIndex = 0;
    this.onProgress(0, this.totalStrokes, this._name(0));

    try {
      await this.writer.animateCharacter();
      this.currentIndex = this.totalStrokes;
      this.onProgress(this.totalStrokes, this.totalStrokes, "");
      this.onStrokeComplete(true, 0, true);
    } finally {
      this._demoing = false;
    }
  }
}
