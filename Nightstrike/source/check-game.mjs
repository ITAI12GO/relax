import assert from 'node:assert/strict';
import { GameEngine, LEVELS, SKINS } from './dist/engine.js';

const DT = 1 / 60;
const step = (game, frames = 1) => {
  for (let i = 0; i < frames; i += 1) game.update(DT);
};

// This bot only uses controls available to the player: steer away from visible
// red warnings, tap one-two when ready, and shoot at a safe target.
function driveToBox(game) {
  const level = LEVELS[game.state.levelIndex];
  for (let frame = 0; frame < 4000; frame += 1) {
    const state = game.state;
    if (state.mode !== 'playing') break;
    // Keep the original chapter's controls identical as a balance regression.
    // Later stages use a modest 100ms reaction cadence and all visible lanes.
    if (level.pattern === 'classic') {
      const danger = state.defenders.find(d => !d.done && ['warn', 'slide'].includes(d.phase));
      if (danger) game.steer(danger.x >= 0 ? -6.8 : 6.8);
      if (state.passCooldown === 0 && state.elapsed > 3) game.pass();
    } else if (frame % 6 === 0) {
      const danger = state.defenders.filter(d => !d.done && ['warn', 'slide'].includes(d.phase));
      assert.ok(danger.length <= 2, 'At most two tackle lanes may be active');
      const guard = state.defenders.filter(d => !d.done && d.kind === 'guard' && d.phase === 'chase' && state.ball.z - d.z > -0.7)
        .sort((a, b) => b.z - a.z)[0];
      if (danger.length) {
        const candidates = [-6.8, -4, 0, 4, 6.8];
        const safety = x => Math.min(...danger.map(d => Math.abs(x - d.x))) - Math.abs(x - state.ball.x) * 0.08;
        candidates.sort((a, b) => safety(b) - safety(a));
        game.steer(candidates[0]);
      } else if (level.pattern === 'nutmeg' && guard) {
        game.steer(guard.x);
      }
      const liningUpNutmeg = level.pattern === 'nutmeg' && guard && state.ball.z - guard.z < 6;
      if (state.passCooldown === 0 && state.elapsed > 3 && !liningUpNutmeg) game.pass();
    }
    step(game);
  }
  assert.equal(game.state.mode, 'aiming', 'The player should reach the box');
}

function finishShot(game, safe) {
  for (let frame = 0; frame < 1200 && game.state.targetSafe !== safe; frame += 1) step(game);
  assert.equal(game.state.targetSafe, safe, 'The target should have both safe and unsafe windows');
  assert.equal(game.shoot(), true);
  step(game, 60);
  assert.equal(game.state.mode, 'celebrating');
  step(game, 74);
  assert.equal(game.state.mode, 'result');
  return game.state.result;
}

const completions = [];
for (let index = 0; index < LEVELS.length; index += 1) {
  const events = [];
  const game = new GameEngine(event => events.push(event));
  game.start(index);
  driveToBox(game);
  const result = finishShot(game, true);
  assert.equal(result.won, true, `Level ${index + 1} should be winnable`);
  assert.equal(result.stars, 3, `Level ${index + 1} should allow three stars`);
  assert.ok(result.tackles <= LEVELS[index].maxTackles);
  assert.ok(result.tricks >= LEVELS[index].trickTarget);
  assert.ok(result.passes > 0);
  assert.ok(result.dodges > 0);
  assert.ok(events.some(event => event.type === 'comet'), 'Tricks should unlock comet mode');
  assert.equal(result.coins, result.runCoins + result.bonusCoins);
  assert.equal(events.filter(event => event.type === 'result').length, 1, 'The payout event must fire once');
  step(game, 180);
  assert.equal(events.filter(event => event.type === 'result').length, 1, 'Remaining on results must not repay coins');
  assert.equal(result.allComplete, index === LEVELS.length - 1);
  assert.equal(result.trickTarget, LEVELS[index].trickTarget);
  completions.push(`L${index + 1}: 3★ ${result.tricks}/${result.trickTarget} tricks`);
}

const unsafe = new GameEngine();
unsafe.start();
driveToBox(unsafe);
const save = finishShot(unsafe, false);
assert.equal(save.won, false);
assert.equal(save.stars, 0);
assert.equal(save.reason, 'Keeper saves');
assert.equal(save.bonusCoins, 0);

const stationary = new GameEngine();
stationary.start();
for (let frame = 0; frame < 3000 && stationary.state.mode === 'playing'; frame += 1) step(stationary);
assert.equal(stationary.state.result?.won, false);
assert.equal(stationary.state.result?.reason, 'Tackled out');
assert.equal(stationary.state.tackles, 3);
assert.equal(stationary.state.lives, 0);
assert.equal(stationary.state.nutmegs, 1, 'Staying centred should nutmeg the first standing defender');

const pass = new GameEngine();
pass.start();
assert.equal(pass.pass(), true);
assert.equal(pass.pass(), false, 'Cannot start overlapping passes');
// A controlled collision fixture isolates the protection from the pass arc.
pass.state.defenders = [{ id: 90, x: 0, z: 31.7, phase: 'slide', timer: 0, dir: 1, done: false, kind: 'tackler' }];
step(pass);
assert.equal(pass.state.defenders[0].done, true, 'The collision must actually have occurred');
assert.equal(pass.state.lives, 3, 'An active pass protects the ball from a tackle');
step(pass, 26);
assert.ok(Math.abs(pass.state.ball.x - pass.state.teammate.x) < 0.05, 'Ball meets teammate laterally');
assert.ok(Math.abs(pass.state.ball.z - pass.state.teammate.z) < 0.05, 'Ball meets teammate downfield');
step(pass, 30);
assert.equal(pass.state.passes, 1);
assert.equal(pass.state.pass.active, false);
assert.equal(pass.pass(), false, 'Cooldown prevents another pass');
step(pass, 185);
assert.equal(pass.state.passCooldown, 0);
assert.equal(pass.pass(), true, 'Pass is ready again after four seconds');

const paused = new GameEngine();
paused.start(2);
paused.pass();
step(paused, 12);
assert.equal(paused.pause(), true);
const frozen = JSON.stringify(paused.state);
step(paused, 120);
assert.equal(JSON.stringify(paused.state), frozen, 'Pause freezes simulation and cooldowns');
assert.equal(paused.pass(), false);
assert.equal(paused.shoot(), false);
assert.equal(paused.resume(), true);
step(paused);
assert.equal(paused.state.mode, 'playing');
assert.notEqual(JSON.stringify(paused.state), frozen);

unsafe.setSkin('gold');
unsafe.start(4);
assert.equal(unsafe.state.mode, 'playing');
assert.equal(unsafe.state.result, null);
assert.equal(unsafe.state.skin, 'gold', 'Replay keeps the equipped cosmetic');
assert.equal(unsafe.state.ball.x, 0);
assert.equal(unsafe.state.ball.z, 32);
assert.equal(unsafe.state.lives, 3);
assert.equal(unsafe.state.heat, 0);
assert.equal(unsafe.state.tricks, 0);
assert.equal(unsafe.state.runCoins, 0);
assert.equal(unsafe.state.passCooldown, 0);
assert.equal(unsafe.state.elapsed, 0);
assert.equal(unsafe.state.comet, false);
assert.ok(unsafe.state.defenders.every(defender => !defender.done));
assert.ok(unsafe.state.coins.every(coin => !coin.collected));
unsafe.setSkin('missing');
assert.equal(unsafe.state.skin, 'gold');
unsafe.home();
assert.equal(unsafe.state.mode, 'home');
assert.equal(unsafe.state.skin, 'gold');
assert.equal(LEVELS.length, 15);
assert.equal(SKINS.length, 5);

assert.deepEqual([...new Set(LEVELS.map(level => level.chapter))], ['Floodlight League', 'City Circuit', 'Champions Night']);
assert.equal(new Set(LEVELS.map(level => level.name)).size, 15, 'Every stage has its own name');
assert.deepEqual(LEVELS.slice(0, 5).map(level => [level.speed, level.warning, level.defenders, level.trickTarget, level.slideSpeed]), [
  [3.25, 1.4, 5, 3, 10], [3.55, 1.26, 6, 3, 11], [3.9, 1.12, 7, 3, 12],
  [4.2, 1.0, 8, 3, 13], [4.55, 0.9, 9, 3, 14]
], 'The original five stages retain their balance');

for (let index = 0; index < LEVELS.length; index += 1) {
  const level = LEVELS[index];
  assert.equal(level.chapterIndex, Math.floor(index / 5));
  assert.equal(level.chapterStage, index % 5 + 1);
  assert.equal(level.length, 67);
  assert.equal(level.maxTackles, 1);
  assert.ok(level.speed <= 5.6 && level.warning >= 0.85);
  assert.ok(level.defenders <= 12 && level.slideSpeed <= 15);
  const keeper = new GameEngine();
  keeper.start(index);
  const positions = keeper.state.defenders.map(defender => defender.z);
  assert.equal(Math.min(...positions), -26, 'Leave nine units to settle before the box');
  for (let i = 1; i < positions.length; i += 1) assert.ok(positions[i - 1] - positions[i] >= 4.27);
  // Isolate the shooting phase without comet assistance. Every keeper must
  // offer readable safe windows as well as genuinely unsafe times to shoot.
  keeper.state.mode = 'aiming';
  let safeRun = 0, unsafeRun = 0, longestSafe = 0, longestUnsafe = 0;
  for (let frame = 0; frame < 1200; frame += 1) {
    step(keeper);
    if (keeper.state.targetSafe) {
      safeRun += DT; unsafeRun = 0; longestSafe = Math.max(longestSafe, safeRun);
    } else {
      unsafeRun += DT; safeRun = 0; longestUnsafe = Math.max(longestUnsafe, unsafeRun);
    }
  }
  assert.ok(longestSafe >= 0.2, `Stage ${index + 1} needs a readable shooting window`);
  assert.ok(longestUnsafe > 0 && longestUnsafe <= 2.6, `Stage ${index + 1} keeper should be challenging but fair`);
}

const fastPass = new GameEngine();
fastPass.start(7);
assert.equal(fastPass.state.passCooldownMax, 3.2);
fastPass.state.defenders = [];
assert.equal(fastPass.pass(), true);
step(fastPass, 191);
assert.ok(fastPass.state.passCooldown > 0);
assert.equal(fastPass.pass(), false);
step(fastPass, 2);
assert.equal(fastPass.pass(), true, 'Link stages refresh passes after 3.2 seconds');

const hotEvents = [];
const furnace = new GameEngine(event => hotEvents.push(event));
furnace.start(8);
for (let frame = 0; frame < 600 && furnace.state.tricks === 0; frame += 1) step(furnace);
assert.equal(furnace.state.nutmegs, 1);
assert.equal(furnace.state.heat, 41, 'Furnace nutmeg adds rounded 34 × 1.2 heat');
assert.equal(hotEvents.find(event => event.type === 'trick')?.heat, 41);

const demanding = new GameEngine();
demanding.start(14);
demanding.state.tricks = 6;
demanding.finish(true);
assert.equal(demanding.state.result.stars, 2, 'The final stage needs seven tricks for its third star');
demanding.start(14);
demanding.state.tricks = 7;
demanding.finish(true);
assert.equal(demanding.state.result.stars, 3);
assert.equal(demanding.state.result.allComplete, true);

// Focus slows simulation, drains in real time, and never sticks after a pause.
const normal = new GameEngine(), focused = new GameEngine();
for (const g of [normal, focused]) { g.start(); g.state.defenders = []; g.state.coins = []; }
focused.setFocus(true);
step(normal, 60); step(focused, 60);
assert.ok(Math.abs((32 - focused.state.ball.z) / (32 - normal.state.ball.z) - .42) < .0001);
assert.ok(Math.abs(focused.state.focus - 37) < .0001);
assert.equal(focused.state.focusing, true);
focused.pause();
assert.equal(focused.state.focusHeld, false);
assert.equal(focused.state.focusing, false);
const pausedCharge = focused.state.focus;
step(focused, 90); assert.equal(focused.state.focus, pausedCharge);
focused.resume(); step(focused, 60);
assert.ok(Math.abs(focused.state.focus - pausedCharge - 4) < .0001);
focused.state.focus = 1; focused.setFocus(true); step(focused, 5);
assert.equal(focused.state.focusHeld, false, 'Exhausting Focus releases the held ability');
assert.equal(focused.state.focusing, false);
assert.ok(focused.state.focus >= 0);

for (const g of [normal, focused]) { g.state.mode = 'aiming'; g.state.aimTime = 0; }
focused.state.focus = 80; focused.setFocus(true);
step(normal, 30); step(focused, 30);
assert.ok(Math.abs(focused.state.aimTime / normal.state.aimTime - .42) < .0001);
focused.shoot(); assert.equal(focused.state.focusHeld, false);

const combos = new GameEngine(); combos.start(); combos.state.defenders = []; combos.state.coins = [];
for (let i = 0; i < 6; i++) combos.awardTrick('TEST', 0);
assert.equal(combos.state.multiplier, 3);
assert.equal(combos.state.runCoins, 33, 'Six successive tricks pay 3 + 3 + 6 + 6 + 6 + 9');
assert.equal(combos.state.focus, 100, 'Tricks refill but never overflow Focus');
step(combos, 301);
assert.equal(combos.state.combo, 0); assert.equal(combos.state.multiplier, 1);
assert.equal(combos.state.bestCombo, 6);
combos.awardTrick('TEST', 0);
combos.hit({done: false, collided: false, phase: 'chase'});
assert.equal(combos.state.combo, 0, 'A tackle breaks the streak');

const cornerEvents = [], corner = new GameEngine(e => cornerEvents.push(e));
corner.start(14); corner.state.mode = 'aiming'; corner.state.targetX = 3.8; corner.state.keeperX = -1;
corner.shoot(); step(corner, 60);
assert.equal(corner.state.mode, 'celebrating');
assert.equal(cornerEvents.filter(e => e.type === 'goal').length, 1);
assert.equal(cornerEvents.filter(e => e.type === 'result').length, 0);
corner.pause(); const celebrationAt = corner.state.celebrationTime; step(corner, 90);
assert.equal(corner.state.celebrationTime, celebrationAt);
corner.resume(); step(corner, 74);
assert.equal(corner.state.result.perfectBonus, 15);
assert.equal(corner.state.result.bonusCoins, 125, 'Goal plus clean-run stars, stage-15 reward and corner bonus');
assert.equal(cornerEvents.filter(e => e.type === 'result').length, 1);

console.log('PASS — Focus speed/drain/refill/exhaustion/pause/aim, combo payout/expiry/hit, corner bonus, paused celebration and single payout');

console.log('PASS — ' + completions.join(' · '));
console.log('PASS — unsafe shot, three-tackle loss, nutmeg, pass contact/protection/cooldown, pause, replay reset, single payout');
console.log('PASS — 3 chapters, original balance, 15 keeper windows, fair formations, faster link passes, furnace heat, seven-trick final');
