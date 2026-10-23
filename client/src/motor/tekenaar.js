// ============================================================================
// Rommelblok: de tekenaar. Eigen WebGL2-motor: blokken, water, lucht, wolken, deeltjes, voorwerpen.
// ============================================================================
export function RB_TEKENAAR(G, canvas, T, opt) {
  'use strict';
  const gl = canvas.getContext('webgl2', { antialias: !!opt.antialias, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opt.bewaarBeeld });
  if (!gl) return null;
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

  // ---------------- shaders
  function maakProg(vs, fs, naam) {
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(naam + ': ' + gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(naam + ': ' + gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  // de lucht: dezelfde kleur voor de hemel, de mist en de weerspiegeling in het water
  const LUCHT = `
    uniform vec3 uZenit, uHorizon, uZonRicht, uMaanRicht, uZonGloed;
    vec3 lucht(vec3 d) {
      float h = d.y;
      vec3 c = mix(uHorizon, uZenit, pow(clamp(h, 0.0, 1.0), 0.55));
      c = mix(c, uHorizon * 0.82, clamp(-h * 3.0, 0.0, 1.0));
      float zs = max(dot(d, uZonRicht), 0.0);
      c += uZonGloed * (pow(zs, 8.0) * 0.5 + pow(zs, 90.0) * 0.55) * clamp(1.0 - h * 1.2, 0.25, 1.0);
      return c;
    }`;
  const BLOK_VS = `#version 300 es
    precision highp float; precision highp int;
    layout(location = 0) in uvec2 aV;
    uniform mat4 uVP; uniform vec3 uStuk; uniform vec2 uStukMod; uniform float uTijd, uWind; uniform vec3 uTexOfs[8];
    uniform vec2 uMist; uniform float uOnderWater, uMistDonker; uniform vec3 uMistKleur;
    ${LUCHT}
    out vec3 vLp; out vec3 vRel; out vec2 vTuv; out vec2 vL; out float vAO; out vec4 vMist;
    flat out uint vLaag, vVl, vN, vEx;
    float lk(float l) { return pow(0.80, (1.0 - l) * 15.0) * (1.0 - 0.04) + 0.04 * l; }
    const vec3 UA[6] = vec3[6](vec3(0,1,0), vec3(0,0,1), vec3(0,0,1), vec3(1,0,0), vec3(1,0,0), vec3(0,1,0));
    const vec3 VA[6] = vec3[6](vec3(0,0,1), vec3(0,1,0), vec3(1,0,0), vec3(0,0,1), vec3(0,1,0), vec3(1,0,0));
    void main() {
      uint w0 = aV.x, w1 = aV.y;
      vec3 lp = vec3(float(w0 & 511u) - 16.0, float((w0 >> 18u) & 2047u), float((w0 >> 9u) & 511u) - 16.0) / 16.0;
      uint n = w0 >> 29u, vl = (w1 >> 18u) & 63u, ex = w1 >> 24u;
      vec2 mp = uStukMod + lp.xz;
      if ((vl & 1u) != 0u && (n < 6u || (ex & 1u) != 0u)) {
        // zwaaien in de wind (periodiek over 512 blokken, zodat buren precies gelijk bewegen)
        float f = mp.x * 0.4909 + mp.y * 0.2822 + lp.y * 0.3;
        float a = n < 6u ? 0.022 : 0.065;
        lp.x += sin(uTijd * 1.9 + f) * a * uWind; lp.z += cos(uTijd * 1.5 + f * 1.3) * a * uWind;
      }
      if (n < 6u && (ex & 132u) == 4u) lp += (UA[n] * ((ex & 1u) != 0u ? 1.0 : -1.0) + VA[n] * ((ex & 2u) != 0u ? 1.0 : -1.0)) * 0.0015;
      vLp = lp; if (n < 6u && (ex & 128u) != 0u) vLp -= uTexOfs[ex & 7u] / 16.0;
      vRel = uStuk + lp; vTuv = (mp + 0.5) / 512.0;
      vec2 l = vec2(float((w1 >> 10u) & 15u), float((w1 >> 14u) & 15u)) / 15.0;
      vL = vec2(lk(l.x), lk(l.y));
      vAO = float((w1 >> 8u) & 3u) / 3.0;
      // mist per hoekpunt: de kleur van de lucht in die richting (of onder water: waterkleur)
      vec3 rel = uStuk + lp;
      if (uOnderWater > 0.5) vMist = vec4(uMistKleur, clamp(1.0 - exp(-length(rel) * 0.075), 0.0, 1.0));
      else vMist = vec4(lucht(normalize(rel)) * uMistDonker, smoothstep(uMist.x, uMist.y, length(rel.xz) * 0.92 + abs(rel.y) * 0.08));
      vLaag = w1 & 255u; vVl = vl; vN = n; vEx = ex;
      gl_Position = uVP * vec4(vRel, 1.0);
    }`;
  const BLOK_FS = (snij) => `#version 300 es
    precision highp float; precision highp int; precision highp sampler2DArray;
    uniform sampler2DArray uTex, uTint;
    uniform vec3 uZonKleur, uFakKleur; uniform float uMin, uFlakker; uniform vec3 uPalet[12];
    in vec3 vLp; in vec3 vRel; in vec2 vTuv; in vec2 vL; in float vAO; in vec4 vMist;
    flat in uint vLaag, vVl, vN, vEx;
    out vec4 o;
    const float SCHAD[8] = float[8](0.78, 0.78, 1.0, 0.52, 0.9, 0.9, 0.92, 0.92);
    void main() {
      vec2 uv;
      if (vN == 0u) uv = vec2(-vLp.z, vLp.y); else if (vN == 1u) uv = vec2(vLp.z, vLp.y);
      else if (vN == 2u) uv = vec2(vLp.x, vLp.z); else if (vN == 3u) uv = vec2(vLp.x, -vLp.z);
      else if (vN == 4u) uv = vec2(vLp.x, vLp.y); else if (vN == 5u) uv = vec2(-vLp.x, vLp.y);
      else uv = vec2(vLp.x, vLp.y);
      if ((vVl & 32u) != 0u) uv = vec2(uv.y, -uv.x);
      vec2 st = vec2(fract(uv.x), 1.0 - fract(uv.y));
      // detailniveau zelf uitrekenen (16 pixels per blok): overal gelijk, ook waar de textuur zich herhaalt
      vec2 dx = dFdx(uv), dy = dFdy(uv);
      float lod = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy)) * 256.0) - 0.35);
      vec4 t = textureLod(uTex, vec3(st, float(vLaag)), lod);
      ${snij ? 'if (t.a < 0.5) discard;' : ''}
      vec3 c = t.rgb;
      uint ts = (vVl >> 2u) & 3u;
      if ((vVl & 2u) != 0u) {
        vec4 ov = textureLod(uTex, vec3(st, float(vLaag + 1u)), lod);
        vec3 tk = texture(uTint, vec3(vTuv, float(ts - 1u))).rgb;
        c = mix(c, ov.rgb * tk * 1.15, ov.a);
      } else if (ts > 0u) c *= texture(uTint, vec3(vTuv, float(ts - 1u))).rgb * 1.15;
      // gekleurde blokken: de kleur uit het palet (bits 3 tot 6 van ex)
      uint kl = (vEx >> 3u) & 15u;
      if (kl > 0u && kl <= 12u) c *= uPalet[kl - 1u];
      float zon = vL.x, fak = vL.y * uFlakker;
      vec3 L = max(uZonKleur * zon, uFakKleur * fak) + 0.22 * min(uZonKleur * zon, uFakKleur * fak);
      L = max(L, vec3(uMin));
      float ao = 0.42 + 0.58 * vAO * (0.7 + 0.3 * vAO);
      c *= L * ao * SCHAD[vN];
      if ((vVl & 16u) != 0u) c = mix(c, t.rgb * 1.08, 0.82);
      // mist: kleur van de lucht in die richting, zodat de verte er naadloos in overgaat
      o = vec4(mix(c, vMist.rgb, vMist.a), 1.0);
    }`;
  const WATER_VS = BLOK_VS.replace('out vec3 vLp;', 'out vec3 vLp; out vec3 vWave;').replace('vLp = lp; vRel', `
      vWave = vec3(0.0);
      if (n == 2u && ((w1 >> 18u) & 12u) == 12u && (ex & 128u) == 0u) {
        float g = sin(uTijd * 1.3 + mp.x * 0.6136 + mp.y * 0.3682) * 0.5 + sin(uTijd * 1.7 - mp.x * 0.3682 + mp.y * 0.7363) * 0.5;
        lp.y += g * 0.035 - 0.02; vWave.x = g;
      }
      vLp = lp; vRel`);
  const WATER_FS = `#version 300 es
    precision highp float; precision highp int; precision highp sampler2DArray;
    uniform sampler2DArray uTex, uTint; uniform sampler2D uRuis;
    uniform vec3 uZonKleur, uFakKleur, uMistKleur; uniform vec2 uMist, uRuisOfs; uniform float uMin, uFlakker, uOnderWater, uTijd;
    ${LUCHT}
    in vec3 vLp; in vec3 vWave; in vec3 vRel; in vec2 vTuv; in vec2 vL; in float vAO; in vec4 vMist;
    flat in uint vLaag, vVl, vN, vEx;
    out vec4 o;
    void main() {
      float zon = vL.x, fak = vL.y * uFlakker;
      vec3 L = max(uZonKleur * zon, uFakKleur * fak); L = max(L, vec3(uMin));
      uint ts = (vVl >> 2u) & 3u;
      // ijs (een eigen laag, na het water): alleen de voorkant, anders vallen de vlakken van één blok in een willekeurige volgorde over elkaar
      bool ijs = ts != 3u;
      if (ijs && !gl_FrontFacing) discard;
      vec3 V = normalize(vRel);
      if (ijs) {
        // ijs: gewoon een halfdoorzichtige textuur
        vec2 uv = (vN < 2u) ? vec2(vLp.z, vLp.y) : (vN < 4u) ? vLp.xz : vec2(vLp.x, vLp.y);
        vec4 t = texture(uTex, vec3(fract(uv.x), 1.0 - fract(uv.y), float(vLaag)));
        vec3 c = t.rgb * L;
        float m = smoothstep(uMist.x, uMist.y, length(vRel.xz));
        o = vec4(mix(c, lucht(V), m), mix(t.a, 1.0, m));
        return;
      }
      vec3 wk = texture(uTint, vec3(vTuv, 2.0)).rgb;
      uint diep = vEx & 15u, rdir = (vEx >> 4u) & 7u; bool stroomt = (vEx & 128u) != 0u;
      // golfjes: twee lagen ruis die meedrijven met de stroming
      vec2 wp = (vTuv * 512.0) - 0.5;
      float ang = float(rdir) * 0.785398;
      vec2 sd = stroomt ? vec2(cos(ang), sin(ang)) * 1.4 : vec2(0.18, 0.11);
      vec3 N;
      if (vN == 2u) {
        vec2 a = wp * 0.11 + uRuisOfs - sd * uTijd * 0.11, b = wp * 0.23 + uRuisOfs * 1.7 + vec2(0.37, 0.71) - sd.yx * uTijd * 0.17;
        float h0 = texture(uRuis, a).r + texture(uRuis, b).r * 0.5;
        float hx = texture(uRuis, a + vec2(0.02, 0.0)).r + texture(uRuis, b + vec2(0.02, 0.0)).r * 0.5;
        float hz = texture(uRuis, a + vec2(0.0, 0.02)).r + texture(uRuis, b + vec2(0.0, 0.02)).r * 0.5;
        N = normalize(vec3((h0 - hx) * 2.2, 1.0, (h0 - hz) * 2.2));
      } else {
        float s = texture(uRuis, vec2(wp.x * 0.13 + vLp.z * 0.13, vLp.y * 0.08 + uTijd * 0.5)).r;
        N = normalize(vec3(vN == 0u ? 1.0 : vN == 1u ? -1.0 : 0.0, (s - 0.5) * 0.4, vN == 4u ? 1.0 : vN == 5u ? -1.0 : 0.0));
      }
      if (uOnderWater > 0.5) N = -N;
      float fr = pow(1.0 - max(dot(-V, N), 0.0), 4.0) * 0.85 + 0.08;
      vec3 refl = lucht(reflect(V, N)) * (0.35 + 0.65 * zon);
      float glim = pow(max(dot(reflect(V, N), uZonRicht), 0.0), 120.0) * zon * step(0.0, uZonRicht.y) * 3.0;
      vec3 diepK = wk * vec3(0.55, 0.75, 0.9);
      float d = float(diep);
      vec3 c = mix(wk * 1.05, diepK, clamp(d / 8.0, 0.0, 1.0)) * L;
      c = mix(c, refl, fr) + uZonGloed * glim;
      if (stroomt && vN == 2u) c += vec3(0.16) * smoothstep(0.62, 0.8, texture(uRuis, wp * 0.3 - sd * uTijd * 0.3).r) * L;
      float a = mix(0.42, 0.86, clamp(d / 6.0, 0.0, 1.0));
      a = clamp(a + fr * 0.4, 0.0, 0.95);
      if (uOnderWater > 0.5) { c = mix(wk * L * 0.7, refl * 0.5, 0.3); a = 0.55; }
      float m = uOnderWater > 0.5 ? clamp(1.0 - exp(-length(vRel) * 0.075), 0.0, 1.0) : smoothstep(uMist.x, uMist.y, length(vRel.xz));
      vec3 mk = uOnderWater > 0.5 ? uMistKleur : lucht(V);
      o = vec4(mix(c, mk, m), mix(a, 1.0, m));
    }`;
  const LUCHT_VS = `#version 300 es
    precision highp float;
    uniform mat4 uInvVP; out vec3 vD;
    void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0; vec4 w = uInvVP * vec4(p, 1.0, 1.0); vD = w.xyz / w.w; gl_Position = vec4(p, 1.0, 1.0); }`;
  const LUCHT_FS = `#version 300 es
    precision highp float;
    uniform float uSterren, uMaanFase, uTijd, uOnderWater, uMistDonker; uniform vec3 uMistKleur;
    ${LUCHT}
    in vec3 vD; out vec4 o;
    float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    void main() {
      vec3 d = normalize(vD);
      if (uOnderWater > 0.5) { o = vec4(uMistKleur, 1.0); return; }
      vec3 c = lucht(d);
      // zon: een zachte schijf
      float zs = dot(d, uZonRicht);
      c += uZonGloed * smoothstep(0.9993, 0.9997, zs) * 2.2;
      // maan met fase en kraters
      float ms = dot(d, uMaanRicht);
      if (ms > 0.9985) {
        vec3 mr = uMaanRicht, ax = normalize(cross(mr, vec3(0.0, 1.0, 0.0))), ay = cross(ax, mr);
        vec2 q = vec2(dot(d - mr, ax), dot(d - mr, ay)) / 0.052;
        float r = length(q);
        if (r < 1.0) {
          // fase: 0 nieuwe maan, 0.5 volle maan. Belichting van een bol vanuit een draaiende richting
          vec3 nrm = vec3(q, sqrt(1.0 - r * r));
          float fa = uMaanFase * 6.2831853;
          float licht = smoothstep(-0.06, 0.12, dot(nrm, vec3(sin(fa), 0.0, -cos(fa))));
          float krater = 0.85 + 0.15 * h3(floor(vec3(q * 6.0, 1.0)));
          c = mix(c, vec3(0.92, 0.94, 1.0) * krater, smoothstep(1.0, 0.92, r) * mix(0.12, 1.0, licht) * uSterren);
        }
      }
      // sterren
      if (uSterren > 0.01 && d.y > -0.05) {
        vec3 g = d * 120.0, cel = floor(g), f = fract(g) - 0.5;
        float h = h3(cel);
        if (h > 0.982) { float s = smoothstep(0.32, 0.0, length(f)) * (0.35 + (h - 0.982) * 36.0); s *= 0.6 + 0.4 * sin(uTijd * (2.0 + h * 8.0) + h * 40.0); c += vec3(0.9, 0.93, 1.0) * s * uSterren * smoothstep(-0.05, 0.25, d.y); }
      }
      o = vec4(c * uMistDonker, 1.0);
    }`;
  const WOLK_VS = `#version 300 es
    precision highp float;
    uniform mat4 uVP; uniform float uHoogte; uniform vec2 uOfs; out vec2 vW; out vec3 vRel;
    void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0; vec3 rel = vec3(p.x * 1400.0, uHoogte, p.y * 1400.0); vRel = rel; vW = (rel.xz + uOfs); gl_Position = uVP * vec4(rel, 1.0); }`;
  const WOLK_FS = `#version 300 es
    precision highp float;
    uniform sampler2D uRuis; uniform float uTijd, uDek; uniform vec3 uWolkKleur, uWolkSchaduw;
    ${LUCHT}
    in vec2 vW; in vec3 vRel; out vec4 o;
    void main() {
      vec2 p = vW / 900.0 + vec2(uTijd * 0.0021, uTijd * 0.0009);
      float n = texture(uRuis, p).r * 0.6 + texture(uRuis, p * 2.3 + 0.31).r * 0.3 + texture(uRuis, p * 5.1 + 0.77).r * 0.1;
      float a = smoothstep(uDek, uDek + 0.16, n);
      if (a < 0.01) discard;
      float s = texture(uRuis, p + uZonRicht.xz * 0.012).r * 0.6 + texture(uRuis, (p + uZonRicht.xz * 0.012) * 2.3 + 0.31).r * 0.3;
      vec3 c = mix(uWolkKleur, uWolkSchaduw, clamp((s - n) * 4.0 + 0.35, 0.0, 1.0));
      float afst = length(vRel.xz);
      float f = smoothstep(1300.0, 500.0, afst);
      vec3 mk = lucht(normalize(vRel));
      c = mix(mk, c, smoothstep(1300.0, 260.0, afst));
      o = vec4(c, a * f * 0.92);
    }`;
  const LIJN_VS = `#version 300 es
    precision highp float; layout(location = 0) in vec3 aP; uniform mat4 uVP; uniform vec3 uOfs;
    void main() { gl_Position = uVP * vec4(aP + uOfs, 1.0); gl_Position.z -= 0.0004 * gl_Position.w; }`;
  const LIJN_FS = `#version 300 es
    precision highp float; uniform vec4 uKleur; out vec4 o; void main() { o = uKleur; }`;
  // voorwerpen, deeltjes en de hand: drijvende komma met eigen uv
  const DING_VS = `#version 300 es
    precision highp float;
    layout(location = 0) in vec3 aP; layout(location = 1) in vec3 aT; layout(location = 2) in float aS;
    uniform mat4 uVP, uM; out vec3 vT; out float vS; out vec3 vRel;
    void main() { vec4 w = uM * vec4(aP, 1.0); vRel = w.xyz; vT = aT; vS = aS; gl_Position = uVP * w; }`;
  const DING_FS = `#version 300 es
    precision highp float; precision highp sampler2DArray;
    uniform sampler2DArray uTex, uDing; uniform vec3 uLicht, uTintK; uniform vec2 uMist; uniform float uTint, uGloed, uOnderWater, uBron; uniform vec3 uMistKleur;
    ${LUCHT}
    in vec3 vT; in float vS; in vec3 vRel; out vec4 o;
    void main() {
      vec4 t = uBron > 0.5 ? texture(uDing, vec3(vT.xy, vT.z)) : texture(uTex, vec3(vT.xy, vT.z));
      if (t.a < 0.5) discard;
      vec3 c = t.rgb; if (uTint > 0.5) c *= uTintK;
      c *= mix(uLicht * vS, vec3(1.0), uGloed);
      float m = uOnderWater > 0.5 ? clamp(1.0 - exp(-length(vRel) * 0.075), 0.0, 1.0) : smoothstep(uMist.x, uMist.y, length(vRel.xz));
      o = vec4(mix(c, uOnderWater > 0.5 ? uMistKleur : lucht(normalize(vRel)), m), 1.0);
    }`;
  const DEELTJE_VS = `#version 300 es
    precision highp float;
    layout(location = 0) in vec4 aP; layout(location = 1) in vec4 aT;
    uniform mat4 uVP; uniform vec3 uRechts, uOp; out vec3 vT; out float vL;
    void main() {
      int k = gl_VertexID % 4; vec2 c = vec2(k == 1 || k == 2 ? 1.0 : 0.0, k >= 2 ? 1.0 : 0.0);
      vec3 p = aP.xyz + (uRechts * (c.x - 0.5) + uOp * (c.y - 0.5)) * aP.w;
      vT = vec3(aT.xy + c * 0.25 * vec2(1.0, -1.0) + vec2(0.0, 0.25), aT.z); vL = aT.w;
      gl_Position = uVP * vec4(p, 1.0);
    }`;
  const DEELTJE_FS = `#version 300 es
    precision highp float; precision highp sampler2DArray;
    uniform sampler2DArray uTex, uDing; uniform vec3 uZonKleur, uFakKleur;
    in vec3 vT; in float vL; out vec4 o;
    void main() {
      vec4 t = vT.z >= 255.5 ? textureLod(uDing, vec3(vT.xy, vT.z - 256.0), 0.0) : textureLod(uTex, vec3(vT.xy, vT.z), 0.0); if (t.a < 0.5) discard;
      float zon = floor(vL / 16.0) / 15.0, fak = mod(vL, 16.0) / 15.0;
      vec3 L = max(uZonKleur * pow(0.8, (1.0 - zon) * 15.0), uFakKleur * pow(0.8, (1.0 - fak) * 15.0)); L = max(L, vec3(0.03));
      o = vec4(t.rgb * L, 1.0);
    }`;

  // het palet als kleuren van 0 tot 1 (iets lichter gemaakt, want de grijze basis is niet helemaal wit)
  const PALET = new Float32Array(36); G.PALET.forEach((p, i) => { const n = parseInt(p[4].slice(1), 16); PALET[i * 3] = Math.min(1.2, ((n >> 16) & 255) / 255 * 1.1); PALET[i * 3 + 1] = Math.min(1.2, ((n >> 8) & 255) / 255 * 1.1); PALET[i * 3 + 2] = Math.min(1.2, (n & 255) / 255 * 1.1); });
  const paletKleur = k => [PALET[k * 3], PALET[k * 3 + 1], PALET[k * 3 + 2]];
  const TEXOFS = new Float32Array(24); G.TEXOFS.forEach((o, i) => { if (i < 8) TEXOFS.set(o, i * 3); });
  const PB = maakProg(BLOK_VS, BLOK_FS(false), 'blok'), PU = maakProg(BLOK_VS, BLOK_FS(true), 'uitgesneden'), PW = maakProg(WATER_VS, WATER_FS, 'water');
  const PL = maakProg(LUCHT_VS, LUCHT_FS, 'lucht'), PWk = maakProg(WOLK_VS, WOLK_FS, 'wolken'), PLn = maakProg(LIJN_VS, LIJN_FS, 'lijn');
  const PD = maakProg(DING_VS, DING_FS, 'ding'), PDt = maakProg(DEELTJE_VS, DEELTJE_FS, 'deeltje');

  // ---------------- texturen
  const N = T.N, MIPS = 5;
  // een stapel plaatjes van 16 x 16 met eigen kleinere versies: kleur gewogen naar dekking, zodat bladranden niet donker worden
  function maakStapel(data, n, anisotroop) {
    const tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tx);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, MIPS, gl.RGBA8, 16, 16, Math.max(1, n));
    let lvl = data, maat = 16;
    for (let m = 0; m < MIPS && n; m++) {
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, m, 0, 0, 0, maat, maat, n, gl.RGBA, gl.UNSIGNED_BYTE, lvl);
      if (maat === 1) break;
      const k = maat >> 1, nieuw = new Uint8Array(k * k * 4 * n);
      for (let l = 0; l < n; l++) for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) {
        let r = 0, g = 0, b = 0, a = 0, w = 0;
        for (let j = 0; j < 4; j++) { const sx = x * 2 + (j & 1), sy = y * 2 + (j >> 1), i = ((l * maat + sy) * maat + sx) * 4, al = lvl[i + 3]; r += lvl[i] * al; g += lvl[i + 1] * al; b += lvl[i + 2] * al; a += al; w += al; }
        const o = ((l * k + y) * k + x) * 4;
        if (w) { nieuw[o] = r / w; nieuw[o + 1] = g / w; nieuw[o + 2] = b / w; }
        nieuw[o + 3] = Math.min(255, a / 4 * 1.25);
      }
      lvl = nieuw; maat = k;
    }
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, MIPS - 1);
    if (anisotroop && aniso && opt.aniso) gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return tx;
  }
  const texArr = maakStapel(T.data, N, true), dingArr = maakStapel(T.ddata, T.ND || 0, false);
  // kleuren van de streek: een rondlopende kaart van 512 x 512 blokken, drie lagen (gras, blad, water)
  const tintTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, tintTex);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, 512, 512, 3);
  { const v = new Uint8Array(512 * 512 * 4); for (let l = 0; l < 3; l++) { const c = [[111, 179, 74], [78, 158, 58], [61, 143, 214]][l]; for (let i = 0; i < 512 * 512; i++) { v[i * 4] = c[0]; v[i * 4 + 1] = c[1]; v[i * 4 + 2] = c[2]; v[i * 4 + 3] = 255; } gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, l, 512, 512, 1, gl.RGBA, gl.UNSIGNED_BYTE, v); } }
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
  const tintBuf = new Uint8Array(16 * 16 * 4);
  function zetKleur(cx, cz, kl) {
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tintTex);
    const ox = ((cx * 16) % 512 + 512) % 512, oz = ((cz * 16) % 512 + 512) % 512;
    for (let l = 0; l < 3; l++) {
      for (let i = 0; i < 256; i++) { const v = kl[l * 256 + i]; tintBuf[i * 4] = ((v >> 11) & 31) * 255 / 31; tintBuf[i * 4 + 1] = ((v >> 5) & 63) * 255 / 63; tintBuf[i * 4 + 2] = (v & 31) * 255 / 31; tintBuf[i * 4 + 3] = 255; }
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, ox, oz, l, 16, 16, 1, gl.RGBA, gl.UNSIGNED_BYTE, tintBuf);
    }
  }
  // ruis voor wolken en water (tegelbaar)
  const ruisTex = gl.createTexture();
  {
    const M = 256, v = new Uint8Array(M * M), R = G.rng(4242);
    const lagen = [[8, 0.5], [16, 0.28], [32, 0.14], [64, 0.08]];
    const fl = new Float32Array(M * M);
    for (const [n, a] of lagen) {
      const g = new Float32Array(n * n); for (let i = 0; i < n * n; i++) g[i] = R();
      for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
        const fx = x / M * n, fy = y / M * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const q = (i, j) => g[((j % n) + n) % n * n + ((i % n) + n) % n];
        fl[y * M + x] += a * ((q(x0, y0) * (1 - sx) + q(x0 + 1, y0) * sx) * (1 - sy) + (q(x0, y0 + 1) * (1 - sx) + q(x0 + 1, y0 + 1) * sx) * sy);
      }
    }
    for (let i = 0; i < M * M; i++) v[i] = Math.max(0, Math.min(255, fl[i] * 255));
    gl.bindTexture(gl.TEXTURE_2D, ruisTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, M, M, 0, gl.RED, gl.UNSIGNED_BYTE, v);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }

  // ---------------- stukken op de kaart
  const MAXQ = 1 << 17;
  const idxBuf = gl.createBuffer();
  { const a = new Uint32Array(MAXQ * 6); for (let i = 0; i < MAXQ; i++) { const v = i * 4, o = i * 6; a[o] = v; a[o + 1] = v + 1; a[o + 2] = v + 2; a[o + 3] = v; a[o + 4] = v + 2; a[o + 5] = v + 3; } gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, a, gl.STATIC_DRAW); }
  const stukken = new Map();
  const sk = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
  let gpuBytes = 0;
  function zetStuk(cx, cz, lagen, ofs) {
    const k = sk(cx, cz);
    let s = stukken.get(k);
    if (!s) { s = { cx, cz, l: [null, null, null, null], ofs: null, ymin: 0, ymax: 8 }; stukken.set(k, s); }
    for (let l = 0; l < 4; l++) {
      const a = lagen[l], q = a.length / 8;
      let L = s.l[l];
      if (!q) { if (L) { gpuBytes -= L.bytes; gl.deleteBuffer(L.buf); gl.deleteVertexArray(L.vao); s.l[l] = null; } continue; }
      if (!L) {
        L = { vao: gl.createVertexArray(), buf: gl.createBuffer(), q: 0, bytes: 0 };
        gl.bindVertexArray(L.vao); gl.bindBuffer(gl.ARRAY_BUFFER, L.buf);
        gl.enableVertexAttribArray(0); gl.vertexAttribIPointer(0, 2, gl.UNSIGNED_INT, 8, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bindVertexArray(null);
        s.l[l] = L;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, L.buf); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW);
      gpuBytes += a.byteLength - L.bytes; L.bytes = a.byteLength; L.q = q;
    }
    s.ofs = ofs;
    // welke secties hebben iets
    let lo = 8, hi = -1; for (let sy = 0; sy < 8; sy++) { let n = 0; for (let l = 0; l < 4; l++) n += ofs[l][sy + 1] - ofs[l][sy]; if (n) { lo = Math.min(lo, sy); hi = Math.max(hi, sy); } }
    s.ymin = lo; s.ymax = hi;
  }
  function weg(cx, cz) {
    const k = sk(cx, cz), s = stukken.get(k); if (!s) return;
    for (const L of s.l) if (L) { gpuBytes -= L.bytes; gl.deleteBuffer(L.buf); gl.deleteVertexArray(L.vao); }
    stukken.delete(k);
  }
  function allesWeg() { for (const s of [...stukken.values()]) weg(s.cx, s.cz); }

  // ---------------- voorwerpen als 3D-vorm (blokjes en uitgestanste plaatjes)
  const dingVormen = new Map();
  const DOZENVORM = new Set(['tafel', 'stoel', 'pot', 'kaars', 'tapijt', 'spoor']);
  function dingVorm(id) {
    if (dingVormen.has(id)) return dingVormen.get(id);
    const P = [], I = [];
    const vlak = (a, b, c, d, laag, u0, v0, u1, v1, sch) => { const o = P.length / 7; for (const [p, u, v] of [[a, u0, v1], [b, u1, v1], [c, u1, v0], [d, u0, v0]]) P.push(p[0], p[1], p[2], u, v, laag, sch); I.push(o, o + 1, o + 2, o, o + 2, o + 3); };
    const it = G.IT[id], bl = it && it.blok ? G.BL[it.blok] : null;
    let tint = 0;
    if (bl && DOZENVORM.has(bl.vorm)) {
      // vormen die uit dozen bestaan: precies zoals in de wereld, in het midden van het voorwerp
      const st = bl.vorm === 'kist' || bl.stand === 'richting' ? 2 : 0;
      for (const d of G.vormDozen(it.blok | ((it.stand || st) << 8), null)) {
        const [x0, y0, z0, x1, y1, z1] = d.map(q => q / 16 - 0.5);
        const t = d.slice(6, 12);
        vlak([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], t[2], d[0] / 16, d[2] / 16, d[3] / 16, d[5] / 16, 1.0);
        vlak([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], t[3], d[0] / 16, d[2] / 16, d[3] / 16, d[5] / 16, 0.5);
        vlak([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], t[0], d[2] / 16, 1 - d[4] / 16, d[5] / 16, 1 - d[1] / 16, 0.75);
        vlak([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], t[1], d[2] / 16, 1 - d[4] / 16, d[5] / 16, 1 - d[1] / 16, 0.75);
        vlak([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], t[4], d[0] / 16, 1 - d[4] / 16, d[3] / 16, 1 - d[1] / 16, 0.88);
        vlak([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], t[5], d[0] / 16, 1 - d[4] / 16, d[3] / 16, 1 - d[1] / 16, 0.88);
      }
      if (bl.tint && bl.tint < 3) tint = bl.tint;
    } else if (bl && (bl.vorm === 'kubus' || bl.vorm === 'plaat' || bl.vorm === 'trap' || bl.vorm === 'kist' || bl.vorm === 'cactus' || bl.vorm === 'hek' || bl.vorm === 'bed' || bl.vorm === 'vlaai')) {
      const h = bl.vorm === 'plaat' ? 0.5 : bl.vorm === 'vlaai' ? 0.5 : bl.vorm === 'bed' ? 0.56 : 1;
      const s = 0.5, x0 = -s, x1 = s, y0 = -s, y1 = -s + h * 2 * s, z0 = -s, z1 = s;
      const tb = bl.tb, tz = bl.tz, to = bl.to, tv = bl.stand === 'richting' || bl.vorm === 'kist' ? bl.tv : tz;
      vlak([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], tb, 0, 0, 1, 1, 1.0);
      vlak([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], to, 0, 0, 1, 1, 0.5);
      vlak([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], tz, 0, 1 - h, 1, 1, 0.75);
      vlak([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], tz, 0, 1 - h, 1, 1, 0.75);
      vlak([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], tv, 0, 1 - h, 1, 1, 0.88);
      vlak([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], tz, 0, 1 - h, 1, 1, 0.88);
      if (bl.tint && bl.tint < 3) tint = bl.tint;
      if (bl.overlay) tint = 0;
    } else {
      // uitgestanst plaatje: voor- en achterkant plus randjes waar een pixel aan doorzichtig grenst
      const laag = it ? (bl ? bl.tz : it.tex) : 0, bron = bl ? T.data : T.ddata;
      if (bl && bl.tint && bl.tint < 3) tint = bl.tint;
      const px = (x, y) => (x < 0 || y < 0 || x > 15 || y > 15) ? 0 : bron[((laag * 16 + y) * 16 + x) * 4 + 3] > 127;
      const d = 1 / 32, s = 1 / 16;
      vlak([-0.5, -0.5, d], [0.5, -0.5, d], [0.5, 0.5, d], [-0.5, 0.5, d], laag, 0, 0, 1, 1, 1.0);
      vlak([0.5, -0.5, -d], [-0.5, -0.5, -d], [-0.5, 0.5, -d], [0.5, 0.5, -d], laag, 1, 0, 0, 1, 0.8);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!px(x, y)) continue;
        const X0 = -0.5 + x * s, X1 = X0 + s, Y1 = 0.5 - y * s, Y0 = Y1 - s, u = (x + 0.5) / 16, v = (y + 0.5) / 16;
        if (!px(x - 1, y)) vlak([X0, Y0, -d], [X0, Y0, d], [X0, Y1, d], [X0, Y1, -d], laag, u, v, u, v, 0.7);
        if (!px(x + 1, y)) vlak([X1, Y0, d], [X1, Y0, -d], [X1, Y1, -d], [X1, Y1, d], laag, u, v, u, v, 0.7);
        if (!px(x, y - 1)) vlak([X0, Y1, d], [X1, Y1, d], [X1, Y1, -d], [X0, Y1, -d], laag, u, v, u, v, 0.95);
        if (!px(x, y + 1)) vlak([X0, Y0, -d], [X1, Y0, -d], [X1, Y0, d], [X0, Y0, d], laag, u, v, u, v, 0.55);
      }
    }
    const vao = gl.createVertexArray(), vb = gl.createBuffer(), ib = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    const r = { vao, n: I.length, tint, ding: !bl, blok: !!(bl && (DOZENVORM.has(bl.vorm) || bl.vorm === 'kubus' || bl.vorm === 'plaat' || bl.vorm === 'trap' || bl.vorm === 'kist' || bl.vorm === 'cactus' || bl.vorm === 'hek' || bl.vorm === 'bed' || bl.vorm === 'vlaai')), gloed: !!(bl && bl.gloed), kleur: it && it.kleur !== undefined ? paletKleur(it.kleur) : null };
    dingVormen.set(id, r); return r;
  }
  // ---------------- deeltjes
  const MAXD = 600, dData = new Float32Array(MAXD * 4 * 8);
  const dVao = gl.createVertexArray(), dBuf = gl.createBuffer();
  gl.bindVertexArray(dVao); gl.bindBuffer(gl.ARRAY_BUFFER, dBuf); gl.bufferData(gl.ARRAY_BUFFER, dData.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bindVertexArray(null);
  // ---------------- lijnen (omlijning van het blok waar je naar kijkt)
  const lVao = gl.createVertexArray(), lBuf = gl.createBuffer();
  gl.bindVertexArray(lVao); gl.bindBuffer(gl.ARRAY_BUFFER, lBuf); gl.bufferData(gl.ARRAY_BUFFER, 4096 * 12, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); gl.bindVertexArray(null);
  const leegVao = gl.createVertexArray();

  // ---------------- camera
  const VP = new Float32Array(16), INV = new Float32Array(16), PROJ = new Float32Array(16), VIEW = new Float32Array(16);
  function perspectief(o, fov, asp, n, f) { const t = 1 / Math.tan(fov / 2); o.fill(0); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); }
  function mul(o, a, b) { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } }
  function inverteer(o, m) {
    const a = m, b = new Float32Array(16);
    b[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
    b[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
    b[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
    b[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
    b[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
    b[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
    b[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
    b[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
    b[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
    b[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
    b[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
    b[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
    b[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
    b[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
    b[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
    b[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
    let det = a[0] * b[0] + a[1] * b[4] + a[2] * b[8] + a[3] * b[12]; det = det ? 1 / det : 0;
    for (let i = 0; i < 16; i++) o[i] = b[i] * det;
  }
  const frustum = new Float32Array(24);
  function maakFrustum(m) {
    const p = [[3, 0, 1], [3, 0, -1], [3, 1, 1], [3, 1, -1], [3, 2, 1], [3, 2, -1]];
    for (let i = 0; i < 6; i++) {
      const [a, b, s] = p[i];
      let x = m[a] + s * m[b], y = m[4 + a] + s * m[4 + b], z = m[8 + a] + s * m[8 + b], w = m[12 + a] + s * m[12 + b];
      const l = Math.hypot(x, y, z); frustum[i * 4] = x / l; frustum[i * 4 + 1] = y / l; frustum[i * 4 + 2] = z / l; frustum[i * 4 + 3] = w / l;
    }
  }
  function inBeeld(x0, y0, z0, x1, y1, z1) {
    for (let i = 0; i < 6; i++) {
      const a = frustum[i * 4], b = frustum[i * 4 + 1], c = frustum[i * 4 + 2], d = frustum[i * 4 + 3];
      if (a * (a > 0 ? x1 : x0) + b * (b > 0 ? y1 : y0) + c * (c > 0 ? z1 : z0) + d < 0) return false;
    }
    return true;
  }

  // ---------------- tekenen
  let W = 1, H = 1;
  function maatOk(schaal) {
    const dpr = Math.min(window.devicePixelRatio || 1, opt.maxDpr || 2) * (schaal || 1);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (w !== W || h !== H) { canvas.width = W = w; canvas.height = H = h; }
  }
  const stats = { draws: 0, vlakken: 0, stukken: 0, ms: 0 };
  const zichtbaar = [];
  function zetLuchtUniforms(P, L) {
    const u = P.u;
    if (u.uZenit) gl.uniform3fv(u.uZenit, L.zenit); if (u.uHorizon) gl.uniform3fv(u.uHorizon, L.horizon);
    if (u.uZonRicht) gl.uniform3fv(u.uZonRicht, L.zonRicht); if (u.uMaanRicht) gl.uniform3fv(u.uMaanRicht, L.maanRicht);
    if (u.uZonGloed) gl.uniform3fv(u.uZonGloed, L.zonGloed);
  }
  function zetLicht(P, L) {
    const u = P.u;
    gl.uniform3fv(u.uZonKleur, L.zonKleur); gl.uniform3fv(u.uFakKleur, L.fakKleur);
    if (u.uMistKleur) gl.uniform3fv(u.uMistKleur, L.mistKleur);
    if (u.uMist) gl.uniform2f(u.uMist, L.mist[0], L.mist[1]);
    if (u.uMin) gl.uniform1f(u.uMin, L.min); if (u.uFlakker) gl.uniform1f(u.uFlakker, L.flakker);
    if (u.uOnderWater) gl.uniform1f(u.uOnderWater, L.onderWater ? 1 : 0);
    if (u.uMistDonker) gl.uniform1f(u.uMistDonker, L.mistDonker == null ? 1 : L.mistDonker);
    if (u.uTexOfs) gl.uniform3fv(u.uTexOfs, TEXOFS);
    zetLuchtUniforms(P, L);
  }
  function teken(C, L, extra) {
    const t0 = performance.now();
    maatOk(C.schaal);
    gl.viewport(0, 0, W, H);
    const asp = W / H;
    perspectief(PROJ, C.fov, asp, 0.06, Math.max(400, L.mist[1] * 1.6 + 200));
    // kijkmatrix zonder verplaatsing: alles wordt tegenover de camera getekend (scherp, ook ver van het begin)
    const cy = Math.cos(C.yaw), sy = Math.sin(C.yaw), cp = Math.cos(C.pitch), sp = Math.sin(C.pitch);
    // camera kijkt naar -z bij yaw 0; yaw draait om y, pitch om x
    const fx = -sy * cp, fy = sp, fz = -cy * cp;
    const rx = cy, rz = -sy;
    const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
    VIEW.set([rx, ux, -fx, 0, 0, uy, -fy, 0, rz, uz, -fz, 0, 0, 0, 0, 1]);
    if (C.schud) { VIEW[12] += C.schud[0]; VIEW[13] += C.schud[1]; }
    mul(VP, PROJ, VIEW); inverteer(INV, VP); maakFrustum(VP);
    gl.clearColor(L.horizon[0], L.horizon[1], L.horizon[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texArr);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tintTex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, ruisTex);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D_ARRAY, dingArr);
    // zichtbare stukken, van dichtbij naar ver
    zichtbaar.length = 0;
    const maxAfst = (L.mist[1] + 24);
    for (const s of stukken.values()) {
      if (s.ymax < 0) continue;
      const x0 = s.cx * 16 - C.x, z0 = s.cz * 16 - C.z;
      const dx = Math.max(0, Math.abs(x0 + 8) - 8), dz = Math.max(0, Math.abs(z0 + 8) - 8);
      if (dx * dx + dz * dz > maxAfst * maxAfst) continue;
      if (!inBeeld(x0, s.ymin * 16 - C.y, z0, x0 + 16, (s.ymax + 1) * 16 - C.y, z0 + 16)) continue;
      s.afst = (x0 + 8) * (x0 + 8) + (z0 + 8) * (z0 + 8);
      zichtbaar.push(s);
    }
    zichtbaar.sort((a, b) => a.afst - b.afst);
    stats.draws = 0; stats.vlakken = 0; stats.stukken = zichtbaar.length;
    const tekenLaag = (P, l) => {
      gl.useProgram(P.p);
      gl.uniformMatrix4fv(P.u.uVP, false, VP); gl.uniform1i(P.u.uTex, 0); gl.uniform1i(P.u.uTint, 1); if (P.u.uRuis) gl.uniform1i(P.u.uRuis, 2);
      if (P.u.uPalet) gl.uniform3fv(P.u.uPalet, PALET);
      gl.uniform1f(P.u.uTijd, L.tijdSec); if (P.u.uWind) gl.uniform1f(P.u.uWind, L.wind);
      if (P.u.uRuisOfs) gl.uniform2f(P.u.uRuisOfs, 0, 0);
      zetLicht(P, L);
      const lijst = l >= 2 ? zichtbaar.slice().reverse() : zichtbaar;
      for (const s of lijst) {
        const Lg = s.l[l]; if (!Lg) continue;
        const ofs = s.ofs[l];
        const x0 = s.cx * 16 - C.x, z0 = s.cz * 16 - C.z;
        gl.uniform3f(P.u.uStuk, x0, -C.y, z0);
        gl.uniform2f(P.u.uStukMod, ((s.cx * 16) % 512 + 512) % 512, ((s.cz * 16) % 512 + 512) % 512);
        gl.bindVertexArray(Lg.vao);
        // secties die in beeld zijn, achter elkaar in één keer
        let a = -1;
        for (let sy = 0; sy <= 8; sy++) {
          const vol = sy < 8 && ofs[sy + 1] > ofs[sy] && inBeeld(x0, sy * 16 - C.y, z0, x0 + 16, sy * 16 + 16 - C.y, z0 + 16);
          if (vol && a < 0) a = sy;
          if (!vol && a >= 0) { const q0 = ofs[a] / 4, q1 = ofs[sy] / 4; gl.drawElements(gl.TRIANGLES, (q1 - q0) * 6, gl.UNSIGNED_INT, q0 * 24); stats.draws++; stats.vlakken += q1 - q0; a = -1; }
        }
      }
    };
    tekenLaag(PB, 0);
    gl.disable(gl.CULL_FACE);
    tekenLaag(PU, 1);
    // lucht achter alles
    gl.depthMask(false);
    gl.useProgram(PL.p); gl.uniformMatrix4fv(PL.u.uInvVP, false, INV);
    gl.uniform1f(PL.u.uSterren, L.sterren); gl.uniform1f(PL.u.uMaanFase, L.maanFase); gl.uniform1f(PL.u.uTijd, L.tijdSec); gl.uniform1f(PL.u.uOnderWater, L.onderWater ? 1 : 0); gl.uniform3fv(PL.u.uMistKleur, L.mistKleur); gl.uniform1f(PL.u.uMistDonker, L.mistDonker == null ? 1 : L.mistDonker);
    zetLuchtUniforms(PL, L);
    gl.bindVertexArray(leegVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    // voorwerpen en deeltjes (voor het water, zodat je ze erdoorheen ziet)
    if (extra && extra.dingen) tekenDingen(extra.dingen, L, C);
    if (extra && extra.deeltjes && extra.deeltjes.n) tekenDeeltjes(extra.deeltjes, L, C);
    if (extra && extra.wezens && extra.wezens.length) tekenWezens(extra.wezens, L, C);
    // wolken
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (opt.wolken !== false && !L.onderWater) {
      gl.depthMask(false);
      gl.useProgram(PWk.p); gl.uniformMatrix4fv(PWk.u.uVP, false, VP);
      gl.uniform1f(PWk.u.uHoogte, 178 - C.y); gl.uniform2f(PWk.u.uOfs, ((C.x % 9000) + 9000) % 9000, ((C.z % 9000) + 9000) % 9000);
      gl.uniform1f(PWk.u.uTijd, L.tijdSec); gl.uniform1f(PWk.u.uDek, L.wolkDek); gl.uniform3fv(PWk.u.uWolkKleur, L.wolkKleur); gl.uniform3fv(PWk.u.uWolkSchaduw, L.wolkSchaduw);
      gl.uniform1i(PWk.u.uRuis, 2); zetLuchtUniforms(PWk, L);
      gl.bindVertexArray(leegVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.depthMask(true);
    }
    // water en ijs: eerst het water (zonder diepte), dan het ijs (met diepte, zodat ijs nooit dubbel over ijs heen valt)
    gl.depthMask(false);
    tekenLaag(PW, 2);
    gl.depthMask(true);
    tekenLaag(PW, 3);
    // omlijning en barsten
    if (extra && extra.kader) tekenKader(extra.kader, C, L);
    // het ding in je hand
    if (extra && extra.hand) tekenHand(extra.hand, L, C);
    gl.bindVertexArray(null);
    stats.ms = performance.now() - t0;
  }
  const M = new Float32Array(16);
  function tekenDingen(lijst, L, C) {
    gl.useProgram(PD.p); gl.uniformMatrix4fv(PD.u.uVP, false, VP); gl.uniform1i(PD.u.uTex, 0); gl.uniform1i(PD.u.uDing, 3); gl.uniform1f(PD.u.uBron, 0);
    gl.uniform2f(PD.u.uMist, L.mist[0], L.mist[1]); gl.uniform1f(PD.u.uOnderWater, L.onderWater ? 1 : 0); gl.uniform3fv(PD.u.uMistKleur, L.mistKleur); zetLuchtUniforms(PD, L);
    gl.enable(gl.CULL_FACE);
    for (const d of lijst) {
      const v = dingVorm(d.id);
      const s = d.schaal * (v.blok ? 0.5 : 1), c = Math.cos(d.draai), si = Math.sin(d.draai);
      M.set([c * s, 0, -si * s, 0, 0, s, 0, 0, si * s, 0, c * s, 0, d.x - C.x, d.y - C.y, d.z - C.z, 1]);
      gl.uniformMatrix4fv(PD.u.uM, false, M);
      gl.uniform3fv(PD.u.uLicht, d.licht); gl.uniform1f(PD.u.uBron, v.ding ? 1 : 0); gl.uniform1f(PD.u.uTint, v.tint || v.kleur ? 1 : 0); gl.uniform3fv(PD.u.uTintK, v.kleur || (v.tint === 2 ? [0.31, 0.62, 0.23] : [0.44, 0.7, 0.29])); gl.uniform1f(PD.u.uGloed, v.gloed ? 0.7 : 0);
      gl.bindVertexArray(v.vao); gl.drawElements(gl.TRIANGLES, v.n, gl.UNSIGNED_SHORT, 0);
    }
  }
  // ---------------- wezens: karretjes en bewoners, gemaakt van dozen (in zestienden), met delen die kunnen draaien (armen, benen, hoofd)
  // model(naam, delen): elk deel { naam, dozen: [[x0,y0,z0,x1,y1,z1], ...], tex (blok) of dtex (voorwerp), of per doos [x0..z1, lagen[6]],
  //   kleur [r,g,b] (vermenigvuldigd), spil [x,y,z] (waar het deel om draait) }
  const MODELLEN = new Map();
  function dozenVorm(dozen, laag) {
    const P = [], I = [];
    const vlak = (p, lg, uv, sch) => { const o = P.length / 7; for (let k = 0; k < 4; k++) P.push(p[k][0], p[k][1], p[k][2], uv[k][0], uv[k][1], lg, sch); I.push(o, o + 1, o + 2, o, o + 2, o + 3); };
    for (const d of dozen) {
      const [x0, y0, z0, x1, y1, z1] = d, L = Array.isArray(d[6]) ? d[6] : [laag, laag, laag, laag, laag, laag];
      // de textuur volgt de plek in zestienden, net als bij blokken (een kleine doos krijgt een stukje van de textuur)
      const U0 = q => ((q % 16) + 16) % 16 / 16;
      const uvA = (a0, a1, b0, b1, flipU) => { const ua = U0(a0), ub = ua + (a1 - a0) / 16, va = 1 - (U0(b0) + (b1 - b0) / 16), vb = va + (b1 - b0) / 16; return flipU ? [[ub, vb], [ua, vb], [ua, va], [ub, va]] : [[ua, vb], [ub, vb], [ub, va], [ua, va]]; };
      vlak([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], L[0], uvA(z0, z1, y0, y1, true), 0.75);
      vlak([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], L[1], uvA(z0, z1, y0, y1), 0.75);
      vlak([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], L[2], uvA(x0, x1, z0, z1), 1.0);
      vlak([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], L[3], uvA(x0, x1, z0, z1), 0.5);
      vlak([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], L[4], uvA(x0, x1, y0, y1), 0.88);
      vlak([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], L[5], uvA(x0, x1, y0, y1, true), 0.88);
    }
    const vao = gl.createVertexArray(), vb = gl.createBuffer(), ib = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, n: I.length };
  }
  function model(naam, delen) {
    const m = delen.map(d => ({ naam: d.naam, ding: d.dtex !== undefined, vorm: dozenVorm(d.dozen, d.dtex !== undefined ? d.dtex : d.tex || 0), kleur: d.kleur || null, spil: d.spil || [0, 0, 0] }));
    MODELLEN.set(naam, m); return m;
  }
  const MB = new Float32Array(16), MP = new Float32Array(16), MQ = new Float32Array(16), MR = new Float32Array(16);
  // lijst: [{ model, x, y, z, yaw, pitch, licht: [r,g,b], delen: { naam: [rx, ry, rz] }, kleuren: { naam: [r,g,b] } }]
  function tekenWezens(lijst, L, C) {
    gl.useProgram(PD.p); gl.uniformMatrix4fv(PD.u.uVP, false, VP); gl.uniform1i(PD.u.uTex, 0); gl.uniform1i(PD.u.uDing, 3); gl.uniform1f(PD.u.uGloed, 0);
    gl.uniform2f(PD.u.uMist, L.mist[0], L.mist[1]); gl.uniform1f(PD.u.uOnderWater, L.onderWater ? 1 : 0); gl.uniform3fv(PD.u.uMistKleur, L.mistKleur); zetLuchtUniforms(PD, L);
    gl.enable(gl.CULL_FACE);
    for (const w of lijst) {
      const m = MODELLEN.get(w.model); if (!m) continue;
      stelM(MB, w.x - C.x, w.y - C.y, w.z - C.z, w.pitch || 0, w.yaw || 0, w.rol || 0, (w.schaal || 1) / 16);
      gl.uniform3fv(PD.u.uLicht, w.licht || [1, 1, 1]);
      for (const d of m) {
        const a = w.delen && w.delen[d.naam];
        if (a) { const [px, py, pz] = d.spil; stelM(MQ, px, py, pz, a[0], a[1], a[2], 1); stelM(MR, -px, -py, -pz, 0, 0, 0, 1); mul(MP, MQ, MR); mul(MQ, MB, MP); gl.uniformMatrix4fv(PD.u.uM, false, MQ); }
        else gl.uniformMatrix4fv(PD.u.uM, false, MB);
        const k = (w.kleuren && w.kleuren[d.naam]) || d.kleur;
        gl.uniform1f(PD.u.uBron, d.ding ? 1 : 0); gl.uniform1f(PD.u.uTint, k ? 1 : 0); if (k) gl.uniform3fv(PD.u.uTintK, k);
        gl.bindVertexArray(d.vorm.vao); gl.drawElements(gl.TRIANGLES, d.vorm.n, gl.UNSIGNED_SHORT, 0);
      }
    }
  }
  function tekenDeeltjes(D, L, C) {
    gl.useProgram(PDt.p); gl.uniformMatrix4fv(PDt.u.uVP, false, VP); gl.uniform1i(PDt.u.uTex, 0); gl.uniform1i(PDt.u.uDing, 3);
    gl.uniform3fv(PDt.u.uZonKleur, L.zonKleur); gl.uniform3fv(PDt.u.uFakKleur, L.fakKleur);
    const cy = Math.cos(C.yaw), sy = Math.sin(C.yaw), cp = Math.cos(C.pitch), sp = Math.sin(C.pitch);
    gl.uniform3f(PDt.u.uRechts, cy, 0, -sy); gl.uniform3f(PDt.u.uOp, sy * sp, cp, cy * sp);
    const n = Math.min(MAXD, D.n), a = D.a; let o = 0;
    for (let i = 0; i < n; i++) {
      const b = i * 8;
      for (let k = 0; k < 4; k++) { dData[o++] = a[b] - C.x; dData[o++] = a[b + 1] - C.y; dData[o++] = a[b + 2] - C.z; dData[o++] = a[b + 3]; dData[o++] = a[b + 4]; dData[o++] = a[b + 5]; dData[o++] = a[b + 6]; dData[o++] = a[b + 7]; }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, dBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, dData, 0, o);
    gl.bindVertexArray(dVao); gl.drawElements(gl.TRIANGLES, n * 6, gl.UNSIGNED_INT, 0);
  }
  const kaderData = new Float32Array(4096 * 3);
  function tekenKader(K, C, L) {
    // K.dozen: [x0,y0,z0,x1,y1,z1] in blokken (wereld); K.barst: 0..9 of -1
    let o = 0; const e = 0.002;
    for (const d of K.dozen) {
      const x0 = d[0] - e - C.x, y0 = d[1] - e - C.y, z0 = d[2] - e - C.z, x1 = d[3] + e - C.x, y1 = d[4] + e - C.y, z1 = d[5] + e - C.z;
      const r = [[x0, y0, z0, x1, y0, z0], [x0, y1, z0, x1, y1, z0], [x0, y0, z1, x1, y0, z1], [x0, y1, z1, x1, y1, z1], [x0, y0, z0, x0, y1, z0], [x1, y0, z0, x1, y1, z0], [x0, y0, z1, x0, y1, z1], [x1, y0, z1, x1, y1, z1], [x0, y0, z0, x0, y0, z1], [x1, y0, z0, x1, y0, z1], [x0, y1, z0, x0, y1, z1], [x1, y1, z0, x1, y1, z1]];
      for (const l of r) for (let i = 0; i < 6; i++) kaderData[o++] = l[i];
    }
    gl.useProgram(PLn.p); gl.uniformMatrix4fv(PLn.u.uVP, false, VP); gl.uniform3f(PLn.u.uOfs, 0, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(lVao); gl.bindBuffer(gl.ARRAY_BUFFER, lBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, kaderData, 0, o);
    gl.uniform4f(PLn.u.uKleur, 0.06, 0.05, 0.08, 0.85); gl.drawArrays(gl.LINES, 0, o / 3);
    gl.uniform4f(PLn.u.uKleur, 1, 1, 1, 0.3); gl.uniform3f(PLn.u.uOfs, 0, 0.004, 0); gl.drawArrays(gl.LINES, 0, o / 3);
    // een zacht licht waas over het blok, zodat je goed ziet waar je naar kijkt
    let f = 0; const e2 = 0.004;
    for (const d of K.dozen) {
      const x0 = d[0] - e2 - C.x, y0 = d[1] - e2 - C.y, z0 = d[2] - e2 - C.z, x1 = d[3] + e2 - C.x, y1 = d[4] + e2 - C.y, z1 = d[5] + e2 - C.z;
      const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      for (const q of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) for (const i of [q[0], q[1], q[2], q[0], q[2], q[3]]) { kaderData[f++] = v[i][0]; kaderData[f++] = v[i][1]; kaderData[f++] = v[i][2]; }
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, kaderData, 0, f); gl.uniform3f(PLn.u.uOfs, 0, 0, 0);
    gl.depthMask(false); gl.uniform4f(PLn.u.uKleur, 1, 1, 0.92, 0.09); gl.drawArrays(gl.TRIANGLES, 0, f / 3); gl.depthMask(true);
    if (K.barst >= 0) {
      // barsten: de dozen nog eens, met de barsttextuur
      const laag = G.TEXNR['barst' + Math.min(9, K.barst)];
      gl.useProgram(PD.p); gl.uniformMatrix4fv(PD.u.uVP, false, VP); gl.uniform1i(PD.u.uTex, 0); gl.uniform1i(PD.u.uDing, 3); gl.uniform1f(PD.u.uBron, 0);
      gl.uniform2f(PD.u.uMist, 1e5, 1e5 + 1); gl.uniform1f(PD.u.uOnderWater, 0); gl.uniform1f(PD.u.uTint, 0); gl.uniform1f(PD.u.uGloed, 0);
      gl.uniform3f(PD.u.uLicht, 0.38, 0.34, 0.32);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
      gl.blendFunc(gl.DST_COLOR, gl.ZERO);
      for (const d of K.dozen) {
        const v = barstVorm(laag);
        const sx = d[3] - d[0], sy = d[4] - d[1], sz = d[5] - d[2];
        M.set([sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, d[0] - C.x, d[1] - C.y, d[2] - C.z, 1]);
        gl.uniformMatrix4fv(PD.u.uM, false, M); gl.bindVertexArray(v.vao); gl.drawElements(gl.TRIANGLES, v.n, gl.UNSIGNED_SHORT, 0);
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.disable(gl.BLEND);
  }
  const barstVormen = {};
  function barstVorm(laag) {
    if (barstVormen[laag]) return barstVormen[laag];
    const P = [], I = [];
    const vlak = (a, b, c, d) => { const o = P.length / 7; for (const [p, u, v] of [[a, 0, 1], [b, 1, 1], [c, 1, 0], [d, 0, 0]]) P.push(p[0], p[1], p[2], u, v, laag, 1); I.push(o, o + 1, o + 2, o, o + 2, o + 3); };
    vlak([0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]); vlak([0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]);
    vlak([1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]); vlak([0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]);
    vlak([0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]); vlak([1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]);
    const vao = gl.createVertexArray(), vb = gl.createBuffer(), ib = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.STATIC_DRAW); gl.bindVertexArray(null);
    return (barstVormen[laag] = { vao, n: I.length });
  }
  // ---------------- de arm in beeld: een blokkige mouw en hand, en wat je vasthoudt
  // Alles in de ruimte van de schouder: -z wijst naar de pols, de hand zit daar voorbij.
  const ARM = { L: 0.62, mouw: null, hand: null };
  function doosVorm(a, laag, lang) {
    // a = [x0, y0, z0, x1, y1, z1]; op de lange zijkanten loopt de textuur van de schouder (boven) naar de pols (onder)
    const P = [], I = [], [x0, y0, z0, x1, y1, z1] = a;
    const vlak = (p, laag2, uv, sch) => { const o = P.length / 7; for (let k = 0; k < 4; k++) P.push(p[k][0], p[k][1], p[k][2], uv[k][0], uv[k][1], laag2, sch); I.push(o, o + 1, o + 2, o, o + 2, o + 3); };
    const LV = lang ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 1], [1, 1], [1, 0], [0, 0]];
    const EV = [[0, 1], [1, 1], [1, 0], [0, 0]];
    // boven, onder, links, rechts (lang), voor en achter (kopse kanten)
    vlak([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], laag, LV, 1.0);
    vlak([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], laag, LV.slice().reverse(), 0.55);
    vlak([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], laag, [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => lang ? [u, v] : [v, u]), 0.8);
    vlak([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], laag, [[0, 1], [1, 1], [1, 0], [0, 0]].map(([u, v]) => lang ? [u, v] : [v, u]), 0.68);
    vlak([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], laag, EV, 0.9);
    vlak([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], laag, EV, 0.75);
    const vao = gl.createVertexArray(), vb = gl.createBuffer(), ib = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, n: I.length };
  }
  function armKlaar() {
    if (ARM.mouw) return;
    ARM.mouw = doosVorm([-0.095, -0.095, -ARM.L, 0.095, 0.095, 0.05], G.DTEXNR.arm_mouw, true); ARM.mouw.ding = true;
    ARM.hand = doosVorm([-0.082, -0.086, -ARM.L - 0.21, 0.082, 0.082, -ARM.L + 0.03], G.DTEXNR.arm_huid, false); ARM.hand.ding = true;
    // de duim, aan de binnenkant van de hand: zo zie je dat de hand iets vasthoudt
    ARM.duim = doosVorm([-0.112, -0.03, -ARM.L - 0.17, -0.062, 0.045, -ARM.L - 0.04], G.DTEXNR.arm_huid, false); ARM.duim.ding = true;
  }
  // M = T * Ry * Rx * Rz * schaal
  function stelM(o, tx, ty, tz, rx, ry, rz, s) {
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    // kolommen van Ry*Rx*Rz
    const a00 = cy * cz + sy * sx * sz, a10 = cx * sz, a20 = -sy * cz + cy * sx * sz;
    const a01 = -cy * sz + sy * sx * cz, a11 = cx * cz, a21 = sy * sz + cy * sx * cz;
    const a02 = sy * cx, a12 = -sx, a22 = cy * cx;
    o[0] = a00 * s; o[1] = a10 * s; o[2] = a20 * s; o[3] = 0;
    o[4] = a01 * s; o[5] = a11 * s; o[6] = a21 * s; o[7] = 0;
    o[8] = a02 * s; o[9] = a12 * s; o[10] = a22 * s; o[11] = 0;
    o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1;
    return o;
  }
  const HP = new Float32Array(16), MA = new Float32Array(16), ML = new Float32Array(16), MI = new Float32Array(16);
  function tekenArmDeel(v, M2, licht, tint, tintK, gloed) {
    gl.uniformMatrix4fv(PD.u.uM, false, M2); gl.uniform3fv(PD.u.uLicht, licht); gl.uniform1f(PD.u.uBron, v.ding ? 1 : 0);
    gl.uniform1f(PD.u.uTint, tint ? 1 : 0); gl.uniform3fv(PD.u.uTintK, tintK); gl.uniform1f(PD.u.uGloed, gloed || 0);
    gl.bindVertexArray(v.vao); gl.drawElements(gl.TRIANGLES, v.n, gl.UNSIGNED_SHORT, 0);
  }
  // de draaiing van de arm in rust, en het omgekeerde daarvan (voor voorwerpen die in beeld een vaste stand hebben)
  const RUST = { rx: 0.45, ry: 0.1, rz: -0.12 }, RI = new Float32Array(16), RV = new Float32Array(16), MT = new Float32Array(16), MS = new Float32Array(16);
  (function () { const R0 = stelM(new Float32Array(16), 0, 0, 0, RUST.rx, RUST.ry, RUST.rz, 1); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) RI[i * 4 + j] = R0[j * 4 + i]; RI[15] = 1; })();
  // voorwerp in de hand: plek in de ruimte van de arm, en de stand zoals je hem in beeld ziet.
  // Elke soort heeft een eigen houding:
  //   blok     rust op de handpalm, een beetje gedraaid zodat je de bovenkant en twee zijkanten ziet
  //   gereed   het handvat in de vuist, de kop schuin naar voren
  //   rechtop  een fakkel (of kaars) rechtop in de vuist
  //   klein    eten en kleine spulletjes tussen duim en vingers
  function handVoorwerp(o, v, soort) {
    if (soort === 'blok') { stelM(MT, 0.0, 0.155, -ARM.L - 0.12, 0, 0, 0, 1); stelM(RV, 0, 0, 0, 0.2, 0.74, 0.04, 0.155); }
    else if (soort === 'gereed') { stelM(MT, -0.01, 0.0, -ARM.L - 0.11, 0, 0, 0, 1); stelM(RV, 0, 0, 0, -0.55, -0.55, 1.08, 0.38); }
    else if (soort === 'rechtop') { stelM(MT, -0.01, 0.03, -ARM.L - 0.2, 0, 0, 0, 1); stelM(RV, 0, 0, 0, -0.12, -0.55, 0.1, 0.46); }
    else { stelM(MT, -0.035, 0.105, -ARM.L - 0.19, 0, 0, 0, 1); stelM(RV, 0, 0, 0, -0.22, -0.4, 0.12, 0.21); }
    mul(MS, MT, RI); mul(o, MS, RV);
    // het handvat (linksonder in het plaatje) of de steel (onderaan) zit in de vuist
    if (soort === 'gereed' || soort === 'rechtop') { stelM(MT, soort === 'gereed' ? 0.28 : 0, soort === 'gereed' ? 0.28 : 0.3, 0, 0, 0, 0, 1); mul(MS, o, MT); o.set(MS); }
    return o;
  }
  // welke houding past bij een voorwerp
  function handSoort(id, v) {
    const it = G.IT[id]; if (!it) return 'klein';
    if (it.gereed) return 'gereed';
    const bl = it.blok ? G.BL[it.blok] : null;
    if (bl && (bl.vorm === 'fakkel' || bl.vorm === 'kaars')) return 'rechtop';
    if (v.blok) return 'blok';
    if (id === G.I.stok) return 'rechtop';
    return 'klein';
  }
  function tekenHand(h, L, C) {
    // eigen camera voor de arm, met een vaste kijkhoek, en de diepte leeg zodat hij nooit door een muur steekt
    armKlaar();
    gl.clear(gl.DEPTH_BUFFER_BIT);
    perspectief(HP, 1.2, W / H, 0.02, 10);
    const asp = W / H, portret = asp < 1, f = portret ? Math.max(0.3, asp * 0.72) : Math.min(1.15, Math.max(0.75, asp / 1.6));
    const a = h.zwaai || 0, s1 = Math.sin(a * Math.PI), s2 = Math.sin(Math.sqrt(a) * Math.PI);
    const leeg = !h.id, hak = h.soort === 'hak', v = leeg ? null : dingVorm(h.id), hs = leeg ? '' : handSoort(h.id, v);
    // waar de schouder zit (net buiten beeld rechtsonder) en hoe de arm wijst; op een staand scherm iets hoger, boven de knoppen
    let sx = 0.48 * f, sy = portret ? -0.52 : -0.62, sz = -0.3, rx = RUST.rx, ry = RUST.ry, rz = RUST.rz;
    // meedeinen bij het lopen, in de maat van de stappen; bij het rennen zakt de arm wat en zwaait hij verder
    const k = h.schommel || 0, fase = h.fase || 0, ren = h.ren || 0;
    sx += Math.sin(fase) * (0.024 + 0.012 * ren) * k; sy -= (1 - Math.abs(Math.cos(fase))) * (0.03 + 0.012 * ren) * k; rz += Math.sin(fase) * 0.025 * k;
    sy -= 0.035 * ren; sz += 0.03 * ren; rx -= 0.1 * ren; rx += Math.cos(fase) * 0.04 * k * ren;
    // een blok draag je met de palm wat meer naar boven, een fakkel iets hoger
    if (hs === 'blok') { rz += 0.08; rx += 0.04; } else if (hs === 'rechtop') { sy += 0.02; }
    // heel rustig ademhalen
    if (!h.stil) sy += Math.sin(h.tijd * 1.4) * 0.004;
    // zwaaien: hakken is een boog naar beneden (met gereedschap een flinke slag die eerst iets naar achteren haalt),
    // bouwen een kort duwtje naar voren, een lege hand stompt
    if (hak && !leeg) {
      const uit = Math.sin(Math.min(1, a * 3.2) * Math.PI) * (a < 0.31 ? 1 : 0); // even uithalen
      const slag = hs === 'gereed' ? 1.08 : 0.9;
      rx -= (0.5 * s1 - 0.1 * s2) * slag; rx += 0.12 * uit * slag; ry += 0.22 * s2; sz -= 0.05 * s1; rz -= 0.2 * s1 * slag; sy += 0.02 * uit;
    }
    else if (leeg) { sz -= 0.16 * s2; sy += 0.03 * s2; ry += 0.1 * s2; rx -= 0.08 * s1; }
    else { rx -= 0.22 * s1; sz -= 0.1 * s2; ry += 0.06 * s2; sy -= 0.02 * s1; }
    // wisselen van vak: de arm zakt even weg en komt terug
    const w = h.wissel || 0; sy -= w * 0.4; rx -= w * 0.45;
    // eten of drinken: de hand rustig naar je mond, en dan kleine hapjes
    if (h.eet >= 0) {
      const e0 = Math.min(1, h.eet * 3.2), e = e0 * e0 * (3 - 2 * e0), hap = Math.max(0, Math.sin(h.eet * 15)) * e;
      sx -= 0.14 * e; sy += 0.07 * e; sz += 0.03 * e; ry += 0.3 * e; rx += 0.12 * e; rz += 0.08 * e;
      sy += hap * 0.018; sz -= hap * 0.012; rx -= hap * 0.05;
    }
    stelM(MA, sx, sy, sz, rx, ry, rz, portret ? 0.76 : 1);
    gl.useProgram(PD.p); gl.uniformMatrix4fv(PD.u.uVP, false, HP); gl.uniform1i(PD.u.uTex, 0); gl.uniform1i(PD.u.uDing, 3);
    gl.uniform2f(PD.u.uMist, 1e5, 1e5 + 1); gl.uniform1f(PD.u.uOnderWater, 0); zetLuchtUniforms(PD, L);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    const huid = h.huid || [0.89, 0.71, 0.57];
    tekenArmDeel(ARM.mouw, MA, h.licht, false, huid);
    tekenArmDeel(ARM.hand, MA, h.licht, true, huid);
    tekenArmDeel(ARM.duim, MA, h.licht, true, huid);
    if (leeg) return;
    // het voorwerp in de hand
    handVoorwerp(ML, v, hs);
    mul(MI, MA, ML);
    tekenArmDeel(v, MI, h.licht, v.tint || v.kleur, v.kleur || (v.tint === 2 ? [0.31, 0.62, 0.23] : [0.44, 0.7, 0.29]), v.gloed ? 0.7 : 0);
  }
  function kijkMatrix(C) {
    maatOk(C.schaal);
    perspectief(PROJ, C.fov, W / H, 0.06, 600);
    const cy = Math.cos(C.yaw), sy = Math.sin(C.yaw), cp = Math.cos(C.pitch), sp2 = Math.sin(C.pitch);
    const fx = -sy * cp, fy = sp2, fz = -cy * cp, rx = cy, rz = -sy, ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
    VIEW.set([rx, ux, -fx, 0, 0, uy, -fy, 0, rz, uz, -fz, 0, 0, 0, 0, 1]); mul(VP, PROJ, VIEW); inverteer(INV, VP);
  }
  function kijkRichting(sx, sy) {
    // schermpunt (0..1) naar een richting in de wereld
    const x = sx * 2 - 1, y = 1 - sy * 2;
    const p = [x, y, 1, 1], q = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) q[i] = INV[i] * p[0] + INV[4 + i] * p[1] + INV[8 + i] * p[2] + INV[12 + i] * p[3];
    const l = Math.hypot(q[0] / q[3], q[1] / q[3], q[2] / q[3]);
    return [q[0] / q[3] / l, q[1] / q[3] / l, q[2] / q[3] / l];
  }
  return { gl, kijkMatrix, zetStuk, weg, allesWeg, zetKleur, teken, stats, kijkRichting, model, get gpuMB() { return gpuBytes / 1048576; }, stukken, dingVorm, maat: () => [W, H], verlies: () => gl.isContextLost() };
}
