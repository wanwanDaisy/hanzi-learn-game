const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});vm.runInContext(fs.readFileSync('js/digit-recognizer.js','utf8').replace(/export /g,''),context);
const {recognizeDigit,DIGIT_TEMPLATES}=vm.runInContext('({recognizeDigit,DIGIT_TEMPLATES})',context);
for(const template of DIGIT_TEMPLATES){
  const translated=template.strokes.map(stroke=>stroke.map(([x,y])=>[x*1.5+33,y*1.5+20]));
  assert.equal(recognizeDigit(translated),template.digit,`scaled digit ${template.digit}`);
  assert.equal(recognizeDigit(translated.map(stroke=>stroke.slice().reverse()).reverse()),template.digit,`reverse strokes ${template.digit}`);
}
assert.equal(recognizeDigit([]),null);assert.equal(recognizeDigit([[[2,2]]]),null);assert.equal(recognizeDigit([[[2,2],[3,4]]]),null);
const scribble=[Array.from({length:100},(_,i)=>[i%2?100:0,i])];assert.equal(recognizeDigit(scribble),null);
console.log('PASS: 0–9 variants, scale, translation, reversed strokes, empty, dots and scribbles');
// Uneven aspect ratios and leaning handwriting must not be rejected.
for(const template of DIGIT_TEMPLATES){
  for(const width of [.55,1.6]){
    const ink=template.strokes.map(stroke=>stroke.map(([x,y])=>[30+x*width+.12*y,25+y*1.2]));
    assert.equal(recognizeDigit(ink),template.digit,`uneven digit ${template.digit}, width ${width}`);
  }
}
// Independently drawn, unevenly sampled writing rather than template copies.
const examples=[
 [0,[[[40,12],[20,24],[16,55],[25,82],[44,91],[61,77],[65,50],[60,22],[40,12]]]],
 [1,[[[49,20],[48,42],[46,79],[45,103]]]],
 [7,[[[16,19],[36,17],[68,20],[61,32],[49,52],[35,87]]]],
 [4,[[[28,12],[24,35],[21,62],[73,60]],[[57,15],[58,45],[60,95]]]]
];
for(const [digit,ink] of examples)assert.equal(recognizeDigit(ink),digit,`independent ${digit}`);
console.log('PASS: narrow/wide/leaning handwriting and independent examples');
for(const sample of require('./handwriting-samples.cjs')){
  assert.equal(recognizeDigit(sample.strokes),sample.digit,sample.name);
  assert.equal(recognizeDigit(sample.strokes.map(s=>s.slice().reverse()).reverse()),sample.digit,`${sample.name} reversed`);
}
console.log('PASS: four user screenshot regressions');
