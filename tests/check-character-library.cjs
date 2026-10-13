// Run with node tests/check-character-library.cjs (no npm dependencies).
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({});
for (const file of ['js/characters-extra.js', 'js/data.js', 'js/examples.js']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
    .replace(/^import .*;\n/gm, '').replace(/export /g, '');
  vm.runInContext(source, context, { filename: file });
}
const all = vm.runInContext('CHARACTERS', context);
const original = vm.runInContext('CHARACTERS_RAW.filter(c => !LIGHT_TONE_CHARS.has(c.char) && isChartSyllable(c.pinyin))', context);
assert.equal(all.length, 1000);
assert.equal(new Set(all.map(c => c.char)).size, 1000);
assert.equal(new Set(all.map(c => c.id)).size, 1000);
assert.equal(original.length, 300);
for (const c of original) assert.ok(all.includes(c), `Original character replaced: ${c.char}`);
for (let i = 0; i < all.length; i++) {
  const c = all[i];
  assert.match(c.char, /^[\u4e00-\u9fff]$/u);
  assert.match(c.pinyin, /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/u, `Missing tone: ${c.char}`);
  const examples = vm.runInContext(`getExamples(${JSON.stringify(c.char)})`, context);
  assert.ok(examples.length >= 1 && examples.length <= 2);
  for (const sentence of examples) {
    assert.ok(sentence.includes(c.char), `Target missing: ${c.char}`);
    assert.ok(!sentence.startsWith('我认识「'), `Fallback only: ${c.char}`);
  }
  if (i > 0) assert.ok(vm.runInContext(`compareXinhua(CHARACTERS[${i-1}], CHARACTERS[${i}])`, context) <= 0);
}
console.log('PASS: 1000 unique characters, original 300 preserved, tone marks, examples and A–Z ordering.');
