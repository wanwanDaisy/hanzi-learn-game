import { CHARACTERS } from './data.js?v=20261013a';
import { speakCharacter, stopDemoAudio } from './pronounce.js?v=20261016resume';
import { REVIEW_KEY, knownCharacters, drawRound, needsPractice } from './review-core.js?v=20261014a';
const $ = id => document.getElementById(id);
let pool = [], round = [], results = [], index = 0, phase = 'setup';
let writer = null, generation = 0, writingClean = true, writingDone = false;
let reading = false, history = [], audioBusy = false;
function readStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { $('review-storage').textContent = '无法读取本地记录，请在允许保存网站数据的浏览器中打开。'; return fallback; }
}
function stop() {
  generation++;
  stopDemoAudio();
  writer?.cancelQuiz();
  writer = null;
  $('review-board').innerHTML = '';
}
function screen(name) {
  for (const part of ['setup', 'play', 'result']) $('review-' + part).hidden = part !== name;
}
function setup() {
  stop(); phase = 'setup'; screen('setup');
  pool = knownCharacters(CHARACTERS, readStorage('zijijing-progress-v2', []));
  const saved = readStorage(REVIEW_KEY, []);
  history = Array.isArray(saved) ? saved.filter(r => r && Array.isArray(r.results) && r.results.length && r.results.every(x => x && CHARACTERS.some(c => c.id === x.id) && typeof x.reading === 'boolean' && (typeof x.writing === 'boolean' || x.writing === null))) : [];
  $('review-pool').textContent = pool.length ? `你已经通关 ${pool.length} 个字，这一轮抽 ${Math.min(5, pool.length)} 个。` : '还没有通关记录。先完成一个字的学习，就能来考核啦！';
  $('review-start').disabled = !pool.length;
  $('review-learn').hidden = !!pool.length;
  const last = history[0];
  $('review-history').hidden = !last;
  if (last) {
    const count = last.results.filter(r => !needsPractice(r)).length;
    const weak = last.results.filter(needsPractice).map(r => CHARACTERS.find(c => c.id === r.id).char).join('、');
    $('review-history').textContent = `上次考核：${count} / ${last.results.length} 个字读写都掌握了。${weak ? '需要巩固：' + weak + '。' : ''}`;
  }
}
function start(source = pool) {
  round = drawRound(source); if (!round.length) return;
  results = []; index = 0; showReading();
}
function showReading() {
  stop(); phase = 'reading'; screen('play');
  const c = round[index];
  $('review-round').textContent = `${index + 1} / ${round.length}`;
  $('review-stage').textContent = '① 👄';
  $('review-reading').hidden = false;
  $('review-writing').hidden = true;
  $('review-answer').hidden = true;
  $('review-reveal').hidden = false;
  $('review-char').textContent = c.char;
  // Do not leave a previous answer in hidden content or accessibility names.
  $('review-pinyin').textContent = ''; $('review-word').textContent = '';
  $('review-feedback').textContent = '';
  $('review-next').textContent = index === round.length - 1 ? '✓' : '→';
  $('review-next').setAttribute('aria-label', index === round.length - 1 ? '完成考核' : '下一字');
  $('review-next').title = $('review-next').getAttribute('aria-label');
  $('review-reveal').focus();
}
function reveal() {
  if (phase !== 'reading') return;
  const c = round[index];
  $('review-pinyin').textContent = c.pinyin; $('review-word').textContent = c.meaning;
  $('review-answer').hidden = false; $('review-reveal').hidden = true;
}
async function audio() {
  if (phase !== 'reading' || $('review-answer').hidden || audioBusy) return;
  const seq = generation;
  audioBusy = true; $('review-audio').disabled = true;
  // Keep navigation disabled while the existing TTS helper waits for voices.
  for (const id of ['review-read-pass', 'review-read-retry', 'review-exit']) $(id).disabled = true;
  try {
    const ok = await speakCharacter(round[index].char, round[index].pinyin);
    if (!ok && seq === generation) $('review-feedback').textContent = '此设备暂时无法播放，请家长按拼音核对。';
  } catch { if (seq === generation) $('review-feedback').textContent = '播放失败，请家长按拼音核对。'; }
  finally {
    audioBusy = false; $('review-audio').disabled = false;
    for (const id of ['review-read-pass', 'review-read-retry', 'review-exit']) $(id).disabled = false;
  }
}
function showWriting(passed) {
  if (phase !== 'reading' || $('review-answer').hidden || audioBusy) return;
  reading = passed; writingClean = true; writingDone = false;
  phase = 'writing'; $('review-reading').hidden = true; $('review-writing').hidden = false;
  $('review-stage').textContent = '② ✏️'; $('review-feedback').textContent = '';
  loadBoard();
}
async function loadBoard() {
  stop(); const seq = generation;
  $('review-next').disabled = true;
  $('review-hint').disabled = true; $('review-reset').disabled = true;
  $('review-load').hidden = true; $('review-board').classList.add('loading');
  $('review-write-status').textContent = '⌛ 准备中';
  try {
    const HW = window.HanziWriter;
    if (!HW) throw new Error('Writer unavailable');
    // Load once, with a bounded wait, then provide data directly to the writer.
    const data = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 12000);
      HW.loadCharacterData(round[index].char).then(d => {clearTimeout(timeout); resolve(d);}, e => {clearTimeout(timeout); reject(e);});
    });
    if (seq !== generation || phase !== 'writing') return;
    const size = $('review-board').clientWidth;
    writer = HW.create($('review-board'), round[index].char, {
      width: size, height: size, padding: 22, showOutline: false, showCharacter: false,
      strokeColor: '#285c43', drawingColor: '#285c43', outlineColor: '#cddcc5',
      drawingWidth: 18, leniency: 1, showHintAfterMisses: false,
      highlightOnComplete: false, charDataLoader: (_char, onLoad) => onLoad(data),
    });
    $('review-board').classList.remove('loading');
    $('review-hint').disabled = false; $('review-reset').disabled = false;
    $('review-write-status').textContent = '✏️ 开始吧';
    beginQuiz(seq);
  } catch {
    if (seq !== generation || phase !== 'writing') return;
    $('review-write-status').textContent = '字模未能加载，请检查网络后重试。也可以跳过，记录为“未检查书写”。';
    $('review-load').hidden = false;
  }
}
function beginQuiz(seq) {
  writingDone = false; $('review-next').disabled = true;
  writer.quiz({ showHintAfterMisses: false, highlightOnComplete: false,
    onMistake() {
      if (seq !== generation || phase !== 'writing') return;
      writingClean = false;
      $('review-write-status').textContent = '↻ 再试一笔';
    },
    onCorrectStroke(d) {
      if (seq !== generation || phase !== 'writing') return;
      $('review-write-status').textContent = `已完成 ${d.strokeNum + 1} 笔，继续加油！`;
    },
    onComplete() {
      if (seq !== generation || phase !== 'writing') return;
      writingDone = true; $('review-next').disabled = false;
      $('review-hint').disabled = true; $('review-reset').disabled = true;
      $('review-write-status').textContent = writingClean ? '👍 ⭐' : '👍 再练一练';
    }
  });
}
function next(skipped = false) {
  if (phase !== 'writing' || (!skipped && !writingDone)) return;
  results.push({ id: round[index].id, reading, writing: skipped ? null : writingClean, checkedAt: new Date().toISOString() });
  if (++index < round.length) showReading(); else finish();
}
function renderResults() {
  const ul = $('review-results'); ul.replaceChildren();
  for (const r of results) {
    const c = CHARACTERS.find(c => c.id === r.id);
    const li = document.createElement('li'), glyph = document.createElement('b'), detail = document.createElement('span');
    glyph.textContent = c.char;
    detail.textContent = `读音：${r.reading ? '已掌握' : '再练一练'} · 书写：${r.writing === null ? '未检查' : r.writing ? '已掌握' : '再练一练'}`;
    li.append(glyph, detail); ul.append(li);
  }
}
function finish() {
  stop(); phase = 'result'; screen('result');
  history.unshift({ completedAt: new Date().toISOString(), results: results.slice() });
  history = history.slice(0, 20);
  try { localStorage.setItem(REVIEW_KEY, JSON.stringify(history)); }
  catch { $('review-storage').textContent = '本次结果无法保存，可先查看下面的结果；原有识字记录未修改。'; }
  const mastered = results.filter(r => !needsPractice(r)).length;
  $('review-summary').textContent = `完成 ${results.length} 个字，${mastered} 个字读写都掌握了。${mastered === results.length ? '保持练习，记得更牢！' : '剩下的字，下次再来试试。'}`;
  $('review-retry').hidden = mastered === results.length;
  renderResults(); $('review-again').focus();
}
$('review-start').onclick = () => start();
$('review-reveal').onclick = reveal;
$('review-audio').onclick = audio;
$('review-read-pass').onclick = () => showWriting(true);
$('review-read-retry').onclick = () => showWriting(false);
$('review-hint').onclick = () => {
  if (!writer || writingDone) return;
  writingClean = false; writer.showOutline();
  $('review-write-status').textContent = '💡 跟着写';
};
$('review-reset').onclick = () => {
  if (!writer || writingDone) return;
  writingClean = false; writer.cancelQuiz(); writer.hideCharacter();
  beginQuiz(generation); $('review-write-status').textContent = '↻ 重新写';
};
$('review-load').onclick = loadBoard;
$('review-next').onclick = () => next();
$('review-skip').onclick = () => next(true);
$('review-exit').onclick = setup;
$('review-again').onclick = () => {setup(); start();};
$('review-retry').onclick = () => start(results.filter(needsPractice).map(r => CHARACTERS.find(c => c.id === r.id)));
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', event => { if (event.persisted) setup(); });
setup();
