// Run: NODE_PATH=<path containing playwright> node tests/check-review.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require('playwright');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('js/review-core.js','utf8').replace(/export /g,''),context);
const core = vm.runInContext('({knownCharacters,drawRound,needsPractice})',context);
const pool = Array.from({length:8},(_,i)=>({id:String(i)}));
assert.equal(core.knownCharacters(pool,['1','1','3','missing']).length,2);
assert.equal(core.knownCharacters(pool,{}).length,0);
assert.equal(core.drawRound(pool).length,5);
assert.equal(core.drawRound([pool[0],pool[0]]).length,1);
assert.equal(core.drawRound([]).length,0);
assert.equal(core.needsPractice({reading:true,writing:null}),true);
assert.equal(core.needsPractice({reading:true,writing:true}),false);
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:375,height:812}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Deterministic writer lets us exercise scoring, retry and stale-load callbacks.
 await page.route('**/hanzi-writer.min.js',route=>route.fulfill({contentType:'text/javascript',body:`
 window.HanziWriter={loadCharacterData:()=>window.failLoad?Promise.reject(Error('offline')):Promise.resolve({strokes:['one']}),create:(el,c,opts)=>{window.writerOptions=opts;el.innerHTML='<svg></svg>';return {quiz:cb=>window.quizCallbacks=cb,cancelQuiz(){},showOutline(){window.usedOutline=true},hideCharacter(){}}}};
 `}));
 await page.goto('http://127.0.0.1:8767/review.html');
 assert(await page.locator('#review-start').isDisabled());
 const ids=await page.evaluate(async()=> (await import('./js/data.js?v=20261013a')).CHARACTERS.slice(0,2).map(c=>c.id));
 await page.evaluate(ids=>localStorage.setItem('zijijing-progress-v2',JSON.stringify(ids)),ids);
 await page.reload();await page.click('#review-start');
 assert(await page.locator('#review-answer').isHidden());
 assert.equal(await page.locator('#review-pinyin').textContent(),'');
 await page.click('#review-reveal');await page.click('#review-read-pass');
 await page.waitForFunction(()=>!!window.quizCallbacks);
 assert.equal(await page.evaluate(()=>window.writerOptions.showOutline),false);
 assert.equal(await page.evaluate(()=>window.writerOptions.showHintAfterMisses),false);
 assert(await page.locator('#review-next').isDisabled());
 await page.click('#review-hint');await page.click('#review-reset');
 await page.evaluate(()=>window.quizCallbacks.onComplete());await page.click('#review-next');
 await page.click('#review-reveal');await page.click('#review-read-retry');
 await page.waitForFunction(()=>!document.getElementById('review-reset').disabled);
 await page.evaluate(()=>window.quizCallbacks.onComplete());await page.click('#review-next');
 assert(await page.locator('#review-result').isVisible());
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zijijing-review-v1')));
 assert.equal(saved[0].results.length,2);
 assert.equal(saved[0].results[0].writing,false);assert.equal(saved[0].results[1].reading,false);
 assert.equal(saved[0].results[1].writing,true);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('zijijing-progress-v2'))),ids);
 await page.click('#review-retry');assert(await page.locator('#review-reading').isVisible());
 await page.click('#review-exit');assert(await page.locator('#review-history').isVisible());
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zijijing-review-v1')).length),1);
 await page.evaluate(()=>window.failLoad=true);await page.click('#review-start');await page.click('#review-reveal');await page.click('#review-read-pass');
 await page.waitForSelector('#review-load',{state:'visible'});assert(await page.locator('#review-next').isDisabled());
 await page.click('#review-skip');await page.click('#review-reveal');await page.click('#review-read-pass');await page.click('#review-skip');
 saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zijijing-review-v1')));
 assert(saved[0].results.every(r=>r.writing===null));
 await page.locator('.home-link').first().click();
 await page.waitForSelector('#screen-select.active');
 assert(await page.locator('a[href="review.html"]').isVisible());
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);
 console.log('PASS: sampling, empty state, hidden answers, independent reading/writing results, hints and reset, load failure, skip, retry, persistence, exit, return link, mobile layout.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
