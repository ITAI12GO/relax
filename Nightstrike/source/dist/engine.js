// Nightstrike simulation. World units: +X right, -Z towards the rival goal.
// The engine deliberately has no browser dependencies so gameplay can be checked
// independently of the renderer, controls, audio and saved progression.
const CHAPTERS = ['Floodlight League', 'City Circuit', 'Champions Night'];
export const LEVELS = Object.freeze([
  { name: 'First Lights', subtitle: 'Find your rhythm', speed: 3.25, length: 67, defenders: 5, warning: 1.4, chase: 0.48, targetSpeed: 1.05, keeperSpeed: 0.67 },
  { name: 'Red Pressure', subtitle: 'Beat the press', speed: 3.55, length: 67, defenders: 6, warning: 1.26, chase: 0.65, targetSpeed: 1.22, keeperSpeed: 0.76 },
  { name: 'Street Magic', subtitle: 'Make the impossible pass', speed: 3.9, length: 67, defenders: 7, warning: 1.12, chase: 0.82, targetSpeed: 1.40, keeperSpeed: 0.87 },
  { name: 'Heatwave', subtitle: 'Bring the fire', speed: 4.2, length: 67, defenders: 8, warning: 1.0, chase: 1.0, targetSpeed: 1.57, keeperSpeed: 0.99 },
  { name: 'Midnight Final', subtitle: 'Own the night', speed: 4.55, length: 67, defenders: 9, warning: 0.90, chase: 1.15, targetSpeed: 1.76, keeperSpeed: 1.10 },
  { name: 'Tunnel Vision', subtitle: 'Thread the standing guard', focus: 'Nutmeg lines', pattern: 'nutmeg', speed: 4.05, defenders: 8, warning: 1.12, chase: 0.85, targetSpeed: 1.45, keeperSpeed: 0.92, trickTarget: 4, slideSpeed: 12.5, keeperReach: 1.7 },
  { name: 'Switchback', subtitle: 'Read the staggered red lanes', focus: 'Rapid dodges', pattern: 'staggered', speed: 4.35, defenders: 9, warning: 1.02, chase: 1.0, targetSpeed: 1.65, keeperSpeed: 1.02, trickTarget: 4, slideSpeed: 13, keeperReach: 1.75 },
  { name: 'Give & Go', subtitle: 'A quicker return pass', focus: 'One-two rhythm', pattern: 'link', speed: 4.55, defenders: 10, warning: 1.05, chase: 1.05, targetSpeed: 1.72, keeperSpeed: 1.12, trickTarget: 5, passCooldown: 3.2, slideSpeed: 13, keeperReach: 1.75 },
  { name: 'Neon Furnace', subtitle: 'More heat from every trick', focus: 'Comet football', pattern: 'furnace', speed: 4.7, defenders: 10, warning: 1.0, chase: 1.1, targetSpeed: 1.82, keeperSpeed: 1.17, trickTarget: 5, heatMultiplier: 1.2, slideSpeed: 13.5, keeperReach: 1.8 },
  { name: 'Last Train', subtitle: 'An all-out stadium sprint', focus: 'Sprint finish', pattern: 'sprint', speed: 5.25, defenders: 9, warning: 0.95, chase: 1.15, targetSpeed: 1.95, keeperSpeed: 1.22, trickTarget: 5, slideSpeed: 14, keeperReach: 1.8 },
  { name: 'Silk Road', subtitle: 'Keep your touch through the gaps', focus: 'Precision nutmegs', pattern: 'nutmeg', speed: 4.65, defenders: 11, warning: 1.0, chase: 1.12, targetSpeed: 1.95, keeperSpeed: 1.25, trickTarget: 6, slideSpeed: 13.5, keeperReach: 1.85 },
  { name: 'Redline', subtitle: 'Stay ahead of the sliding press', focus: 'Lane mastery', pattern: 'staggered', speed: 5.0, defenders: 11, warning: 0.92, chase: 1.2, targetSpeed: 2.02, keeperSpeed: 1.32, trickTarget: 6, slideSpeed: 14, keeperReach: 1.88 },
  { name: 'Afterburn', subtitle: 'Light up the final stretch', focus: 'Comet chains', pattern: 'furnace', speed: 5.15, defenders: 12, warning: 0.92, chase: 1.2, targetSpeed: 2.1, keeperSpeed: 1.38, trickTarget: 6, heatMultiplier: 1.2, slideSpeed: 14.5, keeperReach: 1.9 },
  { name: 'Velvet Thunder', subtitle: 'Link up under full pressure', focus: 'Fast one-twos', pattern: 'link', speed: 5.35, defenders: 12, warning: 0.9, chase: 1.25, targetSpeed: 2.18, keeperSpeed: 1.42, trickTarget: 7, passCooldown: 3.2, slideSpeed: 14.5, keeperReach: 1.95 },
  { name: 'Crown of Night', subtitle: 'Bring every trick to the final', focus: 'Championship final', pattern: 'finale', speed: 5.6, defenders: 12, warning: 0.85, chase: 1.3, targetSpeed: 2.25, keeperSpeed: 1.5, trickTarget: 7, slideSpeed: 15, keeperReach: 2.0 }
].map((level, index) => Object.freeze({
  length: 67, focus: 'All-round football', pattern: 'classic', trickTarget: 3,
  maxTackles: 1, passCooldown: 4, heatMultiplier: 1, keeperReach: 1.65,
  slideSpeed: 10 + Math.min(index, 4),
  chapter: CHAPTERS[Math.floor(index / 5)], chapterIndex: Math.floor(index / 5), chapterStage: index % 5 + 1,
  ...level
})));

export const SKINS = Object.freeze([
  { id: 'classic', name: 'Matchday', cost: 0, color: '#f3f7f0' },
  { id: 'mint', name: 'Icebreaker', cost: 90, color: '#77f6de' },
  { id: 'ember', name: 'Afterburn', cost: 150, color: '#ff7942' },
  { id: 'gold', name: 'Golden Hour', cost: 230, color: '#ffcd59' },
  { id: 'cosmic', name: 'Supernova', cost: 320, color: '#c3a1ff' }
]);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const noop = () => {};
const START_Z = 32;
const BOX_Z = -35;
const GOAL_Z = -49;
const BALL_Y = 0.48;

function emptyState(skin = 'classic') {
  return {
    mode: 'home', time: 0, levelIndex: 0, skin,
    ball: { x: 0, y: BALL_Y, z: 18 },
    heat: 0, comet: false, cometTime: 0,
    defenders: [], coins: [],
    teammate: { x: 5.5, z: 11, active: true },
    keeperX: 0, targetX: 0, targetSafe: false,
    keeperReach: 1.65, shotProgress: 0, goalScored: false,
    pass: { active: false, t: 0, fromX: 0, fromZ: 0, toX: 0, toZ: 0 },
    passCooldown: 0, passCooldownMax: 4, trickTarget: 3, maxTackles: 1,
    invulnerable: 0, cameraShake: 0,
    lives: 3, tackles: 0, tricks: 0, nutmegs: 0, dodges: 0, passes: 0,
    runCoins: 0, progress: 0, distanceLeft: 67, result: null,
    elapsed: 0, aimTime: 0, combo: 0, bestCombo: 0, comboTime: 0, multiplier: 1,
    focus: 65, focusing: false, focusHeld: false, perfectShot: false, celebrationTime: 0
  };
}

export class GameEngine {
  constructor(onEvent = noop) {
    this.onEvent = typeof onEvent === 'function' ? onEvent : noop;
    this.state = emptyState();
    this.inputX = 0;
    this.previousMode = 'playing';
    this.home();
  }

  emit(type, message, extra = {}) {
    this.onEvent({ type, message, ...extra });
  }

  home() {
    const skin = this.state?.skin || 'classic';
    this.state = emptyState(skin);
    this.state.defenders = [
      { id: 0, x: -2.8, z: 6, phase: 'chase', timer: 0, dir: 1, done: false, kind: 'guard' },
      { id: 1, x: 2.5, z: -5, phase: 'warn', timer: 1, dir: 1, done: false, laneX: 2.5, laneEnd: 8, kind: 'tackler' },
      { id: 2, x: -5, z: -16, phase: 'chase', timer: 0, dir: 1, done: false, kind: 'guard' },
      { id: 3, x: 3.5, z: -25, phase: 'chase', timer: 0, dir: 1, done: false, kind: 'tackler' }
    ];
    this.state.coins = Array.from({ length: 8 }, (_, i) => ({ id: i, x: Math.sin(i * 0.9) * 3.8, z: 9 - i * 5.2, collected: false }));
    this.inputX = 0;
    return this.state;
  }

  setSkin(id) {
    if (SKINS.some(skin => skin.id === id)) this.state.skin = id;
  }

  start(levelIndex = 0) {
    const skin = this.state.skin;
    const index = clamp(Math.floor(Number(levelIndex) || 0), 0, LEVELS.length - 1);
    const level = LEVELS[index];
    this.state = emptyState(skin);
    const s = this.state;
    s.mode = 'playing';
    s.levelIndex = index;
    s.passCooldownMax = level.passCooldown;
    s.trickTarget = level.trickTarget;
    s.maxTackles = level.maxTackles;
    s.keeperReach = level.keeperReach;
    s.ball.z = START_Z;
    s.distanceLeft = level.length;
    s.teammate = { x: 5.7, z: START_Z - 4, active: true };
    // Alternating guards and tacklers give both nutmeg and dodge opportunities.
    // The first guard is central and slow: a readable introduction to nutmegs.
    s.defenders = Array.from({ length: level.defenders }, (_, i) => {
      const z = 21 - i * (47 / Math.max(1, level.defenders - 1));
      let x = i === 0 ? 0 : Math.sin(i * 2.35 + index * 0.58) * 5.6;
      let kind = i % 3 === 0 ? 'guard' : 'tackler';
      if (level.pattern === 'nutmeg') {
        x = [0, -2.5, 2.5, 0][i % 4];
        kind = i % 4 === 3 ? 'tackler' : 'guard';
      } else if (level.pattern === 'staggered') {
        x = i === 0 ? 0 : (i % 2 ? 5.2 : -5.2);
        kind = i % 5 === 0 ? 'guard' : 'tackler';
      } else if (level.pattern === 'link') {
        x = i === 0 ? 0 : (i % 2 ? 5.8 : -5.8);
        kind = i % 4 === 0 ? 'guard' : 'tackler';
      } else if (level.pattern === 'furnace') {
        x = Math.sin(i * 1.8) * 5.6;
        kind = i % 4 === 0 ? 'guard' : 'tackler';
      } else if (level.pattern === 'sprint') {
        x = i === 0 ? 0 : (i % 2 ? 4.2 : -4.2);
      } else if (level.pattern === 'finale') {
        x = i === 0 ? 0 : Math.sin(i * 2.1) * 5.8;
        kind = i % 4 === 0 ? 'guard' : 'tackler';
      }
      return {
        id: i, x, z, originX: x, originZ: z,
        phase: 'chase', timer: 0, dir: 1, done: false,
        kind,
        laneX: x, laneEnd: z + 12, collided: false
      };
    });
    s.coins = Array.from({ length: 16 }, (_, i) => ({
      id: i, x: Math.sin(i * 0.85 + index * 0.4) * 5.2,
      z: 25 - i * 3.7, collected: false
    }));
    this.inputX = 0;
    this.previousMode = 'playing';
    this.emit('start', level.name, { levelIndex: index });
    return s;
  }

  steer(x) {
    if (Number.isFinite(x) && this.state.mode === 'playing') this.inputX = clamp(x, -8.4, 8.4);
  }

  pass() {
    const s = this.state;
    const passDistance = LEVELS[s.levelIndex].speed * (s.comet ? 1.08 : 1) * 0.9 + 0.5;
    if (s.mode !== 'playing' || s.pass.active || s.passCooldown > 0 || s.ball.z < BOX_Z + passDistance) return false;
    const side = s.ball.x > 0 ? -1 : 1;
    const toX = side * 6.3;
    s.teammate.x = toX;
    s.pass = { active: true, t: 0, fromX: s.ball.x, fromZ: s.ball.z, toX, toZ: s.ball.z - 3.5 };
    s.passCooldown = s.passCooldownMax;
    s.invulnerable = Math.max(s.invulnerable, 1.1);
    this.emit('pass', 'ONE–TWO', { x: s.ball.x, z: s.ball.z });
    return true;
  }

  setFocus(held) {
    const s = this.state;
    s.focusHeld = Boolean(held) && ['playing', 'aiming'].includes(s.mode);
    if (!s.focusHeld) s.focusing = false;
  }

  pause() {
    if (!['playing', 'aiming', 'shot', 'celebrating'].includes(this.state.mode)) return false;
    this.setFocus(false);
    this.previousMode = this.state.mode;
    this.state.mode = 'paused';
    return true;
  }

  resume() {
    if (this.state.mode !== 'paused') return false;
    this.state.mode = this.previousMode;
    return true;
  }

  awardTrick(name, heat, extra = {}) {
    const s = this.state;
    const gainedHeat = Math.round(heat * LEVELS[s.levelIndex].heatMultiplier);
    s.tricks += 1;
    s.combo += 1;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.comboTime = 5;
    s.multiplier = Math.min(3, 1 + Math.floor(s.combo / 3));
    const reward = 3 * s.multiplier;
    s.runCoins += reward;
    s.focus = Math.min(100, s.focus + 8);
    if (!s.comet) s.heat = Math.min(100, s.heat + gainedHeat);
    this.emit('trick', name, { heat: gainedHeat, coins: reward, combo: s.combo, multiplier: s.multiplier, ...extra });
    if (s.heat >= 100 && !s.comet) {
      s.comet = true;
      s.cometTime = 7;
      s.heat = 100;
      s.cameraShake = 0.22;
      this.emit('comet', 'COMET MODE', { duration: 7 });
    }
  }

  hit(defender) {
    const s = this.state;
    if (defender.done || defender.collided) return;
    defender.collided = true;
    defender.done = true;
    defender.phase = 'stunned';
    defender.timer = 0;
    if (s.comet) {
      this.awardTrick('FIREBALL', 0, { kind: 'fireball' });
      return;
    }
    if (s.invulnerable > 0 || s.pass.active) return;
    s.lives -= 1;
    s.tackles += 1;
    s.combo = 0; s.comboTime = 0; s.multiplier = 1;
    s.heat = Math.max(0, s.heat - 18);
    s.invulnerable = 1.5;
    s.cameraShake = 0.55;
    this.emit('hit', s.lives === 1 ? 'LAST CHANCE' : 'TACKLED', { lives: s.lives });
    if (s.lives <= 0) this.finish(false, 'Tackled out');
  }

  shoot() {
    const s = this.state;
    if (s.mode !== 'aiming') return false;
    s.shotTargetX = s.targetX;
    s.shotKeeperX = s.keeperX;
    s.shotStartX = s.ball.x;
    s.shotStartZ = s.ball.z;
    s.keeperReach = LEVELS[s.levelIndex].keeperReach - (s.comet ? 0.5 : 0);
    s.goalScored = Math.abs(s.targetX - s.keeperX) > s.keeperReach;
    s.perfectShot = s.goalScored && Math.abs(s.targetX) >= 3.25;
    this.setFocus(false);
    s.mode = 'shot';
    s.shotProgress = 0;
    this.emit('shoot', s.comet ? 'COMET STRIKE' : 'STRIKE', { goal: s.goalScored });
    return true;
  }

  finish(won, reason = '') {
    const s = this.state;
    if (s.mode === 'result') return;
    const stars = won ? 1 + Number(s.tackles <= s.maxTackles) + Number(s.tricks >= s.trickTarget) : 0;
    const bonusCoins = won ? 20 + stars * 10 + s.levelIndex * 5 + (s.perfectShot ? 15 : 0) : 0;
    s.result = {
      won, stars, coins: s.runCoins + bonusCoins, runCoins: s.runCoins,
      bonusCoins, tricks: s.tricks, tackles: s.tackles, levelIndex: s.levelIndex,
      trickTarget: s.trickTarget, maxTackles: s.maxTackles,
      nutmegs: s.nutmegs, passes: s.passes, dodges: s.dodges,
      bestCombo: s.bestCombo, perfectShot: s.perfectShot, perfectBonus: won && s.perfectShot ? 15 : 0, reason, elapsed: s.elapsed,
      allComplete: won && s.levelIndex === LEVELS.length - 1,
      starGoals: [won, won && s.tackles <= s.maxTackles, won && s.tricks >= s.trickTarget]
    };
    this.setFocus(false);
    s.mode = 'result';
    s.pass.active = false;
    this.emit('result', won ? 'GOAL!' : reason, { ...s.result, result: s.result });
  }

  update(dt) {
    const s = this.state;
    if (!Number.isFinite(dt) || dt <= 0 || s.mode === 'paused') return s;
    dt = Math.min(dt, 0.05);
    const realDt = dt;
    const canFocus = ['playing', 'aiming'].includes(s.mode);
    s.focusing = canFocus && s.focusHeld && s.focus > 0;
    if (s.focusing) {
      s.focus = Math.max(0, s.focus - realDt * 28);
      if (s.focus === 0) { s.focusHeld = false; s.focusing = false; }
      dt *= 0.42;
    } else if (s.mode === 'playing') s.focus = Math.min(100, s.focus + realDt * 4);
    if (s.mode === 'playing') {
      s.comboTime = Math.max(0, s.comboTime - dt);
      if (s.comboTime === 0) { s.combo = 0; s.multiplier = 1; }
    }
    s.time += dt;
    s.cameraShake = Math.max(0, s.cameraShake - dt * 2);
    if (s.mode === 'home') {
      s.keeperX = Math.sin(s.time * 0.65) * 2.3;
      return s;
    }
    if (s.mode === 'result') return s;
    if (s.mode === 'celebrating') {
      s.celebrationTime += realDt;
      if (s.celebrationTime >= 1.2) this.finish(s.goalScored, s.goalScored ? '' : 'Keeper saves');
      return s;
    }
    const level = LEVELS[s.levelIndex];
    s.elapsed += realDt;
    s.invulnerable = Math.max(0, s.invulnerable - dt);
    s.passCooldown = Math.max(0, s.passCooldown - dt);
    // Comet time freezes in the shooting challenge; earning fire on the run
    // therefore always carries into the finish if it is still active at the box.
    if (s.comet && s.mode === 'playing') {
      s.cometTime = Math.max(0, s.cometTime - dt);
      if (s.cometTime <= 0) {
        s.comet = false;
        s.heat = 30;
        this.emit('cooldown', 'KEEP THE HEAT');
      }
    }
    if (s.mode === 'aiming') {
      s.aimTime += dt;
      s.targetX = Math.sin(s.aimTime * level.targetSpeed * 2.2 - 0.65) * 4.1;
      s.keeperX = Math.sin(s.aimTime * level.keeperSpeed * 1.7 + 0.85) * 2.65;
      s.keeperReach = level.keeperReach - (s.comet ? 0.5 : 0);
      s.targetSafe = Math.abs(s.targetX - s.keeperX) > s.keeperReach;
      return s;
    }
    if (s.mode === 'shot') {
      s.shotProgress = Math.min(1, s.shotProgress + dt / 0.95);
      const t = s.shotProgress;
      const destinationX = s.goalScored ? s.shotTargetX : lerp(s.shotTargetX, s.shotKeeperX, 0.30);
      s.ball.x = lerp(s.shotStartX, destinationX, t);
      s.ball.z = lerp(s.shotStartZ, s.goalScored ? GOAL_Z - 0.5 : GOAL_Z + 1.8, t);
      s.ball.y = BALL_Y + Math.sin(t * Math.PI) * 3.1 + t * 1.1;
      s.keeperX = lerp(s.shotKeeperX, s.shotTargetX, Math.min(0.8, t * 0.9));
      if (t >= 1) {
        s.mode = 'celebrating'; s.celebrationTime = 0;
        this.emit(s.goalScored ? 'goal' : 'save', s.goalScored ? (s.perfectShot ? 'TOP BINS!' : 'GOAL!') : 'KEEPER SAVES', { perfect: s.perfectShot });
      }
      return s;
    }
    if (s.mode !== 'playing') return s;

    const speed = level.speed * (s.comet ? 1.08 : 1);
    s.ball.z -= speed * dt;
    if (s.pass.active) {
      s.pass.t = Math.min(1, s.pass.t + dt / 0.9);
      const t = s.pass.t;
      // Meet the teammate at the midpoint, then receive the return pass.
      // The extra forward arc preserves the normal net running distance.
      const lead = (s.pass.fromZ - s.pass.toZ) - speed * 0.45;
      s.ball.z = s.pass.fromZ - speed * 0.9 * t - Math.sin(t * Math.PI) * lead;
      if (t < 0.5) {
        s.ball.x = lerp(s.pass.fromX, s.pass.toX, Math.sin(t * Math.PI));
      } else {
        s.ball.x = lerp(s.pass.toX, this.inputX, 1 - Math.cos((t - 0.5) * Math.PI));
      }
      s.ball.y = BALL_Y + Math.sin(t * Math.PI * 2) ** 2 * 0.7;
      if (t >= 1) {
        s.pass.active = false;
        s.ball.x = this.inputX;
        s.ball.y = BALL_Y;
        s.passes += 1;
        this.awardTrick('ONE–TWO', 26, { kind: 'pass' });
      }
    } else {
      s.ball.x = lerp(s.ball.x, this.inputX, 1 - Math.exp(-14 * dt));
      s.ball.y = BALL_Y;
    }
    s.ball.x = clamp(s.ball.x, -8.4, 8.4);
    if (!s.pass.active) {
      const side = s.ball.x > 1 ? -1 : s.ball.x < -1 ? 1 : Math.sign(s.teammate.x) || 1;
      s.teammate.x = lerp(s.teammate.x, side * 6.3, 1 - Math.exp(-3 * dt));
    }
    s.teammate.z = s.pass.active ? s.pass.toZ : s.ball.z - 4;
    s.teammate.active = true;

    for (const coin of s.coins) {
      if (!coin.collected && Math.abs(coin.z - s.ball.z) < 1.0 && Math.abs(coin.x - s.ball.x) < 0.9) {
        coin.collected = true;
        s.runCoins += 2;
        s.focus = Math.min(100, s.focus + 3);
        this.emit('coin', '+2', { coins: 2, x: coin.x, z: coin.z });
      }
    }

    for (const d of s.defenders) {
      if (s.mode !== 'playing') break;
      if (d.done) { d.timer += dt; continue; }
      let gap = s.ball.z - d.z;
      if (d.phase === 'chase') {
        if (gap > 0 && gap < 15) {
          // Guards deliberately preserve a readable leg gap until contact.
          const chase = d.kind === 'guard' ? level.chase * 0.3 : level.chase;
          d.x += clamp(s.ball.x - d.x, -1, 1) * chase * dt;
        }
        const activeLanes = s.defenders.filter(other => !other.done && ['warn', 'slide'].includes(other.phase)).length;
        if (d.kind === 'tackler' && gap > 0 && gap < 9 && (level.pattern === 'classic' || activeLanes < 2)) {
          d.phase = 'warn';
          d.timer = level.warning;
          d.x = s.ball.x;
          d.laneX = d.x;
          d.laneEnd = s.ball.z + 3;
          this.emit('warning', 'DODGE THE RED LANE', { laneX: d.x });
        }
      } else if (d.phase === 'warn') {
        d.timer -= dt;
        if (d.timer <= 0) {
          d.phase = 'slide';
          d.timer = 0;
          this.emit('slide', 'SLIDE TACKLE', { laneX: d.x });
        }
      } else if (d.phase === 'slide') {
        d.timer += dt;
        d.z += level.slideSpeed * dt;
      }
      gap = s.ball.z - d.z;
      const dx = Math.abs(s.ball.x - d.x);
      if (Math.abs(gap) < 0.85) {
        if (d.phase === 'chase' && d.kind === 'guard' && dx < 0.39 && !s.pass.active) {
          d.done = true;
          d.phase = 'stunned';
          d.timer = 0;
          s.nutmegs += 1;
          this.awardTrick('NUTMEG!', 34, { kind: 'nutmeg' });
        } else if (dx < (d.phase === 'slide' ? 1.05 : 1.12)) {
          this.hit(d);
        }
      }
      if (!d.done && gap < -1.5) {
        d.done = true;
        if (d.phase === 'slide' || d.phase === 'warn') {
          s.dodges += 1;
          this.awardTrick('CLEAN DODGE', 20, { kind: 'dodge' });
        }
        d.phase = 'stunned';
        d.timer = 0;
      }
    }

    s.progress = clamp((START_Z - s.ball.z) / level.length, 0, 1);
    s.distanceLeft = Math.max(0, s.ball.z - BOX_Z);
    s.keeperX = Math.sin(s.time * level.keeperSpeed) * 2.5;
    if (s.mode === 'playing' && s.ball.z <= BOX_Z) {
      s.ball.z = BOX_Z;
      s.ball.y = BALL_Y;
      s.pass.active = false;
      s.mode = 'aiming';
      s.aimTime = 0;
      s.progress = 1;
      s.distanceLeft = 0;
      s.targetX = Math.sin(-0.65) * 4.1;
      s.keeperX = Math.sin(0.85) * 2.65;
      s.keeperReach = level.keeperReach - (s.comet ? 0.5 : 0);
      s.targetSafe = Math.abs(s.targetX - s.keeperX) > s.keeperReach;
      this.emit('aim', 'TIME YOUR SHOT', { comet: s.comet });
    }
    return s;
  }
}
