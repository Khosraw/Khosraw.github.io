'use strict';
// Untergrund: a Game of Life that the music writes into.
//
// analysis/<slug>.json (from analyze.py) gives, at 60 frames per second:
//   new[24]   energy that was absent 1, 2 and 4 bars ago  -> coherent cell injection
//   flux[24]  whitened per-band transients                 -> sparse sparks, slice glitches
//   vhit[8]   the track's instruments (NMF voices): when each hits, scaled by how much it
//             stands out (vsal, 15 fps)                  -> one lane per instrument
//   laser, laser_y                                       -> two bars that ride a pitch sweep
//   pace, tension, beats, beat_kick, sections (kind + repeat label), rms, delta, ...
// The automaton has momentum: its speed (steps per beat) chases the track's pace with
// inertia, and every kick shoves it forward. One intensity level carries across sections and
// sets grain and density; the strobe is set per section and gated by the kick. Stamps land on
// beats, scene changes on section boundaries. Output is strictly 1-bit.

const $ = (s) => document.querySelector(s);
const canvas = $('#gl');
const dbg = $('#dbg');
const dctx = dbg.getContext('2d');
const audio = $('#audio');
const hud = $('#hud');
const menu = $('#menu');
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false });
if (!gl) document.body.textContent = 'WebGL2 is not available.';

const NB = 24;

// ---------------------------------------------------------------- rules
const RULES = {
  life: 'B3/S23', highlife: 'B36/S23', daynight: 'B3678/S34678', seeds: 'B2/S', maze: 'B3/S12345',
  mazectric: 'B3/S1234', coral: 'B3/S45678', anneal: 'B4678/S35678', replicator: 'B1357/S1357',
  move: 'B368/S245', diamoeba: 'B35678/S5678', amoeba: 'B357/S1358', serviettes: 'B234/S',
  twobytwo: 'B36/S125', longlife: 'B345/S5', stains: 'B3678/S235678', walled: 'B45678/S2345',
};
function ruleMask(name) {
  const [b, s] = RULES[name].split('/');
  const m = (x) => [...x.slice(1)].reduce((a, c) => a | (1 << +c), 0);
  return [m(b), m(s)];
}

// ---------------------------------------------------------------- scenes
// map: 0 radial, 1 columns from centre, 2 rows from centre, 3 angle, 4 tiles (one per band)
// sym: 0 none, 1 mirror x, 2 mirror xy, 3 four-fold rotation, 4 eight-fold
// dither: 0 hashed noise, 1 ordered (Bayer) — ordered injection reads as structure the rule then erodes
const SCENES = {
  intro: [
    { rule: 'life', cell: 5, map: 0, sym: 2, dither: 1, glitch: 0.15 },
    { rule: 'maze', cell: 6, map: 4, sym: 0, dither: 1, glitch: 0.1 },
  ],
  groove: [
    { rule: 'life', cell: 3, map: 1, sym: 1, dither: 0, glitch: 0.45 },
    { rule: 'highlife', cell: 3, map: 2, sym: 2, dither: 1, glitch: 0.4 },
    { rule: 'move', cell: 4, map: 4, sym: 0, dither: 1, glitch: 0.35 },
    { rule: 'twobytwo', cell: 4, map: 3, sym: 4, dither: 0, glitch: 0.4 },
  ],
  drop: [
    { rule: 'life', cell: 2, map: 0, sym: 4, dither: 0, glitch: 0.8 },
    { rule: 'replicator', cell: 3, map: 1, sym: 2, dither: 1, glitch: 0.7 },
    { rule: 'life', cell: 2, map: 2, sym: 1, dither: 0, glitch: 0.9 },
    { rule: 'highlife', cell: 3, map: 4, sym: 0, dither: 1, glitch: 0.75 },
  ],
  build: [
    { rule: 'coral', cell: 4, map: 0, sym: 3, dither: 1, glitch: 0.35 },
    { rule: 'mazectric', cell: 4, map: 1, sym: 2, dither: 1, glitch: 0.3 },
  ],
  break: [
    { rule: 'anneal', cell: 7, map: 0, sym: 3, dither: 0, glitch: 0.1 },
    { rule: 'daynight', cell: 6, map: 3, sym: 4, dither: 0, glitch: 0.12 },
    { rule: 'diamoeba', cell: 8, map: 2, sym: 2, dither: 1, glitch: 0.08 },
  ],
  outro: [
    { rule: 'longlife', cell: 5, map: 0, sym: 2, dither: 1, glitch: 0.2 },
  ],
};

function hash32(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}
let rngState = 1;
const rnd = () => ((rngState = hash32(rngState + 0x9e3779b9)) / 4294967296);

// ---------------------------------------------------------------- GL
const VS = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1,3));
void main() { gl_Position = vec4(P[gl_VertexID], 0, 1); }`;

const COMMON = `#version 300 es
precision highp float; precision highp int;
uint pcg(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}
float rnd(ivec2 c, float s) { return float(pcg(uvec3(uvec2(c + 65536), uint(s)))) / 4294967295.0; }
float bayer(ivec2 c) {
  const int M[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
  int a = M[(c.y & 3) * 4 + (c.x & 3)];
  int b = M[((c.y >> 2) & 3) * 4 + ((c.x >> 2) & 3)];
  return (float(a * 16 + b) + 0.5) / 256.0;
}

vec2 fold(vec2 p, int sym) {
  if (sym == 1) p.x = abs(p.x);
  else if (sym == 2) p = abs(p);
  else if (sym == 3) { float a = mod(atan(p.y, p.x), 1.5707963); p = length(p) * vec2(cos(a), sin(a)); }
  else if (sym == 4) { p = abs(p); if (p.y > p.x) p = p.yx; }
  return p;
}

// Where a cell sits in the spectrum, 0..1 (24 bands). f: folded position from the centre,
// c: cell index, size: grid size. map 0 rings, 1 columns, 2 rows, 3 angle, 4 tiles.
float bandOf(vec2 f, vec2 c, vec2 size, int map, int sym) {
  vec2 h = size * 0.5;
  if (map == 0) return length(f) / h.y;
  if (map == 1) return abs(f.x) / h.x;
  if (map == 2) return abs(f.y) / h.y;
  if (map == 3) return fract(atan(f.y, f.x) / 6.2831853 + 1.0) * (sym >= 3 ? 4.0 : 1.0);
  ivec2 t = ivec2(floor((c / size) * vec2(6.0, 4.0)));
  return (float(t.y * 6 + t.x) + 0.5) / 24.0;
}
float segD(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// The seal stamped on kicks. Each section has its own: an n-pointed star polygon {n/k}
// and its layers, drawn one layer per beat and XOR-ed into the grid for Life to eat.
//   1 double outer ring   2 star {n/k}        4 inner ring        8 spokes
//   16 vertex circles     32 ring of runes    64 inner n-gon      128 seed of life
bool sigil(vec2 p, float unit, int m, int N, int K, float sR, float sW, float rot, float seed) {
  float R = sR * unit, w = max(0.75, sW * unit);
  float r = length(p);
  float a = atan(p.y, p.x) - rot;
  float n = float(N), TAU = 6.2831853;
  if ((m & 1) != 0 && abs(abs(r - R) - 1.6 * w) < 0.6 * w) return true;
  if ((m & 4) != 0 && abs(r - R * 0.42) < w) return true;
  if ((m & 8) != 0 && r > R * 0.42 && r < R) {
    float sa = TAU / n;
    if (abs(mod(a + sa * 0.5, sa) - sa * 0.5) * r < w) return true;
  }
  if ((m & (2 | 16 | 64)) != 0) {
    for (int i = 0; i < 12; i++) {
      if (i >= N) break;
      float ai = rot + TAU * float(i) / n;
      vec2 vi = R * vec2(cos(ai), sin(ai));
      if ((m & 2) != 0) {
        float aj = rot + TAU * float((i + K) % N) / n;
        if (segD(p, vi, R * vec2(cos(aj), sin(aj))) < w) return true;
      }
      if ((m & 16) != 0 && abs(length(p - vi) - R * 0.13) < w) return true;
      if ((m & 64) != 0) {
        float b0 = ai + TAU * 0.5 / n, b1 = b0 + TAU / n;
        if (segD(p, 0.42 * R * vec2(cos(b0), sin(b0)), 0.42 * R * vec2(cos(b1), sin(b1))) < w) return true;
      }
    }
  }
  if ((m & 32) != 0) {
    float r0 = R * 1.12, r1 = R * 1.34;
    if (r > r0 && r < r1) {
      float segs = n * 4.0;
      float fa = fract(a / TAU) * segs;
      vec2 lc = vec2(fract(fa), (r - r0) / (r1 - r0));
      uint bits = pcg(uvec3(uint(floor(fa)), uint(seed), 7u));
      ivec2 gc = ivec2(floor(lc * 3.0));
      if (lc.x > 0.14 && ((bits >> uint(gc.y * 3 + gc.x)) & 1u) == 1u) return true;
    }
  }
  if ((m & 128) != 0) {
    for (int i = 0; i < 6; i++) {
      float ai = rot + 1.0471976 * float(i);
      if (abs(length(p - 0.5 * R * vec2(cos(ai), sin(ai))) - 0.5 * R) < w) return true;
    }
  }
  return false;
}

`;

const STEP_FS = COMMON + `
uniform sampler2D uState;
uniform ivec2 uSize;
uniform int uBirth, uSurvive, uDoStep, uMap, uSym, uDither, uBlock, uSigMask, uSigN, uSigK, uShape, uNV;
uniform float uNew[24], uFlux[24], uVHit[8];
uniform float uSeed, uNewGain, uFluxGain, uKill, uSigR, uSigW, uSigRot, uSigSeed, uFill, uLineW, uThin, uTrailDecay;
uniform float uVoiceGain;
out vec4 o;

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(uState, c, 0);
  bool alive = s.r > 0.5;
  float age = s.g;
  float trail = s.b;
  if (uDoStep == 1) {
    int n = 0;
    for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) continue;
      ivec2 q = (c + ivec2(dx, dy) + uSize) % uSize;
      n += texelFetch(uState, q, 0).r > 0.5 ? 1 : 0;
    }
    bool next = alive ? ((uSurvive >> n) & 1) == 1 : ((uBirth >> n) & 1) == 1;
    age = next ? (alive ? min(1.0, age + 1.0 / 255.0) : 0.0) : 0.0;
    trail = (alive && !next) ? 1.0 : max(0.0, trail - uTrailDecay);
    alive = next;
  }
  vec2 half_ = vec2(uSize) * 0.5;
  vec2 p = vec2(c) + 0.5 - half_;            // centred, exact mirror pairs
  vec2 f = fold(p, uSym);
  ivec2 fc = ivec2(floor(f));                // folded cell: symmetric cells share hashes
  float b = bandOf(f, vec2(c), vec2(uSize), uMap, uSym);
  float bf = b * 24.0;
  int bi = clamp(int(bf), 0, 23);
  float pn = pow(uNew[bi], 1.4) * uNewGain;
  float pf = pow(uFlux[bi], 2.0) * uFluxGain;
  ivec2 blk = ivec2(floor(vec2(fc) / float(uBlock)));
  float th = uDither == 1 ? bayer(fc) : rnd(fc, uSeed + 3.0);
  // new material fills its band's region in coherent blocks; transients draw a thin line at the
  // band's centre (a ring, a column, a row), so a hi-hat is a line, not noise
  bool line = abs(fract(bf) - 0.5) < uLineW && b < 1.0;
  bool inj = (b < 1.0 && rnd(blk, uSeed) < pn && th < 0.55) || (line && th < pf);
  if (uNV > 0 && b < 1.0) {
    // each instrument owns a lane (low ones inside, high ones outside; rings of equal area) and
    // every hit throws a burst of blocks into it, so a loop or a held note stays on screen after
    // its first bar and the lane goes quiet when the instrument stops
    int vi = clamp(int((uMap == 0 ? b * b : b) * float(uNV)), 0, uNV - 1);
    ivec2 vb = ivec2(floor(vec2(fc) / float(uBlock * 2)));
    if (rnd(vb, uSeed + 11.0) < pow(uVHit[vi], 1.5) * uVoiceGain && th < 0.6) inj = true;
  }
  if (uFill > 0.0 && th < uFill) inj = true;
  if (inj && !alive) { alive = true; age = 0.0; }
  if (uShape > 0) {
    // the plain kick shapes: 1 ring, 2 square, 3 diamond, 4 cross, 5 horizontal bars
    float R = uSigR * half_.y, w = max(1.0, uSigW * half_.y);
    vec2 a = abs(p);
    float d = 1e9;
    if (uShape == 1) d = abs(length(p) - R);
    else if (uShape == 2) d = abs(max(a.x, a.y) - R);
    else if (uShape == 3) d = abs(a.x + a.y - R);
    else if (uShape == 4) d = (max(a.x, a.y) < R) ? min(a.x, a.y) : 1e9;
    else if (uShape == 5) d = abs(a.y - R);
    if (d < w) { alive = !alive; age = 0.0; }
  } else if (uSigMask > 0 && sigil(p, half_.y, uSigMask, uSigN, uSigK, uSigR, uSigW, uSigRot, uSigSeed)) { alive = !alive; age = 0.0; }
  if (uKill > 0.0 && rnd(c, uSeed + 7.0) < uKill) { alive = false; age = 0.0; trail = 0.0; }
  if (uThin > 0.0 && alive && age > 2.0 / 255.0 && rnd(c, uSeed + 5.0) < uThin * (0.5 + age * 8.0)) { alive = false; age = 0.0; trail = 0.0; }
  if (alive) trail = 0.0;
  o = vec4(alive ? 1.0 : 0.0, age, trail, 1.0);
}`;

const RESAMPLE_FS = COMMON + `
uniform sampler2D uOld; uniform ivec2 uOldSize, uSize;
out vec4 o;
void main() {
  vec2 uv = (gl_FragCoord.xy) / vec2(uSize);
  o = texelFetch(uOld, ivec2(uv * vec2(uOldSize)), 0);
}`;

// 16x16 summary of the grid: each pixel averages 64 cells of its region
const POP_FS = COMMON + `
uniform sampler2D uState; uniform ivec2 uSize;
out vec4 o;
void main() {
  ivec2 r = ivec2(gl_FragCoord.xy);
  vec2 cellsPer = vec2(uSize) / 16.0;
  float n = 0.0;
  for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) {
    ivec2 c = ivec2((vec2(r) + (vec2(i, j) + 0.5) / 8.0) * cellsPer);
    n += texelFetch(uState, c, 0).r;
  }
  o = vec4(n / 64.0, 0.0, 0.0, 1.0);
}`;

// Draws the current grid, and during a section change also the previous one: a 1-bit
// dissolve that spreads from the centre outward (Bayer dither + distance), so a new
// resolution or layout grows through the old one instead of cutting.
const RENDER_FS = COMMON + `
uniform sampler2D uState, uOldState;
uniform ivec2 uSize, uOldSize;
uniform vec2 uRes;
uniform float uCell, uOldCell, uMix, uSliceH, uColW, uSnow, uSeed, uTrail;
uniform float uSlice[48], uCol[32];
uniform vec4 uBlocks[8];
uniform vec2 uBlockOff[8];
uniform int uNBlocks, uInvert, uSigMask, uSigN, uSigK;
uniform float uSigR, uSigW, uSigRot, uSigSeed, uSigFade;
uniform float uLaser, uLaserY, uZoom, uRot;
uniform vec2 uShift;
out vec4 o;

bool cellAt(sampler2D tex, ivec2 size, float cell, vec2 p) {
  // centre the grid on the screen so symmetric scenes are symmetric on screen
  vec2 gp = p - (uRes - vec2(size) * cell) * 0.5;
  ivec2 c = ivec2(floor(gp / cell));
  c = ((c % size) + size) % size;
  c.y = size.y - 1 - c.y;
  vec4 s = texelFetch(tex, c, 0);
  bool v = s.r > 0.5;
  float ins = cell >= 6.0 ? max(1.0, floor(cell / 6.0)) : 0.0;
  if (v && ins > 0.0) {
    // settled cells shrink to a dot, very old ones to an outline: still 1-bit, but texture shows age
    vec2 fr = mod(gp, cell);
    float inset = s.g > 0.06 ? ins : 0.0;
    bool inside = all(greaterThanEqual(fr, vec2(inset))) && all(lessThan(fr, vec2(cell - inset)));
    if (s.g > 0.25) {
      float e = ins + 1.0;
      bool core = all(greaterThanEqual(fr, vec2(e + inset))) && all(lessThan(fr, vec2(cell - e - inset)));
      inside = inside && !core;
    }
    v = inside;
  }
  if (!v && s.b > 0.0) {
    // recently dead cells fade out as an ordered dot pattern: at speed this reads as motion blur
    ivec2 dp = ivec2(floor(gp / max(1.0, floor(cell / 2.0))));
    v = bayer(dp) < s.b * uTrail;
  }
  return v;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  {
    // camera: zoom and turn about the centre. Below 1 the toroidal grid shows as tiles.
    vec2 q = p - uRes * 0.5;
    float cs = cos(uRot), sn = sin(uRot);
    p = uRes * 0.5 + mat2(cs, -sn, sn, cs) * q / uZoom + uShift;
  }
  int si = int(p.y / uSliceH);
  if (si >= 0 && si < 48) p.x += uSlice[si];
  int ci = int(p.x / uColW);
  if (ci >= 0 && ci < 32) p.y += uCol[ci];
  for (int i = 0; i < 8; i++) {
    if (i >= uNBlocks) break;
    vec4 bl = uBlocks[i];
    if (p.x >= bl.x && p.y >= bl.y && p.x < bl.x + bl.z && p.y < bl.y + bl.w) p += uBlockOff[i];
  }
  bool v;
  if (uMix >= 1.0) v = cellAt(uState, uSize, uCell, p);
  else {
    float d = length(p - uRes * 0.5) / length(uRes * 0.5);
    float blk = max(uCell, uOldCell);
    float th = 0.55 * d + 0.45 * bayer(ivec2(floor(p / blk)));
    v = th < uMix ? cellAt(uState, uSize, uCell, p) : cellAt(uOldState, uOldSize, uOldCell, p);
  }
  if (uLaser > 0.0) {
    // two bars mirrored about the middle, riding the laser's pitch (higher = further apart),
    // thicker the stronger it is; they invert what is under them
    float hy = uRes.y * 0.5;
    float d = abs(abs(p.y - hy) - uLaserY * hy);
    if (d < uCell * (0.5 + 5.0 * uLaser)) v = !v;
  }
  if (uSigFade > 0.0) {
    // the seal lingers for about a beat over the automaton, thinning out as a dither
    // sampled at cell centres, so it lines up with the copy stamped into the grid
    vec2 pc = floor((p - uRes * 0.5) / uCell) + 0.5;
    pc.y = -pc.y;
    if (bayer(ivec2(floor(pc + 4096.0))) < uSigFade &&
        sigil(pc, float(uSize.y) * 0.5, uSigMask, uSigN, uSigK, uSigR, uSigW, uSigRot, uSigSeed)) v = true;
  }
  if (uSnow > 0.0 && rnd(ivec2(floor(p / uCell)), uSeed) < uSnow) v = !v;
  if (uInvert == 1) v = !v;
  o = vec4(vec3(v ? 1.0 : 0.0), 1.0);
}`;

function compile(fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    gl.attachShader(p, sh);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const locs = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
    locs[name] = gl.getUniformLocation(p, gl.getActiveUniform(p, i).name);
  }
  return { p, u: locs };
}
const P_STEP = compile(STEP_FS);
const P_RESAMPLE = compile(RESAMPLE_FS);
const P_RENDER = compile(RENDER_FS);
const P_POP = compile(POP_FS);
gl.bindVertexArray(gl.createVertexArray());

// Grid textures are pooled by size: allocating them mid-song stalled a frame at every
// section change. A freed grid goes back to the pool and the next one of that size reuses it.
const pool = new Map();
function takeTarget(w, h) {
  const free = pool.get(`${w}x${h}`);
  return free && free.length ? free.pop() : makeTarget(w, h);
}
function giveTarget(w, h, t) {
  const k = `${w}x${h}`;
  if (!pool.has(k)) pool.set(k, []);
  pool.get(k).push(t);
}
// warm the pool with every grid size this screen can use, before the music starts
function warmPool(dpr) {
  for (let css = 2; css <= 8; css++) {
    const px = Math.round(css * dpr);
    const w = Math.max(8, Math.ceil(canvas.width / px)), h = Math.max(8, Math.ceil(canvas.height / px));
    const have = (pool.get(`${w}x${h}`) || []).length;
    for (let i = have; i < 4; i++) giveTarget(w, h, makeTarget(w, h));
  }
}

function makeTarget(w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
    [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fb };
}

// G is the live grid; OLD is the previous one, still running, while a dissolve is in progress
let G = null, OLD = null;
const mixer = { start: 0, dur: 0 };

function makeGrid(cellPx, from) {
  const w = Math.max(8, Math.ceil(canvas.width / cellPx));
  const h = Math.max(8, Math.ceil(canvas.height / cellPx));
  const g = { w, h, cellPx, a: takeTarget(w, h), b: takeTarget(w, h) };
  if (from) {
    gl.useProgram(P_RESAMPLE.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.a.fb);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, from.a.tex);
    gl.uniform1i(P_RESAMPLE.u.uOld, 0);
    gl.uniform2i(P_RESAMPLE.u.uOldSize, from.w, from.h);
    gl.uniform2i(P_RESAMPLE.u.uSize, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return g;
}
function freeGrid(g) {
  if (!g) return;
  giveTarget(g.w, g.h, g.a);
  giveTarget(g.w, g.h, g.b);
}
// Replace the live grid. With beats > 0 the old grid keeps running and dissolves into the new one.
function changeGrid(cellPx, beats, t) {
  const ng = makeGrid(cellPx, G);
  if (beats > 0 && G && A) {
    freeGrid(OLD);
    OLD = G;
    OLD.scene = st.scene;
    mixer.start = t;
    mixer.dur = beats * A.period;
  } else {
    freeGrid(G);
    freeGrid(OLD);
    OLD = null;
  }
  G = ng;
}
function mixAt(t) {
  if (!OLD) return 1;
  const m = (t - mixer.start) / mixer.dur;
  if (m >= 1 || m < 0) { freeGrid(OLD); OLD = null; return 1; }
  return m * m * (3 - 2 * m);
}

let popTarget = null;
const popBuf = new Uint8Array(16 * 16 * 4);
let popLast = 0, popAt = 0;
// Throttled to four times a second: a readback makes the CPU wait for the GPU, and doing it
// every couple of steps added up to hitches.
function population() {
  const nowMs = performance.now();
  if (nowMs - popAt < 250) return popLast;
  popAt = nowMs;
  if (!popTarget) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 16, 16, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    popTarget = fb;
  }
  gl.useProgram(P_POP.p);
  gl.bindFramebuffer(gl.FRAMEBUFFER, popTarget);
  gl.viewport(0, 0, 16, 16);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, G.a.tex);
  gl.uniform1i(P_POP.u.uState, 0);
  gl.uniform2i(P_POP.u.uSize, G.w, G.h);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.readPixels(0, 0, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, popBuf);
  let n = 0;
  for (let i = 0; i < 256; i++) n += popBuf[i * 4];
  popLast = n / (256 * 255);
  return popLast;
}

const ZERO24 = new Float32Array(NB), ZERO48 = new Float32Array(48), ZERO32 = new Float32Array(32), ZERO8 = new Float32Array(8);
function step(o, grid = G) {
  gl.useProgram(P_STEP.p);
  const u = P_STEP.u;
  gl.bindFramebuffer(gl.FRAMEBUFFER, grid.b.fb);
  gl.viewport(0, 0, grid.w, grid.h);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, grid.a.tex);
  gl.uniform1i(u.uState, 0);
  gl.uniform2i(u.uSize, grid.w, grid.h);
  gl.uniform1i(u.uBirth, o.birth);
  gl.uniform1i(u.uSurvive, o.survive);
  gl.uniform1i(u.uDoStep, o.doStep ? 1 : 0);
  gl.uniform1i(u.uMap, o.map);
  gl.uniform1i(u.uSym, o.sym);
  gl.uniform1i(u.uDither, o.dither);
  gl.uniform1i(u.uBlock, o.block);
  gl.uniform1fv(u.uNew, o.newv || ZERO24);
  gl.uniform1fv(u.uFlux, o.flux || ZERO24);
  gl.uniform1i(u.uNV, o.nv || 0);
  gl.uniform1fv(u.uVHit, o.vhit || ZERO8);
  gl.uniform1f(u.uVoiceGain, o.voiceGain || 0);
  gl.uniform1f(u.uSeed, o.seed);
  gl.uniform1f(u.uNewGain, o.newGain);
  gl.uniform1f(u.uFluxGain, o.fluxGain);
  gl.uniform1f(u.uKill, o.kill || 0);
  gl.uniform1f(u.uFill, o.fill || 0);
  gl.uniform1f(u.uLineW, o.lineW || 0.06);
  gl.uniform1f(u.uThin, o.thin || 0);
  gl.uniform1f(u.uTrailDecay, o.trailDecay || 0.25);
  const sg = o.stamp;
  gl.uniform1i(u.uShape, sg && sg.shape ? sg.shape : 0);
  gl.uniform1i(u.uSigMask, sg && sg.mask ? sg.mask : 0);
  gl.uniform1i(u.uSigN, sg ? sg.n : 3);
  gl.uniform1i(u.uSigK, sg ? sg.k : 1);
  gl.uniform1f(u.uSigR, sg ? sg.r : 0);
  gl.uniform1f(u.uSigW, sg ? sg.w : 0);
  gl.uniform1f(u.uSigRot, sg ? sg.rot : 0);
  gl.uniform1f(u.uSigSeed, sg ? sg.seed : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  [grid.a, grid.b] = [grid.b, grid.a];
}

const fx = {
  slices: new Float32Array(48), sliceH: 8, sliceTTL: 0,
  cols: new Float32Array(32), colW: 64, colTTL: 0,
  blocks: new Float32Array(32), blockOff: new Float32Array(16), nBlocks: 0, blockTTL: 0,
};
function render(o) {
  gl.useProgram(P_RENDER.p);
  const u = P_RENDER.u;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  const old = o.mix < 1 && OLD ? OLD : G;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, G.a.tex);
  gl.uniform1i(u.uState, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, old.a.tex);
  gl.uniform1i(u.uOldState, 1);
  gl.uniform2i(u.uSize, G.w, G.h);
  gl.uniform2i(u.uOldSize, old.w, old.h);
  gl.uniform2f(u.uRes, canvas.width, canvas.height);
  gl.uniform1f(u.uCell, G.cellPx);
  gl.uniform1f(u.uOldCell, old.cellPx);
  gl.uniform1f(u.uMix, o.mix ?? 1);
  gl.uniform1f(u.uSliceH, fx.sliceH);
  gl.uniform1f(u.uColW, fx.colW);
  gl.uniform1fv(u.uSlice, fx.sliceTTL > 0 ? fx.slices : ZERO48);
  gl.uniform1fv(u.uCol, fx.colTTL > 0 ? fx.cols : ZERO32);
  gl.uniform4fv(u.uBlocks, fx.blocks);
  gl.uniform2fv(u.uBlockOff, fx.blockOff);
  gl.uniform1i(u.uNBlocks, fx.blockTTL > 0 ? fx.nBlocks : 0);
  gl.uniform1f(u.uSnow, o.snow);
  gl.uniform1f(u.uSeed, o.seed);
  gl.uniform1i(u.uInvert, o.invert ? 1 : 0);
  gl.uniform1f(u.uTrail, o.trail || 0);
  gl.uniform1f(u.uLaser, o.laser || 0);
  gl.uniform1f(u.uLaserY, o.laserY || 0.5);
  gl.uniform1f(u.uZoom, o.zoom || 1);
  gl.uniform1f(u.uRot, o.rot || 0);
  gl.uniform2f(u.uShift, o.shiftX || 0, o.shiftY || 0);
  const sg = o.sig;
  gl.uniform1f(u.uSigFade, sg ? sg.fade : 0);
  if (sg) {
    gl.uniform1i(u.uSigMask, sg.mask); gl.uniform1i(u.uSigN, sg.n); gl.uniform1i(u.uSigK, sg.k);
    gl.uniform1f(u.uSigR, sg.r); gl.uniform1f(u.uSigW, sg.w); gl.uniform1f(u.uSigRot, sg.rot);
    gl.uniform1f(u.uSigSeed, sg.seed);
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// ---------------------------------------------------------------- data
function unb64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let playlist = [];
let A = null;           // current analysis
let cur = -1;           // index into playlist
const st = {
  strobe: true, hud: true, debug: false, offset: 0,
  section: -1, scene: null, beat: -1, lastT: 0,
  invertFrames: 0, flashFrames: 0, explode: 0, seed: 1,
  cellCss: 4, newGain: 0.5, fluxGain: 0.02,
  newv: new Float32Array(NB), flux: new Float32Array(NB), vhit: new Float32Array(8), vsal: new Float32Array(8), pop: 0, thin: 0,
  lifeOnly: true, seals: false, zoomOn: true, vel: 2, push: 0, phase: 0, rate: 2, laser: 0, laserY: 0.5,
};

async function loadPlaylist() {
  const r = await fetch('tracks.json');   // relative, so the page works at any path
  const d = await r.json();
  playlist = d.tracks;
  const list = $('#list');
  list.innerHTML = '';
  playlist.forEach((t, i) => {
    const li = document.createElement('li');
    li.tabIndex = t.ready ? 0 : -1;
    if (!t.ready) li.className = 'off';
    li.innerHTML = `<span>${String(i + 1).padStart(2, '0')}</span><span></span><span></span>`;
    li.children[1].textContent = `${t.artists.split(',')[0]} — ${t.title}`;
    li.children[2].textContent = t.ready ? '' : 'not ready';
    if (t.ready) {
      li.onclick = () => play(i);
      li.onkeydown = (e) => { if (e.key === 'Enter') play(i); };
    }
    list.appendChild(li);
  });
}

async function play(i) {
  const t = playlist[i];
  if (!t || !t.ready) return;
  cur = i;
  const d = await (await fetch(`analysis/${t.slug}.json`)).json();
  const f = {};
  for (const k in d.f) f[k] = unb64(d.f[k]);
  if (!f.pace) f.pace = new Uint8Array(d.frames).fill(128);   // analysis from before pace existed
  A = { ...d, f, flux: unb64(d.flux), new: unb64(d.new), period: 60 / d.bpm };
  // analyses from before the voices existed have none: the lanes stay off
  A.nv = d.vhit && d.vsal && d.voices ? Math.min(8, d.voices.length) : 0;
  if (A.nv) { A.vhit = unb64(d.vhit); A.vsal = unb64(d.vsal); }
  st.seed = hash32(i * 7919 + 13);
  A.strobe = strobeModes(A);
  A.kickRun = kickRuns(A.beat_kick);
  A.hits = slotHits(A);
  st.section = -1; st.beat = -1; st.vel = 2; st.push = 0; st.phase = 0;
  menu.classList.add('hidden');
  warmPool(Math.min(2, window.devicePixelRatio || 1));
  audio.src = `audio/${encodeURIComponent(t.audio)}`;
  try { await audio.play(); } catch (e) { /* needs a gesture; the click provides it */ }
  history.replaceState(null, '', `#${t.slug}`);
}

// ---------------------------------------------------------------- clock
let ctLast = 0, perfLast = 0;
// The media element's currentTime already accounts for the audio device's delay in Chrome and
// Safari, so no device latency is subtracted by default (subtracting the AudioContext's
// outputLatency on top made the visuals lag by ~170 ms). T (tap along) or [ ] correct the rest.
// the playback clock with no corrections: where the browser says the audio is
function rawNow() {
  const ct = audio.currentTime, p = performance.now();
  if (ct !== ctLast || audio.paused) { ctLast = ct; perfLast = p; }
  return audio.paused ? ct : ctLast + (p - perfLast) / 1000;
}

// T: tap along with the kick. Each tap says how far behind the browser's clock you actually hear
// the beat; after four taps the median replaces the device's reported latency.
function tapSync() {
  if (!A || audio.paused) return;
  const raw = rawNow(), nowMs = performance.now();
  if (nowMs - (st.lastTap || 0) > 3000) st.taps = [];
  st.lastTap = nowMs;
  const b = beatAt(raw);
  if (b < 0) return;
  let d = raw - A.beats[b];
  if (d > A.period / 2) d -= A.period;
  st.taps.push(d);
  if (st.taps.length >= 4) {
    const v = st.taps.slice(-8).sort((x, y) => x - y);
    st.latency = Math.max(-0.2, Math.min(0.5, v[v.length >> 1]));
    st.tapped = true;
    st.offset = 0;
  }
  st.tapNote = nowMs;
}

function now() {
  const raw = rawNow();
  // + display: a frame drawn now reaches the screen about a frame and a half later
  // - latency: what the audio device holds before you hear it
  const display = audio.paused ? 0 : 1.5 * (st.frameMs || 16.7) / 1000;
  return raw + st.offset - (st.latency || 0) + display;
}

function sectionAt(t) {
  const S = A.sections;
  for (let i = S.length - 1; i >= 0; i--) if (t >= S[i].start) return i;
  return 0;
}
function beatAt(t) {
  const B = A.beats;
  let lo = 0, hi = B.length - 1;
  if (!B.length || t < B[0]) return -1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (B[m] <= t) lo = m; else hi = m - 1; }
  return lo;
}

function pickScene(sec, idx) {
  const list = SCENES[sec.kind] || SCENES.groove;
  const h = hash32(st.seed ^ (sec.label * 2654435761));
  const sc = { ...list[h % list.length] };
  // the same repeated part keeps its look; the base is always white cells on black, and only
  // the strobe and section cuts invert it
  sc.invert = false;
  if (st.lifeOnly) sc.rule = 'life';
  return sc;
}

// ---------------------------------------------------------------- frame
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
    dbg.width = w; dbg.height = h;
    changeGrid(Math.round(st.cellCss * dpr), 0);
  }
  return dpr;
}

function meanBands(arr, a, b) { let s = 0; for (let i = a; i < b; i++) s += arr[i]; return s / (b - a); }

function frame(ts) {
  requestAnimationFrame(frame);
  // smoothed frame interval, for the display look-ahead in now()
  if (st.lastTs) st.frameMs = 0.95 * (st.frameMs || 16.7) + 0.05 * Math.min(50, ts - st.lastTs);
  st.lastTs = ts;
  const dpr = resize();
  if (!A) { idle(); return; }
  const t = now();
  const fi = Math.max(0, Math.min(A.frames - 1, Math.round(t * A.fps)));   // analysis frames are centred
  const F = (k) => A.f[k][fi] / 255;
  for (let b = 0; b < NB; b++) {
    st.newv[b] = A.new[fi * NB + b] / 255;
    st.flux[b] = A.flux[fi * NB + b] / 255;
  }
  for (let v = 0; v < A.nv; v++) {
    st.vhit[v] = A.vhit[fi * A.nv + v] / 255;
    st.vsal[v] = A.vsal[(fi >> 2) * A.nv + v] / 255;
  }
  const rms = F('rms'), delta = F('delta'), onset = F('onset');
  // a locked build has no real ramp to follow, so it holds at a high tension
  const tension = st.lock === 'build' ? Math.max(F('tension'), 0.75) : F('tension');
  const jumped = Math.abs(t - st.lastT) > 0.5;
  st.lastT = t;

  // --- section change: a new scene dissolves in from the centre over a bar or two while the
  // old grid keeps running. Only a drop after a build or break cuts hard, with a flash.
  const si = sectionAt(t);
  // M / number keys lock the mode: every section then plays as that kind
  const sec = st.lock ? { ...A.sections[si], kind: st.lock } : A.sections[si];
  const bi = beatAt(t);
  if (si !== st.section || st.relock) {
    const prev = st.section >= 0 ? (st.relock ? { kind: st.prevKind } : A.sections[st.section]) : null;
    st.relock = false;
    const intoDrop = !!prev && sec.kind === 'drop' && (prev.kind === 'build' || prev.kind === 'break');
    const smooth = !jumped && !!prev && !intoDrop;
    st.section = si;
    const next = pickScene(sec, si);
    // a drop picks up the build's grain (intensity carries over) instead of resetting to coarse
    st.cellCss = intoDrop ? grainFor(next, sec, st.I ?? 0) : next.cell;
    changeGrid(Math.round(st.cellCss * dpr), smooth ? (sec.kind === 'break' || prev.kind === 'break' ? 8 : 4) : 0, t);
    st.scene = next;
    st.lastBar = Math.floor(bi / 4);
    if (!jumped && intoDrop) {
      st.flashFrames = 4;
      // mixed mode: one bar of Seeds; Life mode: the automaton is thrown forward instead
      st.explode = !st.lifeOnly ? Math.round(A.period * 4 * A.fps) : 0;
      st.push += 10; st.vel += 6;   // the shove fades in a beat, the surge over a bar or two
      st.pendingFill = 0.2;
    }
  }
  const sc = st.scene;
  const mix = mixAt(t);
  // the last beat before a drop that follows a build or break: the build strobe stops there,
  // so the drop lands on the kick, not before it
  const nextSec = A.sections[si + 1];
  const preDrop = !st.lock && !!nextSec && nextSec.kind === 'drop' && (sec.kind === 'build' || sec.kind === 'break') &&
    nextSec.start - t < A.period;

  // --- intensity: one 0..1 level that drives grain, snow, strobe rate, glitch and density.
  // Builds climb with tension; drops and grooves sit by pace. It rises fast and falls slowly,
  // so a drop never looks calmer than the end of the build that led into it.
  const pace = F('pace');
  // drop or groove is only a label: with the kick in, intensity comes from the music itself
  const wantI = preDrop ? (st.I ?? 0) : sec.kind === 'build' ? tension
    : sec.kind === 'drop' || sec.kind === 'groove' ? 0.5 + 0.42 * pace + 0.08 * rms : 0.25 * pace;
  const dI = jumped ? 99 : Math.max(0, t - (st.It ?? t)) / A.period;
  st.It = t;
  st.I = (st.I ?? wantI) + (wantI - (st.I ?? wantI)) * (1 - Math.exp(-dI / (wantI > (st.I ?? 0) ? 0.25 : 6)));
  const I = st.I;

  // --- grain: finer when more intense. Only changes on a bar line, dissolving over a beat.
  const cellCss = grainFor(sc, sec, I);
  const bar = Math.floor(bi / 4);
  if (bar !== st.lastBar && !OLD) {
    st.lastBar = bar;
    const px = Math.round(cellCss * dpr);
    if (px !== G.cellPx) changeGrid(px, jumped ? 0 : 1, t);
  }
  const cellPx = G.cellPx;

  // --- the character of a section (calm or driving, how glitchy) eases in over ~2 beats
  const ease = 1 - Math.exp(-(jumped ? 99 : Math.max(0, t - (st.easeT ?? t))) / (2 * A.period));
  st.easeT = t;
  const isCalm = sec.kind === 'break' || sec.kind === 'intro' || sec.kind === 'outro' ? 1 : 0;
  st.calmS = (st.calmS ?? isCalm) + (isCalm - (st.calmS ?? isCalm)) * ease;
  st.glitchS = (st.glitchS ?? sc.glitch) + (sc.glitch - (st.glitchS ?? sc.glitch)) * ease;

  // --- beats
  if (bi !== st.beat) {
    const fresh = !jumped && bi === st.beat + 1;
    st.beat = bi;
    if (fresh && bi >= 0) onBeat(bi, sec, tension);
  }

  // --- momentum: speed in steps per beat chases the pace with inertia (quick to speed up,
  // slow to let go), builds wind it up, kicks shove it. A phase accumulator turns speed into steps.
  const dtB = audio.paused || jumped ? 0 : Math.min(0.25, Math.max(0, (t - (st.prevT ?? t)) / A.period));
  st.prevT = t;
  const want = 0.5 + 13 * Math.pow(pace, 1.2) + (sec.kind === 'build' ? 8 * tension * tension : 0);
  const tau = want > st.vel ? 0.6 : 3.0;                       // beats
  st.vel += (want - st.vel) * (1 - Math.exp(-dtB / tau));
  st.push *= Math.exp(-dtB / 0.3);
  st.rate = st.vel + st.push;
  const before = st.phase;
  st.phase += st.rate * dtB;
  const steps = Math.min(8, Math.floor(st.phase) - Math.floor(before));
  const tick = Math.floor(st.phase);

  let rule = sc.rule;
  if (st.explode > 0) { rule = 'seeds'; st.explode--; }
  const [birth, survive] = ruleMask(rule);
  const calm = st.calmS;
  // injection is per step, so scale it by speed to keep the amount per beat steady
  const perStep = Math.min(2, Math.max(0.2, 4 / Math.max(0.5, st.rate)));
  const newGain = (0.9 - 0.4 * calm) * (0.5 + rms) * (0.6 + 0.8 * I) * perStep;
  const fluxGain = (0.6 - 0.35 * calm) * (0.6 + 0.8 * I) * perStep;
  // instruments: as strong in a break as in a drop (that is where the leads and pads play)
  const voiceGain = 0.35 * (0.7 + 0.6 * I) * perStep;
  const trailSteps = Math.min(6, Math.max(2, st.rate * 0.4));
  // density follows the music: thin out old cells when the screen is fuller than the moment calls for
  if (steps) st.pop = population();
  const target = (0.06 - 0.02 * calm) + (0.12 - 0.04 * calm) * rms + 0.06 * I;
  st.thin = Math.max(0, Math.min(0.35, (st.pop - target) * 1.5));
  for (let k = 0; k < steps; k++) {
    const o = {
      thin: st.thin,
      birth, survive, doStep: true, map: sc.map, sym: sc.sym, dither: sc.dither,
      block: Math.max(1, Math.round(6 / sc.cell)), newv: st.newv, flux: st.flux,
      nv: A.nv, vhit: st.vhit, voiceGain,
      seed: (st.seed + (tick - k) * 31) % 1e6, newGain, fluxGain, trailDecay: 1 / trailSteps,
      fill: st.pendingFill || 0, stamp: st.pendingStamp,
    };
    step(o);
    if (OLD) {
      // the outgoing grid keeps its own layout and rule until the dissolve finishes
      const os = OLD.scene || sc;
      const [ob, osv] = ruleMask(os.rule);
      step({ ...o, birth: ob, survive: osv, map: os.map, sym: os.sym, dither: os.dither,
        block: Math.max(1, Math.round(6 / os.cell)), fill: 0 }, OLD);
    }
    if (st.pendingStamp && st.pendingStamp.mask) st.lastSig = { ...st.pendingStamp, t0: t };
    st.pendingFill = 0; st.pendingStamp = null;
  }

  // --- glitch: hats/air -> horizontal slices, claps -> block mosh, a changed bar -> column tears
  const g = st.glitchS * (0.6 + 0.6 * I) * (audio.paused ? 0 : 1);
  const hi = meanBands(st.flux, 16, 24), mid = meanBands(st.flux, 8, 16);
  if (hi > 0.32 && rnd() < g) {
    fx.sliceH = cellPx * [2, 4, 8, 16][Math.floor(rnd() * 4)];
    fx.slices.fill(0);
    const n = 2 + Math.floor(rnd() * 10 * g);
    for (let k = 0; k < n; k++) fx.slices[Math.floor(rnd() * 48)] = cellPx * Math.round((rnd() - 0.5) * 60 * hi);
    fx.sliceTTL = 2 + Math.floor(rnd() * 3);
  }
  if (mid > 0.4 && rnd() < g * 0.6 && fx.blockTTL <= 0) {
    fx.nBlocks = 1 + Math.floor(rnd() * 6);
    const W = canvas.width, H = canvas.height, q = cellPx * 8;
    for (let k = 0; k < fx.nBlocks; k++) {
      const bw = q * (1 + Math.floor(rnd() * 8)), bh = q * (1 + Math.floor(rnd() * 4));
      fx.blocks.set([Math.floor(rnd() * W / q) * q, Math.floor(rnd() * H / q) * q, bw, bh], k * 4);
      fx.blockOff.set([q * Math.round((rnd() - 0.5) * 16), q * Math.round((rnd() - 0.5) * 8)], k * 2);
    }
    fx.blockTTL = 3;
  }
  if (delta > 0.55 && rnd() < g * 0.25 && fx.colTTL <= 0) {
    fx.colW = cellPx * [4, 8, 16][Math.floor(rnd() * 3)];
    fx.cols.fill(0);
    for (let k = 0; k < 6; k++) fx.cols[Math.floor(rnd() * 32)] = cellPx * Math.round((rnd() - 0.5) * 80);
    fx.colTTL = 4;
  }
  fx.sliceTTL--; fx.blockTTL--; fx.colTTL--;

  // --- strobe
  let invert = sc.invert;
  if (st.strobe) {
    // each section has a strobe mode (see strobeModes): the busiest parts of the track get a
    // square wave, calmer kick parts get single flashes, the rest only the bar's first beat.
    // All of it is gated by kick runs (see kickRuns); builds ramp their own strobe at the end.
    const mode = st.lock ? lockMode(sec.kind) : A.strobe[si];
    const inRun = bi >= 0 && A.kickRun[bi];
    const build = sec.kind === 'build';
    const div = bi < 0 || preDrop || !build ? 0 : tension > 0.93 ? 4 : tension > 0.8 ? 2 : 0;
    if (div) {
      // end of a build: a square wave, inverted on the beat so the flash lands with it
      const k = Math.floor((t - A.beats[0]) / (A.period / div));
      if (k % 2 === 0) invert = !invert;
      st.invertFrames = 0;
    } else {
      if (st.invertFrames > 0) invert = !invert;
      // busy parts flash on the track's own rhythm: on every 16th (sq16) or 8th (sq8) slot
      // where the music actually hits (hats, claps, stabs, rolls; see slotHits), always on the
      // beat, held for half a slot. kick8 adds the off-beat 8th when something hits there.
      const k16 = bi < 0 ? -1 : Math.floor((t - A.beats[0]) / (A.period / 4));
      if (k16 !== st.k16) {
        if (!jumped && inRun && k16 >= 0) {
          const hit = (A.hits[k16] || 0) > A.hitThr;
          const slotS = A.period / 4;
          const hold = (sl) => Math.max(1, Math.round(sl * 0.5 * 1000 / (st.frameMs || 16.7)));
          if (mode === 'sq16' && (k16 % 4 === 0 || hit)) st.invertFrames = Math.max(st.invertFrames, hold(slotS));
          else if (mode === 'sq8' && k16 % 2 === 0 && (k16 % 4 === 0 || hit)) st.invertFrames = Math.max(st.invertFrames, hold(2 * slotS));
          else if (mode === 'kick8' && k16 % 4 === 2 && hit) st.invertFrames = Math.max(st.invertFrames, 2);
        }
        st.k16 = k16;
      }
    }
  }
  if (st.flashFrames > 0) { invert = !sc.invert; st.flashFrames--; }
  st.invertFrames = Math.max(0, st.invertFrames - 1);

  let sig = null;
  if (st.lastSig && !jumped) {
    const fade = 1 - (t - st.lastSig.t0) / (A.period * 0.9);
    if (fade > 0) sig = { ...st.lastSig, fade: Math.min(1, 2 * fade) };   // solid for half a beat, then dithers out
  }
  // laser bars: on while a tonal sweep plays (held briefly so zaps read), position follows its pitch.
  // Analyses from before the laser feature fall back to nothing.
  // the same bars carry a beam: one clear tone ringing over the mix, held or stepping through
  // notes. Each new note jumps the bars to its pitch, thickens them for a moment and cuts the
  // pair of rows into the grid for Life to pick up.
  const lz = A.f.laser ? F('laser') : 0;
  const bm = A.f.beam ? F('beam') : 0;
  const nt = A.f.note ? F('note') : 0;
  const src = Math.max(lz, 0.85 * bm) + 0.35 * nt * (bm > 0.15 ? 1 : 0);
  const hold = Math.exp(-Math.max(0, t - (st.laserT ?? t)) / 0.12);
  st.laserT = t;
  st.laser = audio.paused ? st.laser : Math.max(src, st.laser * hold);
  const noteOn = nt > 0.9 && (st.prevNote ?? 0) <= 0.9 && bm > 0.15 && !jumped;
  st.prevNote = nt;
  if (lz > 0.1 || bm > 0.15) {
    // spread the bars over the range the line is actually using (a melody may only span an
    // octave): track a slowly relaxing min and max of its pitch and place it within them
    const ly = A.f.laser_y ? F('laser_y') : 0.5;
    const relax = 1 - Math.exp(-Math.max(0, t - (st.pRangeT ?? t)) / 4);
    st.pRangeT = t;
    st.pMin = Math.min(ly, (st.pMin ?? ly) + ((st.pMax ?? ly) - (st.pMin ?? ly)) * 0.5 * relax);
    st.pMax = Math.max(ly, (st.pMax ?? ly) - ((st.pMax ?? ly) - (st.pMin ?? ly)) * 0.5 * relax);
    const span = Math.max(0.12, st.pMax - st.pMin);
    const target = Math.min(1, Math.max(0, (ly - (st.pMax + st.pMin) / 2) / span + 0.5));
    st.laserY += (target - st.laserY) * (noteOn ? 0.8 : 0.35);
  }
  const laser = st.laser > 0.22 ? Math.min(1, (st.laser - 0.22) / 0.78) : 0;
  if (noteOn && !st.pendingStamp) st.pendingStamp = { shape: 5, r: 0.12 + 0.8 * st.laserY, w: 0.006 + 0.01 * bm };
  const cam = camera(t, bi, I);
  render({ invert, mix, sig, laser, ...cam, laserY: 0.12 + 0.8 * st.laserY, snow: (sec.kind === 'build' ? tension * tension : 0.15 * I * I * I * I) * (st.strobe ? 0.16 : 0.05), seed: (fi * 17) % 1e6,
    trail: Math.min(0.35, 0.1 + st.rate / 40) });
  drawOverlay(t, fi, sec, tension, dpr);
}

// Cell size for a scene at an intensity: builds shrink harder, everything else a little.
function grainFor(sc, sec, I) {
  return Math.max(2, Math.round(sc.cell * (1 - (sec.kind === 'build' || sec.kind === 'drop' ? 0.6 : 0.45) * I)));
}

// Each repeated part of a track gets its own seal: a star polygon {n/k} and an order in
// which its layers are drawn, one layer per beat.
const STARS = { 3: [1], 5: [2], 6: [2], 7: [2, 3], 8: [3], 9: [2, 4], 11: [3, 4, 5], 12: [5] };
const LAYERS = [1 | 2, 8 | 4, 16 | 64, 32, 128 | 1, 2 | 64];
function sigilFor(sec) {
  const h = hash32(st.seed ^ (sec.label * 40503) ^ 0x51ed);
  const ns = [3, 5, 6, 7, 8, 9, 11, 12];
  const n = ns[h % ns.length];
  const ks = STARS[n];
  const order = LAYERS.map((m, i) => [hash32(h + i * 977), m]).sort((x, y) => x[0] - y[0]).map((x) => x[1]).slice(0, 4);
  return { n, k: ks[(h >>> 5) % ks.length], order, seed: h & 0xffff, rot0: ((h >>> 9) & 255) / 255 * Math.PI };
}

function onBeat(bi, sec, tension) {
  const k = A.beat_kick[bi] || 0;
  st.push += k * (0.6 + 0.5 * st.vel);
  const bib = ((bi - (A.downbeat_phase || 0)) % 4 + 4) % 4;
  const bar = Math.floor((bi - (A.downbeat_phase || 0)) / 4);
  if (!st.seals) {
    // plain shapes, one per beat of the bar, growing outward; G switches to seals
    if (k > 0.25) st.pendingStamp = { shape: [1, 2, 3, 4][bib], r: 0.18 + 0.2 * bib + 0.1 * rnd(), w: 0.006 + 0.02 * k };
    else if (sec.kind === 'build' && bib === 0) st.pendingStamp = { shape: 5, r: 0.1 + 0.8 * tension, w: 0.01 };
  } else {
    if (!st.sigil || st.sigilSec !== st.section) { st.sigil = sigilFor(sec); st.sigilSec = st.section; }
    sealBeat(bi, bib, bar, k, sec, tension);
  }
  // every beat of a kick run flashes (even one the detector heard weakly), and so does a strong
  // lone kick; at tier 0 (a locked calm mode) only the bar's first beat
  if (!st.strobe || !(A.kickRun[bi] || k > 0.6)) return;
  const mode = st.lock ? lockMode(sec.kind) : A.strobe[st.section] ?? 'downbeat';
  if (mode === 'none' || mode === 'sq16' || mode === 'sq8') return;   // the slot strobe covers beats
  if (mode !== 'downbeat' || bib === 0) st.invertFrames = bib === 0 ? 3 : 2;
}

// Per beat: is this beat inside a run of kicks? Beat-by-beat kick strength wobbles (a softer
// kick variant, a bass note on top), and gating the strobe on it made the strobe drop out for a
// beat or two mid-groove. Runs bridge gaps of up to 2 weak beats between solid stretches and
// ignore lone hits shorter than 4 beats (those still flash on their own, see onBeat).
function kickRuns(K) {
  const n = K.length, on = Array.from(K, (k) => k > 0.45);
  const runs = [];
  for (let i = 0; i < n;) { let j = i; while (j < n && on[j] === on[i]) j++; runs.push([i, j, on[i]]); i = j; }
  for (let r = 1; r < runs.length - 1; r++) {
    const [a, b, v] = runs[r];
    if (!v && b - a <= 2 && runs[r - 1][1] - runs[r - 1][0] >= 4 && runs[r + 1][1] - runs[r + 1][0] >= 4) {
      for (let i = a; i < b; i++) on[i] = true;
    }
  }
  const out = new Uint8Array(n);
  for (let i = 0; i < n;) {
    let j = i; while (j < n && on[j] === on[i]) j++;
    if (on[i] && j - i >= 4) out.fill(1, i, j);
    i = j;
  }
  return out;
}

// ---------------------------------------------------------------- camera
// A zoom bounce on each kick, scaled by kick strength and intensity. No turning, no other moves.
function camera(t, bi, I) {
  if (!st.zoomOn || bi < 0) return { zoom: 1, rot: 0 };
  const k = A.beat_kick[bi] || 0;
  const phase = (t - A.beats[bi]) / A.period;
  return { zoom: 1 + 0.07 * k * (0.4 + I) * Math.exp(-phase * 7), rot: 0 };
}

// A strobe mode per section, so the strobe is saved for the busiest parts of a track:
//   sq16     16th-note square wave        sq8   8th-note square wave
//   kick8    a flash on each kick and off-beat 8th
//   kick     a flash on each kick         downbeat   a flash on each bar's first beat
// Kick sections are scored by how busy they are (pace, loudness, transients, new material) and
// placed against the rest of the same track: the top band strobes, the middle flashes on kicks,
// the bottom only marks the bar. Sections that repeat share a mode, and a top section picks its
// style from a few, so the same track doesn't strobe the same way everywhere.
function strobeModes(A) {
  const S = A.sections, fps = A.fps, NBX = 24;
  const score = S.map((s) => {
    if (s.kind === 'build' || s.kind === 'break') return null;
    let n = 0, sum = 0;
    for (let i = Math.floor(s.start * fps); i < Math.min(A.frames, Math.floor(s.end * fps)); i += 3) {
      if (A.f.kick[i] < 128) continue;
      let fl = 0, nw = 0;
      for (let b = 0; b < NBX; b++) { fl += A.flux[i * NBX + b]; nw += A.new[i * NBX + b]; }
      sum += 0.45 * A.f.pace[i] / 255 + 0.2 * A.f.rms[i] / 255 + 0.2 * Math.min(1, 3 * fl / NBX / 255) + 0.15 * Math.min(1, 6 * nw / NBX / 255);
      n++;
    }
    return n > 20 ? sum / n : null;
  });
  const vals = score.filter((v) => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  // repeats share the median score of their group
  const group = {};
  S.forEach((s, i) => { if (score[i] != null) (group[s.label] = group[s.label] || []).push(score[i]); });
  return S.map((s, i) => {
    if (score[i] == null) return s.kind === 'intro' || s.kind === 'outro' ? 'downbeat' : 'none';
    const g = group[s.label].slice().sort((a, b) => a - b);
    const v = g[g.length >> 1];
    // a flat track (everything about as busy) gets kick flashes throughout, no strobe
    const r = hi - lo < 0.04 ? 0.5 : (v - lo) / (hi - lo);
    const h = hash32((st.seed || 1) ^ (s.label * 2654435761));
    if (r >= 0.9) return 'sq16';
    if (r >= 0.7) return ['sq16', 'sq8', 'kick8'][h % 3];
    if (r >= 0.35) return ['kick', 'kick8'][h % 2];
    return 'downbeat';
  });
}
// How hard the music hits at the start of each 16th-note slot (onset strength and mid/high
// transients, from the analysis), so the strobe can follow the track's actual rhythm instead of a
// metronome. hitThr keeps roughly the strongest 40% of slots.
function slotHits(A) {
  const slot = A.period / 4, t0 = A.beats[0] || 0, NBX = 24;
  const n = Math.max(0, Math.floor((A.duration - t0) / slot));
  const hits = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const c = Math.round((t0 + j * slot) * A.fps);
    let m = 0;
    for (let i = Math.max(0, c - 1); i <= Math.min(A.frames - 1, c + 2); i++) {
      let fl = 0;
      for (let b = 8; b < NBX; b++) fl += A.flux[i * NBX + b];
      m = Math.max(m, A.f.onset[i] / 255, 2 * fl / (NBX - 8) / 255);
    }
    hits[j] = m;
  }
  const sorted = Array.from(hits).sort((a, b) => a - b);
  A.hitThr = sorted[Math.floor(sorted.length * 0.6)] || 0.5;
  return hits;
}
function lockMode(kind) { return { drop: 'sq16', groove: 'kick', intro: 'downbeat', outro: 'downbeat' }[kind] ?? 'downbeat'; }


function sealBeat(bi, bib, bar, k, sec, tension) {
  const sg = st.sigil;
  // the seal turns by a fraction of its point spacing each beat, faster when the music is faster
  const rot = sg.rot0 + bi * (Math.PI / sg.n) * (0.25 + 0.75 * Math.min(1, st.rate / 12));
  const base = { n: sg.n, k: sg.k, seed: sg.seed + bar, rot };
  if (k > 0.25) {
    // one layer per beat; the first beat of every 4-bar phrase stamps the whole seal
    const mask = bib === 0 && bar % 4 === 0 ? 255 : sg.order[bib];
    st.pendingStamp = { ...base, mask, r: 0.4 + 0.08 * (bar % 4) + 0.04 * k, w: 0.005 + 0.004 * k };
  } else if (sec.kind === 'build' && (bib === 0 || tension > 0.7)) {
    // no kick in a build: the ring of runes closes in on the centre as the tension rises
    st.pendingStamp = { ...base, mask: 32 | 1, r: Math.max(0.12, 0.75 - 0.6 * tension), w: 0.004 };
  } else if (sec.kind === 'break' && bib === 0 && bar % 2 === 0) {
    st.pendingStamp = { ...base, mask: 2 | 4, r: 0.45, w: 0.003 };
  }
}

// ---------------------------------------------------------------- overlay
function drawOverlay(t, fi, sec, tension, dpr) {
  if (st.debug || st.dbgDirty) { dctx.clearRect(0, 0, dbg.width, dbg.height); st.dbgDirty = st.debug; }
  const tr = playlist[cur];
  const nowMs = performance.now();
  if (nowMs - (st.hudAt || 0) < 100) { if (!st.debug) return; }
  else if (st.hud && tr) {
    st.hudAt = nowMs;
    const m = Math.floor(t / 60), s = Math.floor(t % 60).toString().padStart(2, '0');
    // only what a viewer needs: which track, where in it, and any setting they changed
    const flags = [st.lock ? `LOCKED ${st.lock}` : '', st.strobe ? '' : 'STROBE OFF',
      st.offset ? `SYNC ${st.offset > 0 ? '+' : ''}${Math.round(st.offset * 1000)} MS` : '',
      nowMs - (st.tapNote || -1e9) < 3000 ? (st.taps.length < 4 ? `TAP ${st.taps.length}/4` : `SYNCED ${Math.round(st.latency * 1000)} MS`) : ''].filter(Boolean).join('  ');
    const text = `${String(cur + 1).padStart(2, '0')}/${playlist.length}  ${tr.artists.split(',')[0]} — ${tr.title}\n` +
      `${m}:${s}${flags ? '  ' + flags : ''}`;
    if (text !== hud.textContent) hud.textContent = text;
  } else if (hud.textContent) hud.textContent = '';
  if (!st.debug) return;
  // feature view: new (top) and flux (below) as 1-bit bars, section map along the bottom
  const W = dbg.width, H = dbg.height, bw = Math.floor(W * 0.35 / NB), x0 = W - NB * bw - 16 * dpr, y0 = 16 * dpr;
  dctx.fillStyle = '#000';
  dctx.fillRect(x0 - 4 * dpr, y0 - 4 * dpr, NB * bw + 8 * dpr, 184 * dpr);
  dctx.fillStyle = '#fff';
  for (let b = 0; b < NB; b++) {
    const hN = st.newv[b] * 60 * dpr, hF = st.flux[b] * 60 * dpr;
    dctx.fillRect(x0 + b * bw, y0 + 60 * dpr - hN, bw - 1, hN);
    dctx.fillRect(x0 + b * bw, y0 + 70 * dpr, bw - 1, hF);
  }
  // voices: salience as a bar, a hit as a block above it
  const vw = Math.floor(NB * bw / 8);
  for (let v = 0; v < A.nv; v++) {
    const hL = st.vsal[v] * 40 * dpr;
    dctx.fillRect(x0 + v * vw, y0 + 175 * dpr - hL, vw - 2 * dpr, hL);
    if (st.vhit[v] > 0.3) dctx.fillRect(x0 + v * vw, y0 + 128 * dpr, vw - 2 * dpr, 4 * dpr);
  }
  const yb = H - 10 * dpr;
  dctx.fillStyle = '#000';
  dctx.fillRect(0, yb - 2 * dpr, W, 12 * dpr);
  dctx.fillStyle = '#fff';
  for (const s of A.sections) {
    const xa = (s.start / A.duration) * W, xb = (s.end / A.duration) * W;
    const h = { drop: 8, groove: 6, build: 4, intro: 3, outro: 3, break: 1 }[s.kind] * dpr;
    dctx.fillRect(xa + 1, yb + 8 * dpr - h, xb - xa - 2, h);
  }
  dctx.fillRect((t / A.duration) * W, yb - 6 * dpr, 2 * dpr, 16 * dpr);
}
function sc_name() { return st.scene ? `${st.scene.rule}` : ''; }

// idle screen behind the menu: the automaton runs on its own
let idleTick = 0;
function idle() {
  if (!G) return;
  if (++idleTick % 6 === 0) {
    const [birth, survive] = ruleMask('life');
    const n = new Float32Array(NB).map(() => (rnd() < 0.1 ? rnd() : 0));
    step({ birth, survive, doStep: true, map: 4, sym: 2, dither: 1, block: 2, newv: n, flux: ZERO24,
      seed: idleTick, newGain: 0.6, fluxGain: 0 });
  }
  render({ invert: false, snow: 0, seed: idleTick });
}

// ---------------------------------------------------------------- input
// mode lock: null follows the track; otherwise every section plays as this kind
const LOCKS = [null, 'drop', 'build', 'groove', 'break', 'intro', 'outro'];
function setLock(kind) {
  if (kind === st.lock) return;
  st.prevKind = st.scene && A ? (st.lock || A.sections[st.section]?.kind) : null;
  st.lock = kind;
  st.relock = st.section >= 0;   // re-pick the scene now, dissolving from the current one
}

function toggleFullscreen() {
  const el = document.documentElement;
  const on = document.fullscreenElement || document.webkitFullscreenElement;
  const req = on ? (document.exitFullscreen || document.webkitExitFullscreen) : (el.requestFullscreen || el.webkitRequestFullscreen);
  try {
    const r = req.call(on ? document : el);
    if (r && r.catch) r.catch((err) => console.warn('fullscreen:', err.message));
  } catch (err) { console.warn('fullscreen:', err.message); }
}

function seek(dt) { if (A) audio.currentTime = Math.max(0, Math.min(A.duration - 0.1, audio.currentTime + dt)); }
function nextReady(dir) {
  for (let k = 1; k <= playlist.length; k++) {
    const j = (cur + dir * k + playlist.length) % playlist.length;
    if (playlist[j].ready) return play(j);
  }
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey) return;
  const k = e.key;
  if (k === 'Escape') { menu.classList.toggle('hidden'); return; }
  if (k === 'f' || k === 'F') { toggleFullscreen(); return; }   // works on the track list too
  if (!menu.classList.contains('hidden') && k !== 's' && k !== 'S') return;
  if (k === ' ') { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
  else if (k === 'ArrowRight') seek(e.shiftKey ? 60 : 10);
  else if (k === 'ArrowLeft') seek(e.shiftKey ? -60 : -10);
  else if (k === 'n' || k === 'N') nextReady(1);
  else if (k === 'p' || k === 'P') nextReady(-1);
  else if (k === 's' || k === 'S') st.strobe = !st.strobe;
  else if (k === 'h' || k === 'H') st.hud = !st.hud;
  else if (k === 'd' || k === 'D') st.debug = !st.debug;
  else if (k === 'r' || k === 'R') { st.lifeOnly = !st.lifeOnly; st.section = -1; }
  else if (k === 'g' || k === 'G') { st.seals = !st.seals; st.lastSig = null; }
  else if (k === 'z' || k === 'Z') st.zoomOn = !st.zoomOn;
  else if (k === 'm' || k === 'M') setLock(LOCKS[(LOCKS.indexOf(st.lock) + 1) % LOCKS.length]);
  else if (k >= '0' && k <= '6') setLock(LOCKS[+k]);
  else if (k === 't' || k === 'T') tapSync();
  else if (k === '[') st.offset -= 0.01;
  else if (k === ']') st.offset += 0.01;
});
audio.addEventListener('ended', () => nextReady(1));
canvas.addEventListener('dblclick', toggleFullscreen);
let idleTimer;
addEventListener('mousemove', () => {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('idle'), 2000);
});

resize();
changeGrid(Math.round(4 * Math.min(2, devicePixelRatio || 1)), 0);
loadPlaylist().then(() => {
  const want = decodeURIComponent(location.hash.slice(1));
  const i = playlist.findIndex((t) => t.slug === want);
  if (i >= 0) {
    const li = $('#list').children[i];
    if (li) li.focus();
  }
});
requestAnimationFrame(frame);
