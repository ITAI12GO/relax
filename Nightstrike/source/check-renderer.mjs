import assert from 'node:assert/strict';
import {GameEngine} from './dist/engine.js';
import {StadiumRenderer} from './dist/renderer.js';

// CPU-side geometry/draw-contract checks. This intentionally does not pretend
// to compile shaders or replace WebGL/browser visual testing.
let buffer, draws = 0, uploaded = 0, boneUploads = 0, viewport = [];
const attributes = new Map(), shaders = [];
const noop = () => {};
const finite = values => assert.ok([...values].every(Number.isFinite), 'GPU input must be finite');
const gl = new Proxy({
  createShader: () => ({}), shaderSource: (shader, source) => shaders.push(source), compileShader: noop,
  getShaderParameter: () => true, getShaderInfoLog: () => '', createProgram: () => ({}), attachShader: noop,
  linkProgram: noop, getProgramParameter: () => true, getProgramInfoLog: () => '', useProgram: noop,
  getAttribLocation: (_, name) => {if (!attributes.has(name)) attributes.set(name, attributes.size); return attributes.get(name);},
  getUniformLocation: (_, name) => name,
  createBuffer: () => ({}), bindBuffer: (_, value) => buffer = value,
  bufferData: (_, data) => {
    finite(data); assert.equal(data.length % 36, 0); buffer.count = data.length / 12; uploaded += buffer.count;
    for (let i = 0; i < data.length; i += 12) {
      const length = Math.hypot(data[i + 3], data[i + 4], data[i + 5]);
      assert.ok(Math.abs(length - 1) < .002, 'Baked normals must stay normalized');
      assert.equal(data[i + 11] % 1, 0); assert.ok(data[i + 11] >= 0 && data[i + 11] < 13);
    }
  },
  vertexAttribPointer: (_, size, type, normalized, stride, offset) => {
    assert.equal(stride, 48); assert.ok(size >= 1 && size <= 3); assert.ok(offset + size * 4 <= stride);
  },
  uniformMatrix4fv: (name, transpose, value) => {
    assert.equal(transpose, false); finite(value);
    assert.equal(value.length, name === 'uBones[0]' ? 208 : 16);
    if (name === 'uBones[0]') boneUploads++;
  },
  uniform1f: (_, value) => assert.ok(Number.isFinite(value)), uniform1i: noop,
  uniform3fv: (_, value) => {assert.equal(value.length, 3); finite(value);},
  uniform4fv: (_, value) => {assert.equal(value.length, 4); finite(value);},
  drawArrays: (_, offset, count) => {assert.equal(offset, 0); assert.equal(count, buffer.count); draws++;},
  viewport: (...args) => viewport = args,
  createTexture: () => ({}), bindTexture: noop, texImage2D: noop, texParameteri: noop, pixelStorei: noop,
  enableVertexAttribArray: noop, clearColor: noop, blendFuncSeparate: noop, enable: noop, disable: noop, clear: noop, depthMask: noop
}, {get(target, key) {if (key in target) return target[key]; if (/^[A-Z0-9_]+$/.test(key)) return String(key); throw new Error('Unmocked GL method: ' + String(key));}});
const context2d = {fillRect: noop, strokeRect: noop, fillText: noop, createRadialGradient: () => ({addColorStop: noop})};
globalThis.document = {createElement: () => ({getContext: () => context2d})};
globalThis.window = {devicePixelRatio: 3, innerWidth: 390, innerHeight: 844};
const canvas = {clientWidth: 390, clientHeight: 844, getBoundingClientRect() {return {width: this.clientWidth, height: this.clientHeight};}, getContext: () => gl};
const renderer = new StadiumRenderer(canvas), game = new GameEngine();
assert.equal(renderer.playerMeshes.size, 9); assert.equal(shaders.length, 2);
assert.ok(uploaded < 500000, 'Geometry must remain bounded for mobile memory');

const views = [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1440,900],[2560,1440]];
let maxDraws = 0;
for (const [width, height] of views) {
  canvas.clientWidth = width; canvas.clientHeight = height;
  renderer.resize(); assert.ok(canvas.width <= Math.ceil(width * 1.75)); assert.ok(canvas.height <= Math.ceil(height * 1.75));
  assert.deepEqual(viewport, [0,0,canvas.width,canvas.height]);
  for (const camera of ['wide','chase']) {
    renderer.setOptions({camera});
    for (const stage of [0,5,14]) {
      game.start(stage);
      for (const x of [-6.8, 0, 6.8]) {
        game.state.ball.x = x; renderer.cameraInitialized = false; draws = 0;
        renderer.render(game.state,1/60); maxDraws = Math.max(maxDraws,draws);
        const p = renderer.project(x,.5,game.state.ball.z);
        assert.ok(p.visible && p.x > 0 && p.x < width && p.y > 0 && p.y < height, `Ball visible at ${width}×${height} ${camera}, x=${x}`);
      }
    }
    game.state.mode = 'aiming'; renderer.cameraInitialized = false;
    renderer.render(game.state,1/60);
    for (const x of [-6,6]) {const p=renderer.project(x,2,-49); assert.ok(p.visible && p.x>0 && p.x<width, `Both goalposts visible at ${width}×${height}`);}
  }
}

for (const mode of ['home','playing','aiming','shot','celebrating','paused','result']) {
  game.start(14); Object.assign(game.state,{mode,comet:true,heat:100,focusing:true,shotProgress:.8,shotTargetX:3.8,shotKeeperX:-1,goalScored:true});
  game.state.defenders.forEach((d,i)=>d.phase=['chase','warn','slide','stunned'][i%4]);
  renderer.burst(0,1,-49,'goal'); renderer.render(game.state,1/60);
}
assert.ok(boneUploads > 0); assert.ok(maxDraws < 160, `Normal play draw budget: ${maxDraws}`);
renderer.setOptions({quality:'low'});assert.equal(canvas.width,canvas.clientWidth);
renderer.particles=[];renderer.burst(0,1,0,'goal');assert.equal(renderer.particles.length,22);
renderer.setOptions({reducedMotion:true});renderer.burst(0,1,0,'goal');
assert.equal(renderer.particles.length,0);assert.equal(renderer.trail.length,0);
renderer.render(game.state,1/60);assert.equal(renderer.netRipple,0);
console.log(`PASS — ${uploaded.toLocaleString()} vertices; 9 athlete meshes; finite matrices and normals; ${maxDraws} maximum normal-play draws`);
console.log('PASS — ball/goal framing at 7 phone, tablet and desktop sizes; both cameras; all modes; graphics quality and reduced effects');
