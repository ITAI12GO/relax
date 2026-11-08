import {GameEngine, LEVELS, SKINS} from './engine.js';
import {StadiumRenderer} from './renderer.js';
import {GameAudio} from './audio.js';
const $=id=>document.getElementById(id);
const STORE='nightstrike-save-v1';
const prefersReduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const ARENAS=[{name:'EMERALD PARK',top:'#030d18',bottom:'#143f3b'},{name:'VIOLET DISTRICT',top:'#08091c',bottom:'#25294a'},{name:'GOLDEN CROWN',top:'#130e17',bottom:'#40321e'}];
const fresh=()=>({schemaVersion:3,coins:0,stars:Array(LEVELS.length).fill(0),unlocked:0,owned:['classic'],skin:'classic',muted:false,bestStreak:0,perfectGoals:0,settings:{control:'auto',quality:'auto',camera:'wide',sensitivity:1,reducedMotion:prefersReduced}});
const integer=(value,max=999999)=>Number.isFinite(Number(value))?Math.max(0,Math.min(max,Math.floor(Number(value)))):0;
function normaliseSave(raw){
 const v=fresh();if(!raw||typeof raw!=='object')return v;
 v.coins=integer(raw.coins);v.stars=Array.from({length:LEVELS.length},(_,i)=>integer(raw.stars?.[i],3));
 let completed=0;while(completed<LEVELS.length&&v.stars[completed]>0)completed++;
 v.unlocked=Math.min(LEVELS.length-1,Math.max(integer(raw.unlocked,LEVELS.length-1),completed));
 v.owned=[...new Set(['classic',...(Array.isArray(raw.owned)?raw.owned.filter(id=>SKINS.some(skin=>skin.id===id)):[])])];v.skin=v.owned.includes(raw.skin)?raw.skin:'classic';v.muted=raw.muted===true;v.bestStreak=integer(raw.bestStreak,999);v.perfectGoals=integer(raw.perfectGoals);
 for(const [key,allowed] of Object.entries({control:['auto','drag','stick'],quality:['auto','high','low'],camera:['wide','chase']}))if(allowed.includes(raw.settings?.[key]))v.settings[key]=raw.settings[key];
 const sensitivity=Number(raw.settings?.sensitivity);if(Number.isFinite(sensitivity))v.settings.sensitivity=Math.max(.6,Math.min(1.8,sensitivity));
 if(typeof raw.settings?.reducedMotion==='boolean')v.settings.reducedMotion=raw.settings.reducedMotion;
 return v;
}
let saved=fresh();try{saved=normaliseSave(JSON.parse(localStorage.getItem(STORE)));}catch{}
let storageWarning=false;
function save(){try{localStorage.setItem(STORE,JSON.stringify(saved));}catch{if(!storageWarning){storageWarning=true;notify('Progress is available for this session only.');}}}
const audio=new GameAudio();audio.setMuted(saved.muted);
let joy=0,joyPointer=null,lastHUD=0,warningUntil=0,renderer,engine=new GameEngine(onEvent),selected=saved.unlocked,modalKind='',journeyChapter=0,toastUntil=0,smallTimer,keys=new Set(),drag=null,last=0,resultPaid=false,needsUpdate=true;
engine.setSkin(saved.skin);
try{renderer=new StadiumRenderer($('stadium'));renderer.setOptions(saved.settings);}catch(e){$('boot').innerHTML='<p>This browser could not start 3D graphics.</p><p>Open Nightstrike in Safari, Chrome or Edge with WebGL enabled.</p>';console.error(e);}
function notify(text){$('smallToast').textContent=text;$('smallToast').classList.add('show');clearTimeout(smallTimer);smallTimer=setTimeout(()=>$('smallToast').classList.remove('show'),2600);}
function sound(name){audio.unlock();audio.play(name);}
function onEvent(e){
 const map={start:'start',coin:'coin',pass:'pass',hit:'hit',comet:'comet',shoot:'shot',goal:'goal',save:'save'};
 if(map[e.type])audio.play(map[e.type]);
 if(e.type==='trick'){audio.play(e.kind==='nutmeg'?'nutmeg':'dodge');showTrick(e.message+'  ×'+e.multiplier);renderer?.burst(e.x??engine.state.ball.x,engine.state.ball.y,e.z??engine.state.ball.z,'trick');}
 if(e.type==='comet'||e.type==='hit')showTrick(e.message);
 if(e.type==='hit'){$('hitFlash').classList.remove('active');void $('hitFlash').offsetWidth;$('hitFlash').classList.add('active');}
 if(e.type==='coin')renderer?.burst(e.x,.9,e.z,'coin');
 if(e.type==='warning')warningUntil=performance.now()+1200;
 if(e.type==='goal'||e.type==='save'){$('celebrationText').textContent=e.message;$('celebrationLabel').textContent=e.type==='goal'?'A BEAUTIFUL FINISH':'THE KEEPER READ THAT ONE';$('celebrationBonus').textContent=e.perfect?'+15 CORNER FINISH BONUS':'';if(e.type==='goal')renderer?.burst(engine.state.ball.x,2,-49,'goal');}
 if(e.type==='aim'){resetControls();notify('Wait for mint. Then strike.');}
 if(e.type==='result'){
  if(!resultPaid){resultPaid=true;saved.coins+=e.coins;saved.bestStreak=Math.max(saved.bestStreak,e.bestCombo||0);if(e.won&&e.perfectShot)saved.perfectGoals++;if(e.won){saved.stars[e.levelIndex]=Math.max(saved.stars[e.levelIndex],e.stars);saved.unlocked=Math.min(LEVELS.length-1,Math.max(saved.unlocked,e.levelIndex+1));}save();audio.play(e.won?'win':'save');}
  showResult(e.result);updateHome();
 }
 needsUpdate=true;
}
function showTrick(text){$('trickToast').textContent=text;$('trickToast').classList.add('show');toastUntil=performance.now()+1500;}
function updateHome(){const lvl=LEVELS[selected],arena=ARENAS[lvl.chapterIndex];$('arenaName').textContent=arena.name;if(engine.state.mode==='home'){engine.state.levelIndex=selected;applyArena(selected);}$('nextName').textContent=lvl.name;$('nextNumber').innerHTML=String(selected+1).padStart(2,'0')+'<span>/ '+String(LEVELS.length).padStart(2,'0')+'</span>';$('nextStars').textContent='★'.repeat(saved.stars[selected])+'☆'.repeat(3-saved.stars[selected]);$('wallet').textContent=saved.coins;$('sound').textContent=saved.muted?'♫̸':'♪';$('sound').setAttribute('aria-label',saved.muted?'Enable sound':'Mute sound');}
function start(index=selected){sound('click');selected=index;warningUntil=0;closeModal(false);engine.start(index);resultPaid=false;resetControls();if(renderer){renderer.trail=[];renderer.particles=[];}applyArena(index);needsUpdate=true;$('stadium').focus({preventScroll:true});}
function toHome(){closeModal(false);engine.home();selected=saved.unlocked;resetControls();needsUpdate=true;updateHome();}
function setBackgroundInert(value){for(const id of ['brand','sound','pause','help','settings','fullscreen','home','hud','aimPanel','stadium'])$(id).inert=value;}
function openModal(kind,html){resetControls();setBackgroundInert(true);modalKind=kind;$('modalContent').innerHTML=html;$('modal').classList.remove('hidden');$('closeModal').classList.remove('hidden');$('closeModal').focus({preventScroll:true});}
function closeModal(resume=true){setBackgroundInert(false);$('modal').classList.add('hidden');modalKind='';if(resume)engine.resume();needsUpdate=true;}
function pauseGame(){if(!engine.pause())return;audio.update?.(engine.state,0);needsUpdate=true;openModal('pause','<span class="eyebrow">TAKE A BREATHER</span><h2 id="dialogTitle">HALF-TIME.</h2><p>Your run is paused. The floodlights will wait.</p><button class="primary" data-action="resume">BACK TO THE PITCH <span>↗</span></button><button class="secondary" data-action="retry">RESTART CHALLENGE</button><button class="secondary" data-action="settings">CONTROLS & SETTINGS</button><button class="secondary" data-action="home">RETURN TO HOME</button>');}
function showLevels(chapter=Math.floor(selected/5)){
 sound('click');journeyChapter=chapter;
 const chapters=[...new Set(LEVELS.map(l=>l.chapter))];
 const starCount=saved.stars.reduce((a,b)=>a+b,0),completed=saved.stars.filter(n=>n>0).length;
 const tabs=chapters.map((name,i)=>'<button class="chapter-tab '+(i===chapter?'active':'')+'" data-chapter="'+i+'" aria-pressed="'+(i===chapter)+'"><small>CHAPTER '+String(i+1).padStart(2,'0')+'</small><b>'+name+'</b><span>'+saved.stars.slice(i*5,i*5+5).reduce((a,b)=>a+b,0)+' / 15 ★</span></button>').join('');
 const cards=LEVELS.map((l,i)=>({l,i})).filter(({i})=>Math.floor(i/5)===chapter).map(({l,i})=>'<button class="level-card '+(i===selected?'selected':'')+'" data-level="'+i+'" '+(i>saved.unlocked?'disabled':'')+'><span class="level-id">'+String(i+1).padStart(2,'0')+'</span><span class="level-info"><b>'+l.name+'</b><small>'+l.subtitle+'</small><span class="stage-focus">'+l.focus+' · '+l.trickTarget+' TRICKS FOR ★★★</span></span>'+(i>saved.unlocked?'<span class="locked-label">LOCKED</span>':'<span class="level-stars">'+'★'.repeat(saved.stars[i])+'☆'.repeat(3-saved.stars[i])+'</span>')+'</button>').join('');
 openModal('levels','<span class="eyebrow">THREE CHAPTERS. ONE CHAMPION.</span><h2 id="dialogTitle">THE JOURNEY.</h2><div class="journey-summary"><span>'+completed+' / '+LEVELS.length+' STAGES CLEARED</span><strong>'+starCount+' / '+LEVELS.length*3+' ★</strong></div><div class="chapter-tabs" aria-label="Choose a chapter">'+tabs+'</div><div class="level-list">'+cards+'</div><p class="control-notes">★ Score a goal &nbsp; ★ Take at most one tackle<br>★ Reach this stage’s trick target. Score to unlock the next stage.</p>');
}
function showSkins(){sound('click');openModal('skins','<span class="eyebrow">YOUR BALL. YOUR SIGNATURE.</span><h2 id="dialogTitle">THE BALL LOCKER.</h2><p>Earn coins on the pitch. Give your next run a new look.</p><div class="skin-grid">'+SKINS.map(s=>'<button class="skin-card '+(saved.skin===s.id?'selected':'')+'" data-skin="'+s.id+'"><span class="skin-ball" style="--ball-color:'+s.color+'"></span><b>'+s.name+'</b><small>'+(saved.skin===s.id?'EQUIPPED':saved.owned.includes(s.id)?'EQUIP':'◈ '+s.cost)+'</small></button>').join('')+'</div><p class="control-notes">Your balance: <strong>'+saved.coins+' coins</strong>. All skins are cosmetic.</p>');}
function showHelp(){sound('click');engine.pause();needsUpdate=true;openModal('help','<span class="eyebrow">A LITTLE STREET KNOWLEDGE</span><h2 id="dialogTitle">YOU ARE THE BALL.</h2><div class="instructions"><span>↔</span><div><b>Dribble into the night</b><p>Drag on the pitch or use the large thumbstick. The ball rolls forward automatically. Desktop: ← → or A / D. Choose your controls in Settings.</p></div><span>↗</span><div><b>Read red. Find the gap.</b><p>Red lanes flash before slide tackles. Dodge them, or stay dead-centre between a standing defender’s feet for a nutmeg. Three tackles end your run.</p></div><span>⇄</span><div><b>Play the one-two</b><p>Tap ONE-TWO or press Space to exchange a pass with your light-blue teammate. It protects you through the tackle. Ready again after 4 seconds, or sooner on link-up stages.</p></div><span>◉</span><div><b>Find your focus</b><p>Hold FOCUS or F to slow the action and the shooting target. Focus drains while held; coins and tricks refill it. Chain tricks within five seconds for up to ×3 trick coins.</p></div><span>♨</span><div><b>Turn tricks into fire</b><p>Nutmegs, dodges and passes add heat. Reach 100% to become an unstoppable flaming comet for 7 seconds.</p></div><span>⌾</span><div><b>Finish in style</b><p>At the box, wait until the moving target is outside the keeper’s orange reach and turns mint. Tap STRIKE or press Space. A safe shot into the far corner adds 15 bonus coins.</p></div></div><div class="control-notes">Stars: score a goal · take at most one tackle · reach the stage’s trick target shown in the HUD.<br>Coins, stars and unlocked skins save on this device. Sound starts with your first tap.</div><button class="primary" data-action="resume">LET’S PLAY <span>↗</span></button>');}
function showResult(r){
 const headline=r.won?(r.allComplete?'NIGHT. OWNED.':r.perfectShot?'TOP BINS.':'WHAT A FINISH.'):(r.reason==='Tackled out'?'TOUGH CROWD.':'SO CLOSE.');
 openModal('result','<div class="result"><span class="eyebrow">'+(r.allComplete&&r.won?'ALL '+LEVELS.length+' STAGES COMPLETE':LEVELS[r.levelIndex].name.toUpperCase())+'</span><h2 id="dialogTitle">'+headline+'</h2><div class="result-stars">'+'★'.repeat(r.stars)+'☆'.repeat(3-r.stars)+'</div><div class="result-checks">'+r.starGoals.map((yes,i)=>'<span class="'+(yes?'earned':'')+'">'+(yes?'★':'☆')+' '+['Score a goal','At most one tackle',r.trickTarget+' tricks completed'][i]+'</span>').join('')+'</div>'+(r.perfectShot?'<div class="result-bonus">CORNER FINISH · +15 BONUS COINS</div>':'')+'<p>'+(r.won?(r.stars===3?'Three-star football. That’s how you own the pitch.':'Goal scored. Run it back to chase all three stars.'):(r.reason==='Tackled out'?'Watch the red warnings and use your one-two to escape.':'The keeper read that one. Wait for the target to turn mint.'))+'</p><div class="result-stats"><div><b>'+r.tricks+'</b><small>TRICKS</small></div><div><b>+'+r.coins+'</b><small>COINS EARNED</small></div><div><b>'+r.tackles+'</b><small>TACKLES</small></div></div>'+(r.won&&!r.allComplete?'<button class="primary" data-action="next">NEXT CHALLENGE <span>↗</span></button>':'<button class="primary" data-action="retry">'+(r.won?'PLAY AGAIN':'ONE MORE RUN')+' <span>↗</span></button>')+'<button class="secondary" data-action="'+(r.won&&!r.allComplete?'retry':'home')+'">'+(r.won&&!r.allComplete?'REPLAY FOR MORE STARS':'BACK TO THE STADIUM')+'</button>'+(r.won&&!r.allComplete?'<button class="secondary" data-action="home">BACK TO THE STADIUM</button>':'')+'</div>');
 $('closeModal').classList.add('hidden');$('modalContent').querySelector('button')?.focus({preventScroll:true});
}
$('play').onclick=()=>start();$('brand').onclick=()=>{if(['playing','aiming','shot','celebrating'].includes(engine.state.mode))pauseGame();else if(engine.state.mode==='home')toHome();};$('levels').onclick=()=>showLevels();$('skins').onclick=showSkins;$('help').onclick=showHelp;$('pause').onclick=pauseGame;$('settings').onclick=showSettings;$('fullscreen').onclick=toggleFullscreen;
$('sound').onclick=()=>{audio.unlock();saved.muted=!saved.muted;audio.setMuted(saved.muted);save();updateHome();if(!saved.muted)audio.play('click');};
$('closeModal').onclick=()=>closeModal();$('pass').onclick=()=>{audio.unlock();engine.pass();};$('shoot').onclick=()=>{audio.unlock();engine.shoot();};
$('modalContent').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;audio.unlock();if(b.dataset.chapter!==undefined){showLevels(Number(b.dataset.chapter));return;}if(b.dataset.level!==undefined){const next=Number(b.dataset.level);if(!Number.isInteger(next)||next<0||next>saved.unlocked)return;selected=next;closeModal();updateHome();sound('click');}if(b.dataset.skin){const s=SKINS.find(x=>x.id===b.dataset.skin);if(!saved.owned.includes(s.id)){if(saved.coins<s.cost){notify('You need '+(s.cost-saved.coins)+' more coins. Keep playing!');return;}saved.coins-=s.cost;saved.owned.push(s.id);audio.play('coin');}saved.skin=s.id;engine.setSkin(s.id);save();showSkins();updateHome();}switch(b.dataset.action){case 'resume':closeModal();break;case 'settings':showSettings();break;case 'help':showHelp();break;case 'export':exportProgress();break;case 'import':$('progressImport').click();break;case 'fullscreen':toggleFullscreen();break;case 'home':toHome();break;case 'retry':start(engine.state.levelIndex);break;case 'next':start(Math.min(LEVELS.length-1,engine.state.levelIndex+1));break;}});
$('modal').addEventListener('keydown',e=>{if(e.key==='Tab'){const nodes=[...$('dialog').querySelectorAll('button:not([disabled]):not(.hidden),select:not([disabled]),input:not([disabled]):not([hidden])')];if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
function applyArena(index){const arena=ARENAS[Math.floor(index/5)];document.body.style.setProperty('--sky-top',arena.top);document.body.style.setProperty('--sky-bottom',arena.bottom);}
function applySettings(){
 const touch=typeof matchMedia==='function'&&matchMedia('(any-pointer: coarse)').matches;
 const stick=saved.settings.control==='stick'||(saved.settings.control==='auto'&&touch);
 document.body.classList.toggle('thumbstick-mode',stick);document.body.classList.toggle('low-effects',saved.settings.reducedMotion);
 renderer?.setOptions(saved.settings);resetControls();save();
}
function showSettings(){
 engine.pause();needsUpdate=true;const prefs=saved.settings;
 const select=(id,options)=>'<select id="'+id+'" data-pref="'+id+'">'+options.map(([v,label])=>'<option value="'+v+'" '+(prefs[id]===v?'selected':'')+'>'+label+'</option>').join('')+'</select>';
 openModal('settings','<span class="eyebrow">MAKE IT YOUR GAME</span><h2 id="dialogTitle">THE CONTROL ROOM.</h2><div class="setting-grid"><label class="setting-field">Touch controls'+select('control',[['auto','Automatic'],['drag','Drag on the pitch'],['stick','Large thumbstick']])+'<small>Keyboard and pitch dragging always work.</small></label><label class="setting-field">Graphics'+select('quality',[['auto','Automatic'],['high','High detail'],['low','Battery saver']])+'<small>Automatic adjusts resolution for your screen.</small></label><label class="setting-field">Camera'+select('camera',[['wide','Tactical — wider view'],['chase','Chase — closer view']])+'</label><label class="setting-field">Steering sensitivity <input id="sensitivity" data-pref="sensitivity" type="range" min="0.6" max="1.8" step="0.1" value="'+prefs.sensitivity+'"><small>Gentle ← → Responsive</small></label></div><label class="setting-check"><input type="checkbox" data-pref="reducedMotion" '+(prefs.reducedMotion?'checked':'')+'> Reduced motion & flashes</label><div class="settings-divider"></div><span class="eyebrow">TAKE YOUR PROGRESS WITH YOU</span><p>Saved on this browser. Export a backup here, then import it on another browser or device. Import merges achievements and keeps the larger coin balance.</p><div class="save-actions"><button class="secondary" data-action="export">EXPORT PROGRESS ↗</button><button class="secondary" data-action="import">IMPORT PROGRESS ↙</button></div><div class="settings-actions"><button class="secondary" data-action="fullscreen">FULL SCREEN ⛶</button><button class="secondary" data-action="help">HOW TO PLAY ?</button></div><p class="controls-note">Best streak: '+saved.bestStreak+' · Corner goals: '+saved.perfectGoals+'</p><button class="primary" data-action="resume">BACK TO THE GAME <span>↗</span></button>');
}
function exportProgress(){
 const blob=new Blob([JSON.stringify({game:'nightstrike',version:3,progress:saved},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Nightstrike-progress.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);notify('Progress backup downloaded.');
}
function mergeProgress(raw){
 const source=raw?.game==='nightstrike'?raw.progress:raw;
 if((raw?.game&&raw.game!=='nightstrike')||!source||!Array.isArray(source.stars)||!Number.isFinite(Number(source.coins)))throw new Error('Choose a Nightstrike progress JSON file.');
 const incoming=normaliseSave(source);
 saved.stars=saved.stars.map((v,i)=>Math.max(v,incoming.stars[i]));saved.coins=Math.max(saved.coins,incoming.coins);saved.unlocked=Math.max(saved.unlocked,incoming.unlocked);saved.owned=[...new Set([...saved.owned,...incoming.owned])];saved.skin=incoming.skin;saved.bestStreak=Math.max(saved.bestStreak,incoming.bestStreak);saved.perfectGoals=Math.max(saved.perfectGoals,incoming.perfectGoals);
 saved=normaliseSave(saved);engine.setSkin(saved.skin);selected=saved.unlocked;save();updateHome();
}
$('progressImport').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{if(file.size>65536)throw new Error('Progress files must be smaller than 64 KB.');mergeProgress(JSON.parse(await file.text()));showSettings();notify('Progress merged successfully.');}catch(error){notify(error.message||'That progress file could not be read.');}finally{event.target.value='';}
});
$('modalContent').addEventListener('change',e=>{
 const pref=e.target.dataset.pref;if(!pref)return;
 if(pref==='reducedMotion')saved.settings.reducedMotion=e.target.checked;
 else if(pref==='sensitivity')saved.settings.sensitivity=Math.max(.6,Math.min(1.8,Number(e.target.value)||1));
 else if({control:['auto','drag','stick'],quality:['auto','low','high'],camera:['wide','chase']}[pref]?.includes(e.target.value))saved.settings[pref]=e.target.value;
 applySettings();
});
async function toggleFullscreen(){
 try{if(document.fullscreenElement)await document.exitFullscreen();else if($('game').requestFullscreen)await $('game').requestFullscreen();else notify('Use your browser’s full-screen or Add to Home Screen option.');}catch{notify('Full screen is unavailable here. You can still play normally.');}
}
function resetControls(){keys.clear();drag=null;joy=0;joyPointer=null;engine.setFocus(false);$('stick').style.transform='translate(0,0)';}
const canvas=$('stadium');
canvas.addEventListener('pointerdown',e=>{if(engine.state.mode!=='playing'||modalKind)return;e.preventDefault();audio.unlock();drag={id:e.pointerId,x:e.clientX,startX:engine.inputX};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const scale=18/Math.min(canvas.clientWidth*.85,780)*saved.settings.sensitivity;engine.steer(drag.startX+(e.clientX-drag.x)*scale);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{drag=null;});
$('joystick').addEventListener('pointerdown',e=>{if(engine.state.mode!=='playing'||modalKind)return;e.preventDefault();audio.unlock();joyPointer={id:e.pointerId,x:e.clientX,y:e.clientY};$('joystick').setPointerCapture(e.pointerId);});
$('joystick').addEventListener('pointermove',e=>{if(!joyPointer||e.pointerId!==joyPointer.id)return;e.preventDefault();joy=Math.max(-1,Math.min(1,(e.clientX-joyPointer.x)/40));$('stick').style.transform='translate('+joy*30+'px,'+Math.max(-15,Math.min(15,(e.clientY-joyPointer.y)*.35))+'px)';});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(event,()=>{joy=0;joyPointer=null;$('stick').style.transform='translate(0,0)';});
for(const id of ['focus','aimFocus']){
 const button=$(id);button.addEventListener('pointerdown',e=>{e.preventDefault();audio.unlock();button.setPointerCapture(e.pointerId);engine.setFocus(true);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>engine.setFocus(false));
 button.addEventListener('click',e=>{if(e.detail===0)engine.setFocus(!engine.state.focusHeld);});
}
addEventListener('keydown',e=>{
 if(e.target?.matches?.('input,select,textarea'))return;
 const key=e.key.toLowerCase();if(!['arrowleft','arrowright',' ','escape','a','d','p','f'].includes(key))return;
 if(modalKind&&!['escape','p'].includes(key))return;
 if(key===' '&&e.target?.closest?.('button'))return;
 e.preventDefault();if(e.repeat&&[' ','escape','p','f'].includes(key))return;
 if(key==='escape'||key==='p'){if(modalKind&&modalKind!=='result')closeModal();else pauseGame();return;}
 if(key==='f'){engine.setFocus(true);return;}
 if(key===' '){audio.unlock();if(engine.state.mode==='aiming')engine.shoot();else if(engine.state.mode==='playing')engine.pass();else if(engine.state.mode==='home')start();}
 keys.add(key);
});
addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(e.key.toLowerCase()==='f')engine.setFocus(false);});
addEventListener('blur',()=>{resetControls();if(!modalKind)pauseGame();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetControls();if(!modalKind)pauseGame();}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pauseGame();$('boot').innerHTML='<p>RESTORING THE STADIUM…</p>';$('boot').classList.remove('hidden');});
canvas.addEventListener('webglcontextrestored',()=>{try{renderer=new StadiumRenderer(canvas);renderer.setOptions(saved.settings);$('boot').classList.add('hidden');notify('Stadium restored. Resume when you’re ready.');}catch{$('boot').innerHTML='<p>Please reload to restore 3D graphics. Your saved progress is safe.</p>';}});
function updateHUD(){const s=engine.state,active=s.mode!=='home';document.body.classList.toggle('playing',active);document.body.classList.toggle('aiming',s.mode==='aiming'||s.mode==='shot'||s.mode==='celebrating');document.body.classList.toggle('comet',s.comet);document.body.classList.toggle('celebrating',s.mode==='celebrating');$('celebration').classList.toggle('hidden',s.mode!=='celebrating');document.body.classList.toggle('result-mode',s.mode==='result');$('home').classList.toggle('hidden',active);$('hud').classList.toggle('hidden',!active);$('pause').classList.toggle('hidden',!active||s.mode==='result');$('aimPanel').classList.toggle('hidden',s.mode!=='aiming');$('topLevel').textContent=active?'CHALLENGE '+String(s.levelIndex+1).padStart(2,'0'):'THE FLOODLIGHTS ARE ON';$('levelLabel').textContent='CHALLENGE '+String(s.levelIndex+1).padStart(2,'0')+' / '+String(LEVELS.length).padStart(2,'0');$('levelTitle').textContent=LEVELS[s.levelIndex].name;$('gameHint').textContent=LEVELS[s.levelIndex].focus.toUpperCase()+' · '+(s.trickTarget||3)+' TRICKS FOR ★★★';needsUpdate=false;}
function frame(now){
 const dt=Math.min((now-(last||now))/1000,.05);last=now;const previous=engine.state.mode;
 if(previous==='playing'&&!modalKind){const direction=joy||Number(keys.has('arrowright')||keys.has('d'))-Number(keys.has('arrowleft')||keys.has('a'));if(direction)engine.steer(engine.inputX+direction*dt*15*saved.settings.sensitivity);}
 engine.update(dt);const st=engine.state;
 if(previous!==st.mode||needsUpdate)updateHUD();
 document.body.classList.toggle('focusing',st.focusing);
 if(st.mode!=='home'&&now-lastHUD>=70){lastHUD=now;
  $('gameHint').textContent=now<warningUntil?'RED LANE — MOVE TO THE SIDE':LEVELS[st.levelIndex].focus.toUpperCase()+' · '+st.trickTarget+' TRICKS FOR ★★★';
  $('tricks').textContent=st.tricks+' / '+st.trickTarget;$('runCoins').textContent=String(st.runCoins).padStart(2,'0');$('lives').textContent='● '.repeat(st.lives)+'○ '.repeat(3-st.lives);$('heatValue').innerHTML=Math.round(st.heat)+'<span>%</span>';$('heatFill').style.width=st.heat+'%';$('heatLabel').textContent=st.comet?'COMET':'HEAT';$('heatHint').textContent=st.comet?Math.ceil(st.cometTime)+' SECONDS OF FIRE':'TRICKS FUEL THE FIRE';$('progressFill').style.width=(st.progress*100)+'%';
  $('comboMultiplier').textContent='×'+st.multiplier;$('comboText').textContent=st.combo?st.combo+' TRICK STREAK':'BUILD YOUR STREAK';$('comboTimer').style.width=(st.comboTime/5*100)+'%';$('comboCard').classList.toggle('active',st.combo>=3);
  $('focusFill').style.width=st.focus+'%';$('aimFocusMeter').textContent=Math.ceil(st.focus)+'%';$('focusHint').textContent=st.focusing?'SLOW MOTION':st.focus<1?'REFILL WITH TRICKS':'HOLD / F';$('focus').classList.toggle('active',st.focusing);$('aimFocus').classList.toggle('active',st.focusing);
  const nearBox=st.distanceLeft<=LEVELS[st.levelIndex].speed*(st.comet?1.08:1)*.9+.5;$('pass').disabled=st.passCooldown>0||st.mode!=='playing'||nearBox;$('passHint').textContent=nearBox?'READY TO SHOOT':st.passCooldown>0?'READY IN '+st.passCooldown.toFixed(1)+'s':'SPACE / TAP';$('cooldown').style.width=(1-st.passCooldown/(st.passCooldownMax||4))*100+'%';
 }
 if(st.mode==='aiming'){$('aimPanel').classList.toggle('safe',st.targetSafe);$('aimMarker').style.left=(st.targetX+4.8)/9.6*100+'%';$('aimMarker').style.background=st.targetSafe?'var(--mint)':'var(--orange)';$('keeperZone').style.left=(st.keeperX-st.keeperReach+4.8)/9.6*100+'%';$('keeperZone').style.width=st.keeperReach*2/9.6*100+'%';$('aimTitle').textContent=st.targetSafe?(Math.abs(st.targetX)>=3.25?'TAKE THE CORNER.':'THERE’S YOUR CHANCE.'):'FIND THE CORNER.';}
 if(now>toastUntil)$('trickToast').classList.remove('show');if(renderer)renderer.render(st,dt);audio.update(st,dt);requestAnimationFrame(frame);
}
updateHome();updateHUD();applySettings();if(renderer){$('boot').classList.add('hidden');requestAnimationFrame(frame);}
