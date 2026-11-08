import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {GameEngine,LEVELS,SKINS} from './dist/engine.js';
// UI event wiring / migration checks. This does not replace real browser visual QA.
class Element{
 constructor(id){this.id=id;this.textContent='';this.innerHTML='';this.style={setProperty(k,v){this[k]=v;}};this.disabled=false;this.clientWidth=390;this.listeners={};const set=new Set();this.classList={add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x),toggle:(x,v)=>v?set.add(x):set.delete(x)};}
 addEventListener(n,f){this.listeners[n]=f;}setAttribute(){}focus(){}setPointerCapture(){}querySelectorAll(){return[];}querySelector(){return new Element('action');}
}
class SilentAudio{unlock(){}setMuted(){}play(){}update(){}}
const html=readFileSync('index.template.html','utf8');
const source=readFileSync('dist/app.js','utf8').replace(/^import .+$/gm,'')+'\n;this.test={get engine(){return engine},get saved(){return saved},get selected(){return selected},get joy(){return joy},start,toHome,showSkins,showLevels,showSettings,updateHome,mergeProgress,normaliseSave,applySettings};';
function boot(initial){
 const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
 const memory=new Map();if(initial)memory.set('nightstrike-save-v1',JSON.stringify(initial));let callback,time=0;
 const sandbox={GameEngine,LEVELS,SKINS,GameAudio:SilentAudio,StadiumRenderer:class{render(){}setOptions(){}burst(){}},document:{getElementById:id=>{assert.ok(elements[id],`Missing DOM id ${id}`);return elements[id];},body:new Element('body'),addEventListener(){}},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},requestAnimationFrame:f=>callback=f,performance:{now:()=>time},setTimeout:()=>1,clearTimeout(){},addEventListener(){},console,innerWidth:390};
 vm.createContext(sandbox);vm.runInContext(source,sandbox);
 return {api:sandbox.test,elements,memory,frame:()=>{time+=16;callback(time);},click:dataset=>elements.modalContent.listeners.click({target:{closest:()=>({dataset})}})};
}
const app=boot();const {api,elements,memory,frame,click}=app;
assert.ok(elements.boot.classList.contains('hidden'));assert.equal(api.saved.stars.length,15);
elements.play.onclick();const g=api.engine;assert.equal(g.state.mode,'playing');
g.state.runCoins=12;g.state.tricks=3;g.finish(true);frame();
let stored=JSON.parse(memory.get('nightstrike-save-v1'));
assert.equal(stored.coins,62);assert.equal(stored.stars[0],3);assert.equal(stored.unlocked,1);
assert.ok(elements.modalContent.innerHTML.includes('WHAT A FINISH.'));
frame();assert.equal(api.saved.coins,62,'Reward repeated on render');
api.start(1);assert.equal(g.state.mode,'playing');assert.equal(g.state.lives,3);assert.equal(g.state.tricks,0);
api.toHome();api.showSkins();click({skin:'mint'});assert.equal(api.saved.coins,62);assert.equal(api.saved.owned.includes('mint'),false);
api.saved.coins=100;click({skin:'mint'});assert.equal(api.saved.coins,10);assert.equal(api.saved.skin,'mint');assert.equal(g.state.skin,'mint');click({skin:'mint'});assert.equal(api.saved.coins,10);
// Five-stage saves must retain all earned content and continue directly at stage six.
const legacy=boot({coins:212,stars:[3,2,1,3,3],unlocked:4,owned:['classic','mint'],skin:'mint',muted:true});
assert.equal(legacy.api.saved.coins,212);assert.equal(legacy.api.saved.stars.length,15);assert.equal(legacy.api.saved.stars.slice(0,5).join(','),'3,2,1,3,3');assert.ok(legacy.api.saved.stars.slice(5).every(s=>s===0));assert.equal(legacy.api.saved.unlocked,5);assert.equal(legacy.api.selected,5);assert.equal(legacy.api.engine.state.skin,'mint');assert.equal(legacy.api.saved.muted,true);
legacy.api.showLevels(1);assert.ok(legacy.elements.modalContent.innerHTML.includes('City Circuit'));assert.equal((legacy.elements.modalContent.innerHTML.match(/data-level=/g)||[]).length,5);assert.ok(legacy.elements.modalContent.innerHTML.includes('12 / 45 ★'));
legacy.click({chapter:'2'});assert.ok(legacy.elements.modalContent.innerHTML.includes('data-level="14"'));
legacy.click({level:'14'});assert.equal(legacy.api.selected,5,'Locked stage selection must be rejected');
// Every new stage can be unlocked by the preceding win, and only stage 15 ends the campaign.
for(let i=5;i<15;i++){
 legacy.api.start(i);const s=legacy.api.engine.state;s.tricks=LEVELS[i].trickTarget;legacy.api.engine.finish(true);legacy.frame();
 assert.equal(legacy.api.saved.unlocked,Math.min(14,i+1));assert.equal(legacy.api.saved.stars[i],3);
 assert.equal(s.result.allComplete,i===14);
 if(i<14)assert.ok(legacy.elements.modalContent.innerHTML.includes('NEXT CHALLENGE'));
}
assert.ok(legacy.elements.modalContent.innerHTML.includes('ALL 15 STAGES COMPLETE'));
legacy.api.toHome();assert.ok(legacy.elements.nextNumber.innerHTML.includes('/ 15'));
console.log('PASS — controls/rewards/skin economy; legacy-save migration; chapter navigation; all 15 unlocks; final completion.');

const prefs=boot({coins:75,stars:[3,0],unlocked:1,owned:['classic','mint'],skin:'mint',settings:{quality:'low',control:'stick',camera:'chase',sensitivity:1.4,reducedMotion:true}});
prefs.api.showSettings();
assert.ok(prefs.elements.modalContent.innerHTML.includes('EXPORT PROGRESS'));
assert.ok(prefs.elements.modalContent.innerHTML.includes('Large thumbstick'));
prefs.api.mergeProgress({game:'nightstrike',version:3,progress:{coins:40,stars:[0,3],owned:['classic','gold'],skin:'gold',bestStreak:7,settings:{quality:'high'}}});
assert.equal(prefs.api.saved.coins,75,'Import must not add both wallets');
assert.equal(prefs.api.saved.unlocked,2,'Combined stars unlock the next stage');
assert.equal(prefs.api.saved.stars.slice(0,3).join(','),'3,3,0');
assert.equal(prefs.api.saved.owned.join(','),'classic,mint,gold');
assert.equal(prefs.api.saved.settings.quality,'low','Device preferences survive progress import');
assert.equal(prefs.api.saved.settings.sensitivity,1.4);
assert.equal(prefs.api.saved.bestStreak,7);
assert.equal(prefs.api.engine.state.skin,'gold');
assert.throws(()=>prefs.api.mergeProgress({game:'elsewhere',stars:[3],coins:100}));
assert.throws(()=>prefs.api.mergeProgress({progress:'wrong'}));
const clean=prefs.api.normaliseSave({coins:Infinity,stars:[99,-1,'3',null],unlocked:100,skin:'missing',owned:['missing','mint','mint'],settings:{quality:'ultra',control:'bad',camera:'fisheye',sensitivity:900}});
assert.equal(clean.coins,0);assert.equal(clean.stars.slice(0,4).join(','),'3,0,3,0');assert.equal(clean.unlocked,14);assert.equal(clean.skin,'classic');assert.equal(clean.owned.join(','),'classic,mint');assert.equal(clean.settings.quality,'auto');assert.equal(clean.settings.sensitivity,1.8);

prefs.api.start(2);
const pointer={pointerId:9,clientX:10,clientY:20,preventDefault(){}};
prefs.elements.joystick.listeners.pointerdown(pointer);
prefs.elements.joystick.listeners.pointermove({...pointer,clientX:90});
assert.equal(prefs.api.joy,1);
prefs.frame();prefs.frame();assert.ok(prefs.api.engine.inputX>0);
prefs.elements.joystick.listeners.pointercancel(pointer);assert.equal(prefs.api.joy,0);
prefs.elements.focus.listeners.pointerdown(pointer);prefs.frame();
assert.equal(prefs.api.engine.state.focusHeld,true);
prefs.elements.focus.listeners.lostpointercapture(pointer);
assert.equal(prefs.api.engine.state.focusHeld,false);
prefs.elements.focus.listeners.click({detail:0});assert.equal(prefs.api.engine.state.focusHeld,true);
prefs.api.showSettings();assert.equal(prefs.api.engine.state.mode,'paused');assert.equal(prefs.api.engine.state.focusHeld,false);assert.equal(prefs.api.joy,0);
console.log('PASS — settings, import merge/validation/migration, joystick cancellation, Focus pointer release and keyboard activation');
