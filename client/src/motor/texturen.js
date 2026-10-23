// ============================================================================
// Rommelblok: pixeltexturen. Alles met code getekend, 16 x 16, in één stapel.
// RB_TEXTUREN maakt de stapel, RB_ICONEN maakt er plaatjes voor de rugzak van.
// ============================================================================
export function RB_TEXTUREN(G) {
  'use strict';
  const N = G.TEXNAMEN.length, data = new Uint8Array(N * 1024), ND = G.DTEXNAMEN.length, ddata = new Uint8Array(ND * 1024), ontbreekt = [];
  let buf = null;

  // ---------------- hulpjes
  const HC = new Map();
  const H = s => { let c = HC.get(s); if (!c) { const n = parseInt(s.slice(1), 16); c = [n >> 16, (n >> 8) & 255, n & 255]; HC.set(s, c); } return c; };
  const P = (...a) => a.map(H);
  const kl = c => (typeof c === 'string' ? H(c) : c);
  const hs = (x, y, s) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1013, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const w = v => ((v % 16) + 16) % 16;
  const kn = v => Math.max(0, Math.min(255, Math.round(v)));
  function zet(x, y, c, a) { x = w(x); y = w(y); const i = (y * 16 + x) * 4; c = kl(c); buf[i] = kn(c[0]); buf[i + 1] = kn(c[1]); buf[i + 2] = kn(c[2]); buf[i + 3] = a === undefined ? 255 : a; }
  function zn(x, y, c, a) { if (x < 0 || y < 0 || x > 15 || y > 15) return; zet(x, y, c, a); } // zonder doorlopen
  function lees(x, y) { x = w(x); y = w(y); const i = (y * 16 + x) * 4; return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]; }
  const vol = (x, y) => buf[(w(y) * 16 + w(x)) * 4 + 3] > 0;
  const meng = (a, b, t) => { a = kl(a); b = kl(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  const maal = (c, f) => { c = kl(c); return [c[0] * f, c[1] * f, c[2] * f]; };
  const leeg = () => buf.fill(0);
  const vul = c => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, c); };
  const sm = t => t * t * (3 - 2 * t);
  const rng = s => G.rng(s * 2654435761 + 12345);
  // tegelbare waardenruis (0..1), loopt naadloos door aan de randen
  function veld(seed, per, oct, py) {
    const v = new Float32Array(256); let amp = 1, tot = 0;
    for (let o = 0; o < (oct || 1); o++) {
      const p = per << o, q = Math.max(1, Math.round((py || per) * (1 << o))), s = seed * 31 + o * 97;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const fx = (x + 0.5) / 16 * p, fy = (y + 0.5) / 16 * q, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
        const a = hs(ix % p, iy % q, s), b = hs((ix + 1) % p, iy % q, s), c = hs(ix % p, (iy + 1) % q, s), d = hs((ix + 1) % p, (iy + 1) % q, s);
        v[y * 16 + x] += amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
      }
      tot += amp; amp *= 0.5;
    }
    let lo = 9, hi = -9; for (let i = 0; i < 256; i++) { v[i] /= tot; lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]); }
    for (let i = 0; i < 256; i++) v[i] = (v[i] - lo) / (hi - lo || 1);
    return v;
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function kies(pal, t, x, y, d) { const n = pal.length; const f = t * (n - 1) + ((BAY[(w(y) & 3) * 4 + (w(x) & 3)] + 0.5) / 16 - 0.5) * (d === undefined ? 0.9 : d); return pal[Math.max(0, Math.min(n - 1, Math.round(f)))]; }
  function kaart(pal, v, d, extra) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let t = v[y * 16 + x]; if (extra) t = extra(x, y, t); zet(x, y, kies(pal, Math.max(0, Math.min(1, t)), x, y, d)); } }
  function lijn(x0, y0, x1, y1, c, a, wrap) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); (wrap ? zet : zn)(x, y, c, a); } }
  function blok(x0, y0, x1, y1, c, wrap) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) (wrap ? zet : zn)(x, y, c); }
  // cellen (voronoi), tegelbaar: id van de dichtstbijzijnde stip en afstand tot de rand
  function cellen(seed, n) {
    const r = rng(seed), pt = []; for (let i = 0; i < n; i++) pt.push([r() * 16, r() * 16]);
    const id = new Int16Array(256), rand = new Float32Array(256), d1v = new Float32Array(256), ox = new Float32Array(256), oy = new Float32Array(256);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let a = 1e9, b = 1e9, ai = 0, adx = 0, ady = 0;
      for (let i = 0; i < n; i++) { let dx = x + 0.5 - pt[i][0], dy = y + 0.5 - pt[i][1]; dx -= 16 * Math.round(dx / 16); dy -= 16 * Math.round(dy / 16); const d = Math.hypot(dx, dy); if (d < a) { b = a; a = d; ai = i; adx = dx; ady = dy; } else if (d < b) b = d; }
      const k = y * 16 + x; id[k] = ai; rand[k] = b - a; d1v[k] = a; ox[k] = adx; oy[k] = ady;
    }
    return { id, rand, d1: d1v, ox, oy, n };
  }
  // donkere omlijning rond een plaatje (voor voorwerpen en planten-iconen)
  const BUREN4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function omlijn(c) {
    const kopie = new Uint8Array(buf), uit = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (kopie[(y * 16 + x) * 4 + 3]) continue;
      let bij = null;
      for (const [dx, dy] of BUREN4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx > 15 || ny > 15) continue; const j = (ny * 16 + nx) * 4; if (kopie[j + 3]) { bij = [kopie[j], kopie[j + 1], kopie[j + 2]]; break; } }
      if (bij) uit.push([x, y, c ? kl(c) : meng(maal(bij, 0.28), '#1c1412', 0.45)]);
    }
    for (const [x, y, k] of uit) zet(x, y, k);
  }
  // lichte bovenrand en donkere onderrand op uitgesneden vormen (diepte)
  function diepte(sterk) {
    const kopie = new Uint8Array(buf), s = sterk || 1;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4; if (!kopie[i + 3]) continue;
      const boven = y > 0 ? kopie[i - 64 + 3] : kopie[i + 3], onder = y < 15 ? kopie[i + 64 + 3] : kopie[i + 3];
      const c = [kopie[i], kopie[i + 1], kopie[i + 2]];
      if (!boven) zet(x, y, maal(c, 1 + 0.18 * s)); else if (!onder) zet(x, y, maal(c, 1 - 0.22 * s));
    }
  }

  // ---------------- paletten (donker naar licht, donker iets koeler)
  const PAL = {
    aarde: P('#3f2a22', '#553828', '#6c4930', '#835b3b', '#9a6f48'),
    steen: P('#565b6a', '#686d7b', '#7b7f8b', '#8f939d', '#a7aab2'),
    lei: P('#262c3a', '#303747', '#3b4355', '#475063', '#566073'),
    zand: P('#c5a066', '#d4b277', '#e0c38a', '#ebd39f', '#f5e3b8'),
    sneeuw: P('#c4d2e8', '#d6e1f1', '#e6eef8', '#f3f7fd', '#ffffff'),
    grijs: P('#8a8a8a', '#a0a0a0', '#b6b6b6', '#cacaca', '#dedede', '#efefef'),
    kalksteen: P('#aeaa9c', '#c1bcae', '#d2cdc0', '#e1ddd2', '#eeebe3'),
    modder: P('#2e221e', '#3c2d26', '#4c3a30', '#5c4a3c', '#6e5b4a'),
    hout: P('#5a3820', '#7a4e2d', '#9a6a3a', '#b8864e', '#d4a46a'),
    ijzer: P('#3a3e46', '#5c626c', '#8a9099', '#b8bdc4', '#e2e5e8'),
    koper: P('#6e2e16', '#a04a22', '#c96a32', '#e68e4e', '#ffbb80'),
    goud: P('#7a5410', '#b8860b', '#e0aa20', '#f6cf4a', '#fff0a8'),
    robijn: P('#5a0614', '#8e0c22', '#c8183a', '#ec4a62', '#ffb4c2'),
  };
  const HOUTSOORT = {
    eik: { schors: P('#33221a', '#46301f', '#5b3f28', '#705034', '#846140'), ring: P('#8f6237', '#a8784a', '#c08f5c', '#d4a874'), plank: P('#7c5230', '#9a6a3c', '#b6834c', '#cd9c60', '#e0b478') },
    berk: { schors: P('#c9c3b4', '#d9d4c7', '#e7e3d8', '#f3f0e8', '#fbfaf5'), ring: P('#c9b58c', '#d9c9a3', '#e8dbb9', '#f2e8cc'), plank: P('#b9a47c', '#cfbb92', '#e0cea6', '#ecdeba', '#f6ead0') },
    spar: { schors: P('#2c1612', '#3f1f18', '#552a1f', '#6a3726', '#7c4430'), ring: P('#92573a', '#a86a44', '#bd8058', '#cf966c'), plank: P('#5e321e', '#7a4428', '#965634', '#ad6a42', '#c27e54') },
    esdoorn: { schors: P('#4a433c', '#5e554c', '#72685d', '#877c6f', '#9a8f80'), ring: P('#b08870', '#c49a7a', '#d6ae8e', '#e5c2a3'), plank: P('#8a5a48', '#a66e58', '#bf846a', '#d39a7e', '#e4b096') },
    baobab: { schors: P('#6e6152', '#837462', '#988874', '#ab9b85', '#bdae96'), ring: P('#a8957a', '#b9a78c', '#cbb99e', '#dccbb1'), plank: P('#8e8270', '#a49784', '#b8ab96', '#cabea8', '#dad0bc') },
    wilg: { schors: P('#3d3f38', '#4f5148', '#62645a', '#76786c', '#8a8c7f'), ring: P('#aeae88', '#bfbf98', '#d0cfa9', '#dfdebb'), plank: P('#7f8262', '#959874', '#aaad88', '#bdbf9a', '#cdd0ac') },
  };
  const TEK = {};

  // ---------------- grond
  function aarde(s) {
    kaart(PAL.aarde, veld(s, 4, 3), 1.1);
    const r = rng(s + 5);
    for (let i = 0; i < 5; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16), k = r() < 0.5 ? '#a99b88' : '#8a7c6c'; zet(x, y, k); if (r() < 0.6) zet(x + 1, y, maal(k, 0.8)); }
    for (let i = 0; i < 7; i++) zet(Math.floor(r() * 16), Math.floor(r() * 16), '#38241c');
  }
  TEK.aarde = () => aarde(1);
  TEK.gras_zij = () => aarde(1);
  TEK.gras_top = () => {
    kaart(PAL.grijs, veld(2, 4, 2), 1, (x, y, t) => t * 0.6 + 0.2);
    const r = rng(9);
    for (let i = 0; i < 34; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16), l = r() < 0.5; zet(x, y, l ? '#f2f2f2' : '#8c8c8c'); zet(x + (r() < 0.5 ? 1 : 0), y - 1, l ? '#dcdcdc' : '#a2a2a2'); }
  };
  function grasRand(kleuren, s, diep) {
    const r = rng(s);
    for (let x = 0; x < 16; x++) {
      const d = (diep || 2) + Math.floor(r() * 2) + (r() < 0.25 ? 2 + Math.floor(r() * 2) : 0);
      for (let y = 0; y < d; y++) zet(x, y, kies(kleuren, y === d - 1 ? 0.15 : 0.35 + r() * 0.65, x, y));
    }
  }
  TEK.gras_zij_over = () => { leeg(); grasRand(PAL.grijs, 3, 2); };
  TEK.sneeuwgras_zij = () => { aarde(1); grasRand(PAL.sneeuw, 4, 3); };
  TEK.bosgrond_top = () => {
    kaart(P('#4a2a1a', '#5e3620', '#744528', '#8a5632'), veld(6, 4, 2), 1);
    const r = rng(6);
    for (let i = 0; i < 26; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16), a = r() < 0.5 ? 1 : -1, k = ['#b06a34', '#c88040', '#7a4424', '#d89a52'][Math.floor(r() * 4)]; lijn(x, y, x + a * 2, y + 1, k, 255, true); }
  };
  TEK.bosgrond_zij = () => { aarde(1); const r = rng(7); for (let x = 0; x < 16; x++) { const d = 2 + Math.floor(r() * 3); for (let y = 0; y < d; y++) zet(x, y, ['#8a5632', '#b06a34', '#744528', '#c88040'][Math.floor(r() * 4)]); } };
  TEK.steen = () => {
    kaart(PAL.steen, veld(11, 4, 3, 2), 1);
    const r = rng(12);
    for (let i = 0; i < 3; i++) { let x = Math.floor(r() * 16), y = Math.floor(r() * 16); for (let k = 0; k < 4; k++) { zet(x, y, '#4c5060'); x += r() < 0.6 ? 1 : 0; y += r() < 0.5 ? 1 : -1; } }
    for (let i = 0; i < 6; i++) zet(Math.floor(r() * 16), Math.floor(r() * 16), '#b6b9c0');
  };
  function keien(pal, s, n, voeg) {
    const C = cellen(s, n), r = rng(s + 1), tint = []; for (let i = 0; i < n; i++) tint.push(0.25 + r() * 0.6);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = y * 16 + x;
      if (C.rand[k] < 0.9) { zet(x, y, voeg); continue; }
      let t = tint[C.id[k]] - (C.ox[k] + C.oy[k]) * 0.06 - C.d1[k] * 0.03;
      zet(x, y, kies(pal, Math.max(0, Math.min(1, t)), x, y, 0.7));
    }
  }
  TEK.kei = () => keien(P('#5e5a58', '#77726c', '#8e8880', '#a59e94', '#bdb6aa'), 21, 8, '#3e3a3a');
  TEK.mostkei = () => {
    keien(P('#5e5a58', '#77726c', '#8e8880', '#a59e94', '#bdb6aa'), 21, 8, '#3a3a2e');
    const v = veld(23, 2, 2), m = P('#3e5a24', '#567a30', '#6e943c', '#8cae4c');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const t = v[y * 16 + x]; if (t > 0.55) zet(x, y, kies(m, (t - 0.55) / 0.45, x, y)); }
  };
  TEK.bodemsteen = () => keien(P('#1e1e26', '#2c2c36', '#3a3a46', '#4c4c58'), 31, 9, '#0c0c10');
  TEK.zand = () => {
    kaart(PAL.zand, veld(41, 8, 2), 0.8, (x, y, t) => t * 0.7 + 0.15 + 0.12 * Math.sin((x + y * 0.5) * 0.8));
    const r = rng(42); for (let i = 0; i < 8; i++) zet(Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? '#b08a56' : '#fff4d8');
  };
  TEK.grind = () => keien(P('#5e5650', '#7a716a', '#958c82', '#b0a89c', '#c9c0b2'), 51, 15, '#3a3430');
  TEK.klei = () => kaart(P('#7a879c', '#8a97ab', '#9ba8bb', '#adb9c9', '#bfc9d6'), veld(61, 2, 3, 6), 0.9);
  TEK.zandsteen = () => {
    const v = veld(71, 4, 2);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const laag = [0.55, 0.7, 0.45, 0.85][Math.floor(y / 4)], t = laag + (v[y * 16 + x] - 0.5) * 0.4 - ((y % 4) === 3 ? 0.35 : 0);
      zet(x, y, kies(PAL.zand, Math.max(0, Math.min(1, t)), x, y, 0.6));
    }
  };
  TEK.zandsteen_top = () => { kaart(PAL.zand, veld(72, 2, 2), 0.6, (x, y, t) => 0.35 + t * 0.4); for (let i = 0; i < 16; i++) { zet(i, 0, PAL.zand[1]); zet(0, i, PAL.zand[1]); } };
  TEK.sneeuw = () => { kaart(PAL.sneeuw, veld(81, 4, 2), 0.8, (x, y, t) => 0.3 + t * 0.6); const r = rng(82); for (let i = 0; i < 6; i++) zet(Math.floor(r() * 16), Math.floor(r() * 16), '#ffffff'); for (let i = 0; i < 4; i++) zet(Math.floor(r() * 16), Math.floor(r() * 16), '#aebfdc'); };
  TEK.ijs = () => {
    const v = veld(91, 2, 2), pal = P('#8fc4ea', '#a6d4f2', '#bfe2f8', '#d8eefc');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, kies(pal, v[y * 16 + x], x, y), 196);
    const r = rng(92);
    for (let i = 0; i < 3; i++) { let x = Math.floor(r() * 16), y = Math.floor(r() * 16); for (let k = 0; k < 6; k++) { zet(x, y, '#ffffff', 232); x += r() < 0.5 ? 1 : -1; y += r() < 0.7 ? 1 : 0; } }
    for (let i = 0; i < 4; i++) zet(Math.floor(r() * 16), Math.floor(r() * 16), '#6ea8d8', 216);
  };
  TEK.modder = () => {
    kaart(PAL.modder, veld(101, 4, 3), 1);
    const r = rng(102); for (let i = 0; i < 5; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); zet(x, y, '#8a7a66'); zet(x + 1, y, '#6e5e4e'); }
  };
  TEK.leisteen = () => {
    const v = veld(111, 4, 2, 1);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const band = Math.floor((y + Math.round(Math.sin(x * 0.4) * 1)) / 3) % 3, t = 0.3 + band * 0.22 + (v[y * 16 + x] - 0.5) * 0.35;
      zet(x, y, kies(PAL.lei, Math.max(0, Math.min(1, t)), x, y, 0.6));
    }
    const r = rng(112); for (let i = 0; i < 4; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); lijn(x, y, x + 3, y, '#1e2330', 255, true); }
  };
  TEK.kalksteen = () => {
    const v = veld(121, 4, 2);
    // dunne, bijna vlakke laagjes, zoals in een steengroeve
    kaart(PAL.kalksteen, v, 0.8, (x, y, t) => 0.3 + t * 0.5 + (Math.floor((y + Math.round(Math.sin(x * 0.35) * 0.8)) / 4) % 2 ? 0.08 : -0.06));
    const r = rng(122); for (let i = 0; i < 8; i++) zet(Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.6 ? '#f7f5ef' : '#9c978a');
    // twee kleine schelpjes
    for (const [x, y] of [[10, 4], [11, 4], [12, 5], [11, 6], [10, 5]]) zet(x, y, '#9a9384');
    zet(11, 5, '#e9e5da');
    for (const [x, y] of [[3, 11], [4, 11], [4, 12], [3, 12]]) zet(x, y, '#a39d8f');
  };
  TEK.water = () => { const pal = P('#24589e', '#2f6fbe', '#3d8fd6', '#6db4ec', '#b8e2ff'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, kies(pal, 0.5 + 0.35 * Math.sin((x * 0.8 + y * 0.4) * 0.9) * Math.cos(y * 0.7), x, y)); };

  // ---------------- ertsen
  function ertsKolen() { const r = rng(131); for (let i = 0; i < 5; i++) { const x = 1 + Math.floor(r() * 13), y = 1 + Math.floor(r() * 13); const vorm = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2]].slice(0, 3 + Math.floor(r() * 4)); for (const [a, b] of vorm) zet(x + a, y + b, '#1d1c24'); zet(x, y, '#3c3a48'); zet(x + 1, y, '#6c6a7c'); } }
  function ertsKoper() {
    const r = rng(141);
    for (let a = 0; a < 2; a++) { let x = r() * 16, y = r() * 16, dx = r() - 0.5, dy = r() - 0.5; for (let k = 0; k < 10; k++) { zet(Math.floor(x), Math.floor(y), k % 3 ? '#c96a32' : '#e68e4e'); zet(Math.floor(x) + 1, Math.floor(y) + 1, '#9a4420'); if (k % 4 === 1) zet(Math.floor(x) + 1, Math.floor(y), '#ffb070'); if (k % 5 === 2) zet(Math.floor(x), Math.floor(y) - 1, '#5abf9a'); x += dx * 1.6 + (r() - 0.5); y += dy * 1.6 + (r() - 0.5); } }
  }
  function ertsIJzer() {
    const r = rng(151), pal = P('#6e4230', '#a8724e', '#cf9f78', '#ecc8a2');
    for (let i = 0; i < 4; i++) { const cx = 1.5 + r() * 13, cy = 1.5 + r() * 13, rx = 1.2 + r(), ry = 0.9 + r() * 0.8; for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) { const d = (x * x) / (rx * rx) + (y * y) / (ry * ry); if (d < 1) zet(Math.floor(cx + x), Math.floor(cy + y), pal[d < 0.2 ? 3 : (x + y < 0 ? 2 : 1)]); else if (d < 1.5 && r() < 0.5) zet(Math.floor(cx + x), Math.floor(cy + y), pal[0]); } }
  }
  function ertsGoud() { const r = rng(161); for (let i = 0; i < 12; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); zet(x, y, PAL.goud[2 + Math.floor(r() * 2)]); if (r() < 0.5) zet(x + 1, y + 1, PAL.goud[1]); } for (const [x, y] of [[4, 4], [11, 10]]) { zet(x, y, '#ffffff'); zet(x - 1, y, '#fff0a8'); zet(x + 1, y, '#fff0a8'); zet(x, y - 1, '#fff0a8'); zet(x, y + 1, '#fff0a8'); } }
  function ertsRobijn() {
    // staande kristallen met een punt, links licht en rechts donker
    const kr = (x, y, lang) => {
      const v = ['.h.', 'hmd'].concat(Array(lang).fill('hmd')).concat(['#md', '.#.']); const k = { '#': '#5a0614', h: '#ff8a9a', m: '#e8304a', d: '#a8142c' };
      for (let b = 0; b < v.length; b++) for (let a = 0; a < 3; a++) { const c = v[b][a]; if (c !== '.') zet(x + a, y + b, k[c]); }
      zet(x, y + 2, '#ffe0e6');
    };
    kr(2, 3, 3); kr(5, 6, 2); kr(10, 1, 4); kr(9, 10, 1); zet(14, 12, '#c8183a'); zet(1, 13, '#c8183a');
  }
  TEK.erts_kolen = () => { TEK.steen(); ertsKolen(); };
  TEK.erts_koper = () => { TEK.steen(); ertsKoper(); };
  TEK.erts_ijzer = () => { TEK.steen(); ertsIJzer(); };
  TEK.erts_goud = () => { TEK.steen(); ertsGoud(); };
  TEK.erts_ijzer_lei = () => { TEK.leisteen(); ertsIJzer(); };
  TEK.erts_goud_lei = () => { TEK.leisteen(); ertsGoud(); };
  TEK.erts_robijn = () => { TEK.leisteen(); ertsRobijn(); };

  // ---------------- hout
  function schors(soort) {
    const S = HOUTSOORT[soort].schors;
    if (soort === 'berk') {
      kaart(S, veld(171, 2, 2, 8), 0.7, (x, y, t) => 0.45 + t * 0.55);
      const r = rng(172); for (let i = 0; i < 9; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16), l = 2 + Math.floor(r() * 4); lijn(x, y, x + l, y, '#2b2622', 255, true); if (r() < 0.6) zet(x + 1, y + 1, '#6a625a'); }
      return;
    }
    const v = veld(soort.length * 13 + 3, 8, 2, 1);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let t = v[y * 16 + x];
      if (soort === 'eik') t = t * 0.6 + 0.4 * (Math.sin(x * 1.7 + Math.sin(y * 0.6) * 1.2) * 0.5 + 0.5);
      if (soort === 'spar') t = t * 0.5 + (((Math.floor(y / 3) + Math.floor((x + (Math.floor(y / 3) % 2) * 2) / 4)) % 2) ? 0.45 : 0.15) + ((y % 3) === 0 ? -0.15 : 0);
      if (soort === 'esdoorn') t = 0.4 + t * 0.35 + (x % 5 === 0 ? -0.2 : 0);
      if (soort === 'baobab') t = 0.25 + 0.55 * (Math.sin(x * 0.9 + Math.sin(y * 0.4) * 0.8) * 0.5 + 0.5) + (t - 0.5) * 0.3;
      if (soort === 'wilg') { const d = Math.abs(((x + y * 0.5) % 6) - 3) + Math.abs(((x - y * 0.5 + 60) % 6) - 3); t = t * 0.4 + (d < 1.6 ? 0.05 : 0.55); }
      zet(x, y, kies(S, Math.max(0, Math.min(1, t)), x, y, 0.8));
    }
  }
  function ring(soort) {
    const R = HOUTSOORT[soort].ring, S = HOUTSOORT[soort].schors, v = veld(181, 4, 1);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) * 0.55 + Math.hypot(x - 7.5, y - 7.5) * 0.45 + (v[y * 16 + x] - 0.5) * 0.8;
      if (x === 0 || y === 0 || x === 15 || y === 15) { zet(x, y, S[1 + ((x + y) % 2)]); continue; }
      if (x === 1 || y === 1 || x === 14 || y === 14) { zet(x, y, R[3]); continue; }
      const k = Math.floor(d) % 2 ? 1 : 2;
      zet(x, y, R[d < 1.2 ? 0 : k]);
    }
  }
  function planken(soort) {
    const Pk = HOUTSOORT[soort].plank, v = veld(soort.length * 7 + 191, 4, 2, 16);
    const randen = [0, 5, 11], naad = [6, 12, 3];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const p = y < 5 ? 0 : y < 11 ? 1 : 2, top = y === randen[p], onder = y === (p === 2 ? 15 : randen[p + 1] - 1);
      let t = 0.35 + v[y * 16 + x] * 0.4 + p * 0.06 + 0.1 * Math.sin((x + p * 5) * 0.7 + y * 2.3);
      if (top) t += 0.3; if (onder) t = 0.05;
      if (x === naad[p]) t = 0.0; if (x === naad[p] + 1) t += 0.15;
      zet(x, y, kies(Pk, Math.max(0, Math.min(1, t)), x, y, 0.7));
    }
    // een knoest in de middelste plank
    const kx = (soort.length * 5) % 9 + 3; zet(kx, 7, Pk[0]); zet(kx + 1, 7, Pk[1]); zet(kx, 8, Pk[1]); zet(kx + 1, 8, Pk[0]); zet(kx - 1, 8, Pk[2]); zet(kx + 2, 7, Pk[2]);
  }
  for (const s of Object.keys(HOUTSOORT)) { TEK['stam_' + s] = () => schors(s); TEK['stam_' + s + '_ring'] = () => ring(s); TEK['planken_' + s] = () => planken(s); }

  // ---------------- bladeren
  function bladeren(pal, seed, vorm, dekking) {
    leeg(); const r = rng(seed); let n = 0;
    for (let k = 0; k < 200 && n < 256 * dekking; k++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16), t = r();
      vorm(x, y, t, r);
      n = 0; for (let i = 3; i < 1024; i += 4) if (buf[i]) n++;
    }
    diepte(1);
  }
  const GRIJS_BLAD = P('#7c7c7c', '#959595', '#adadad', '#c4c4c4', '#dadada', '#eeeeee');
  const bladVorm = {
    eik: (pal) => (x, y, t, r) => { const c = kies(pal, t, x, y, 0); const v = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]; for (const [a, b] of v) if (r() < 0.85) zet(x + a, y + b, c); zet(x, y, maal(c, 0.88)); },
    berk: (pal) => (x, y, t, r) => { const c = kies(pal, t, x, y, 0); zet(x, y, c); zet(x + 1, y, c); zet(x, y + 1, maal(c, 0.9)); if (r() < 0.5) zet(x + 1, y + 1, maal(c, 0.85)); },
    spar: (pal) => (x, y, t, r) => { const c = kies(pal, t, x, y, 0), d = r() < 0.5 ? 1 : -1; zet(x, y, c); zet(x + d, y + 1, maal(c, 0.9)); zet(x + 2 * d, y + 2, maal(c, 0.8)); zet(x - d, y + 1, maal(c, 0.95)); },
    baobab: (pal) => (x, y, t, r) => { const c = kies(pal, t, x, y, 0); for (let b = -1; b <= 1; b++) for (let a = -2; a <= 2; a++) if (a * a / 4 + b * b < 1.2) zet(x + a, y + b, a + b < 0 ? maal(c, 1.06) : c); zet(x, y, maal(c, 0.85)); },
    wilg: (pal) => (x, y, t, r) => { const c = kies(pal, t, x, y, 0); for (let b = 0; b < 4; b++) zet(x, y + b, maal(c, 1 - b * 0.05)); if (r() < 0.5) zet(x + 1, y + 1, maal(c, 0.9)); },
    esdoorn: (pal) => (x, y, t, r) => { const c = kies(pal, t, x, y, 0); for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1], [0, -2], [2, 0], [-2, 0]]) if (Math.abs(a) + Math.abs(b) < 2 || r() < 0.55) zet(x + a, y + b, c); zet(x, y, maal(c, 0.82)); },
  };
  TEK.blad_eik = () => bladeren(GRIJS_BLAD, 201, bladVorm.eik(GRIJS_BLAD), 0.82);
  const LICHT_BLAD = P('#9a9a9a', '#b0b0b0', '#c4c4c4', '#d6d6d6', '#e6e6e6', '#f6f6f6');
  TEK.blad_berk = () => bladeren(LICHT_BLAD, 202, bladVorm.berk(LICHT_BLAD), 0.76);
  TEK.blad_spar = () => bladeren(P('#8e8e8e', '#a6a6a6', '#bcbcbc', '#d0d0d0', '#e2e2e2'), 203, bladVorm.spar(P('#8e8e8e', '#a6a6a6', '#bcbcbc', '#d0d0d0', '#e2e2e2')), 0.86);
  TEK.blad_baobab = () => bladeren(GRIJS_BLAD, 204, bladVorm.baobab(GRIJS_BLAD), 0.8);
  TEK.blad_wilg = () => bladeren(LICHT_BLAD, 205, bladVorm.wilg(LICHT_BLAD), 0.74);
  const HERFST = { rood: P('#6e1214', '#9a1c1c', '#c02e28', '#e04a34', '#f87448'), oranje: P('#8a3a12', '#b85618', '#e07a24', '#f6a03a', '#ffc46a'), geel: P('#8a6410', '#b88a16', '#e0b22a', '#f4d04c', '#fff08a') };
  TEK.blad_esdoorn = () => bladeren(HERFST.rood, 206, bladVorm.esdoorn(HERFST.rood), 0.8);
  TEK.blad_esdoorn_oranje = () => bladeren(HERFST.oranje, 207, bladVorm.esdoorn(HERFST.oranje), 0.8);
  TEK.blad_esdoorn_geel = () => bladeren(HERFST.geel, 208, bladVorm.esdoorn(HERFST.geel), 0.8);

  // ---------------- planten (staan op de onderste rij, alfa 0 eromheen)
  const STEEL = P('#2c5a22', '#3d7a2e', '#5a9a3a', '#7cb84c');
  function steel(x, y0, y1, c) { for (let y = y0; y <= y1; y++) zn(x, y, c || STEEL[1]); }
  function grassen(pal, seed, n) {
    leeg(); const r = rng(seed);
    for (let i = 0; i < n; i++) {
      let x = 1 + Math.floor(r() * 14); const h = 6 + Math.floor(r() * 8), kant = r() < 0.5 ? -1 : 1, c = kies(pal, 0.2 + r() * 0.8, i, 0, 0);
      for (let k = 0; k < h; k++) { const y = 15 - k; if (k > h * 0.6 && r() < 0.5) x += kant; zn(x, y, k > h - 3 ? maal(c, 1.08) : k < 2 ? maal(c, 0.85) : c); }
    }
  }
  TEK.hooggras = () => grassen(GRIJS_BLAD, 211, 9);
  TEK.varen = () => {
    leeg(); const pal = GRIJS_BLAD;
    for (const [bx, top, kant] of [[5, 3, -1], [10, 2, 1], [8, 5, 1]]) {
      for (let y = top; y <= 15; y++) { const x = bx + Math.round((15 - y) * 0.12 * kant); zn(x, y, pal[2]); if (y < 14 && (y % 2 === 0)) { const l = Math.min(4, Math.floor((y - top) * 0.5) + 1); for (let a = 1; a <= l; a++) { zn(x - a, y + (a > 2 ? 1 : 0), pal[3 + (a % 2)]); zn(x + a, y + (a > 2 ? 1 : 0), pal[3]); } } }
    }
  };
  TEK.dorre_struik = () => {
    leeg(); const k = P('#5a3a22', '#7a5230', '#9a6c42');
    lijn(8, 15, 8, 9, k[1]); lijn(8, 11, 4, 6, k[1]); lijn(8, 10, 12, 5, k[2]); lijn(6, 8, 6, 4, k[0]); lijn(10, 7, 13, 7, k[0]); lijn(4, 6, 2, 5, k[2]); lijn(12, 5, 12, 2, k[1]); lijn(8, 9, 9, 3, k[2]);
  };
  function tulp(kleur) {
    leeg();
    steel(8, 6, 15); steel(7, 12, 15, STEEL[0]);
    for (const [x, y] of [[5, 15], [5, 14], [6, 13], [6, 12], [6, 11], [7, 10], [10, 15], [10, 14], [10, 13], [11, 12], [11, 11]]) zn(x, y, y < 12 ? STEEL[3] : STEEL[2]);
    const b = ['.#.#.', '##m##', '#hmm#', '#hmd#', '.mmd.', '..d..'], k = { '#': kleur[1], m: kleur[2], h: kleur[3], d: kleur[0] };
    for (let y = 0; y < 6; y++) for (let x = 0; x < 5; x++) { const c = b[y][x]; if (c !== '.') zn(6 + x, 1 + y, k[c]); }
  }
  TEK.tulp_rood = () => tulp(P('#7a0e1c', '#c81e32', '#e8404e', '#ff8a8a'));
  TEK.tulp_geel = () => tulp(P('#a8780a', '#e8b820', '#f8d84a', '#fff4a8'));
  TEK.tulp_oranje = () => tulp(P('#a8400e', '#ec7020', '#ff9a40', '#ffd09a'));
  TEK.tulp_roze = () => tulp(P('#a83e6e', '#e070a0', '#ff9ac0', '#ffd6e6'));
  TEK.paardenbloem = () => {
    leeg(); steel(8, 6, 15, STEEL[2]);
    for (const [x, y] of [[5, 15], [4, 14], [6, 14], [5, 13], [11, 15], [12, 14], [10, 14], [11, 13]]) zn(x, y, STEEL[1]);
    const g = P('#c88a10', '#f2c230', '#ffe060', '#fff4b0');
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) zn(8 + x, 4 + y, g[x * x + y * y < 2 ? 3 : (x + y > 0 ? 0 : 2)]);
    zn(8, 4, g[1]);
  };
  TEK.korenbloem = () => {
    leeg(); steel(8, 6, 15, STEEL[1]); zn(7, 11, STEEL[2]); zn(6, 10, STEEL[2]); zn(9, 12, STEEL[2]); zn(10, 11, STEEL[2]);
    const b = P('#1e3c96', '#3a62d8', '#6a92ff', '#b8ccff');
    for (const [x, y, k] of [[8, 1, 2], [6, 2, 1], [10, 2, 1], [7, 2, 3], [9, 2, 2], [5, 3, 0], [11, 3, 0], [6, 3, 2], [7, 3, 1], [8, 3, 1], [9, 3, 2], [10, 3, 2], [7, 4, 0], [8, 4, 0], [9, 4, 0], [8, 5, 0]]) zn(x, y, b[k]);
    zn(8, 2, '#2a1e5a');
  };
  TEK.heide = () => {
    leeg(); const t = P('#4a3a2a', '#6a5a3a', '#5a6a3a'), b = P('#6a2a7a', '#9a4aac', '#c878d8', '#e8b0f0'), r = rng(231);
    for (const [x0, top] of [[4, 6], [8, 4], [12, 7], [6, 9], [10, 8]]) { lijn(x0, 15, x0 + (r() < 0.5 ? -1 : 1), top, t[Math.floor(r() * 3)]); for (let y = top; y < top + 5; y++) if (r() < 0.8) { zn(x0 + (y % 2 ? 1 : -1), y, b[Math.floor(r() * 4)]); if (r() < 0.5) zn(x0, y - 1, b[2]); } }
  };
  TEK.vlas = () => {
    leeg(); const b = P('#5a86d0', '#8ab0f0', '#c4dcff');
    for (const [x, top] of [[4, 4], [7, 2], [10, 5], [12, 3]]) { lijn(x, 15, x + (x % 2 ? 1 : 0), top + 1, STEEL[2]); const bx = x + (x % 2 ? 1 : 0); zn(bx, top, b[1]); zn(bx - 1, top, b[0]); zn(bx + 1, top, b[0]); zn(bx, top - 1, b[0]); zn(bx, top + 1, b[0]); zn(bx, top, b[2]); }
    zn(5, 12, STEEL[3]); zn(9, 10, STEEL[3]); zn(11, 12, STEEL[3]);
  };
  function paddenstoel(hoed, stip) {
    leeg(); const steelK = P('#c8bca0', '#e2d8c0', '#f4eedc');
    blok(7, 9, 9, 15, steelK[1]); for (let y = 9; y <= 15; y++) { zn(7, y, steelK[0]); zn(9, y, steelK[2]); }
    for (let y = 0; y < 5; y++) { const hw = [2, 4, 5, 6, 6][y]; for (let x = -hw; x <= hw; x++) zn(8 + x, 4 + y, kies(hoed, y === 0 ? 0.9 : 1 - (y / 5) * 0.8 - (x > 2 ? 0.2 : 0), x, y, 0.5)); }
    for (let x = -5; x <= 5; x++) zn(8 + x, 9, hoed[0]);
    if (stip) for (const [x, y] of [[6, 5], [10, 6], [8, 4], [12, 7], [4, 7]]) zn(x, y, '#fff6ea');
  }
  TEK.paddenstoel_bruin = () => paddenstoel(P('#4a2c18', '#6e4428', '#8e5c36', '#ae7a4c', '#c8966a'));
  TEK.paddenstoel_rood = () => paddenstoel(P('#6e0a14', '#a01424', '#d0283a', '#f05a62'), true);
  TEK.riet = () => {
    leeg(); const g = P('#5a6a2a', '#7a8a3a', '#9aa84a', '#bcc46a'), p = P('#3e2414', '#5a3a20', '#7a5030');
    for (const [x, top] of [[4, 2], [8, 0], [12, 3]]) { steel(x, top + 4, 15, g[1]); blok(x, top, x, top + 3, p[1]); zn(x - 1, top + 1, p[0]); zn(x + 1, top + 2, p[2]); zn(x, top - 1 < 0 ? 0 : top - 1, g[2]); }
    for (const [x, y, k] of [[5, 9, 2], [6, 7, 3], [9, 10, 2], [10, 8, 3], [11, 11, 2], [3, 11, 3], [2, 9, 2]]) zn(x, y, g[k]);
  };
  TEK.waterlelie = () => {
    leeg(); const g = P('#24561e', '#2e6a2a', '#3e8a36', '#5aaa48', '#82c464');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      if (d > 7.2 || (a > -0.35 && a < 0.1 && d > 1.5)) continue;
      const ader = Math.abs(Math.sin(a * 4)) < 0.15 && d > 2;
      zet(x, y, ader ? g[4] : kies(g, 0.25 + (d / 7) * 0.5 - (dx + dy) * 0.02, x, y, 0.6));
    }
    const b = P('#d0608a', '#f08ab0', '#ffc0d8', '#ffe680');
    for (const [x, y, k] of [[5, 5, 1], [6, 4, 2], [7, 5, 1], [6, 6, 1], [5, 6, 0], [7, 6, 0], [6, 5, 3], [5, 4, 2], [7, 4, 2]]) zet(x, y, b[k]);
  };
  function struik(bes) {
    leeg(); const g = P('#24561e', '#346e2a', '#468a36', '#62a448', '#84c060'), r = rng(251);
    for (let k = 0; k < 70; k++) { const x = 2 + Math.floor(r() * 12), y = 5 + Math.floor(r() * 11); const d = Math.hypot((x - 7.5) / 6, (y - 11) / 6); if (d < 1) zet(x, y, kies(g, 1 - d * 0.7 - (y - 5) * 0.03, x, y, 0.6)); }
    zn(7, 15, '#5a3a22'); zn(8, 14, '#5a3a22');
    diepte(1);
    if (bes) for (const [x, y] of [[4, 9], [9, 7], [11, 11], [6, 12], [12, 8], [7, 10]]) { zn(x, y, '#d0203c'); zn(x + 1, y, '#8a1028'); zn(x, y - 1, '#ff7080'); }
  }
  TEK.bessenstruik = () => struik(false);
  TEK.bessenstruik_vol = () => struik(true);
  TEK.cactus = () => {
    leeg(); const g = P('#1e4e24', '#2a6a2e', '#3a8a3a', '#4ea848', '#6ac25a');
    for (let y = 0; y < 16; y++) for (let x = 1; x <= 14; x++) { const rib = (x - 1) % 4; zet(x, y, g[rib === 0 ? 0 : rib === 1 ? 3 : rib === 2 ? 2 : 1]); }
    for (let y = 1; y < 16; y += 4) for (let x = 2; x <= 14; x += 4) zet(x, y + (x % 8 ? 0 : 2), '#f0e8c0');
  };
  TEK.cactus_top = () => {
    leeg(); const g = P('#1e4e24', '#2a6a2e', '#3a8a3a', '#4ea848', '#6ac25a');
    for (let y = 1; y <= 14; y++) for (let x = 1; x <= 14; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); zet(x, y, g[d > 5.5 ? 1 : d > 3.5 ? 2 : d > 1.5 ? 3 : 4]); }
    for (const [x, y] of [[7, 7], [8, 8], [7, 8], [8, 7]]) zet(x, y, '#f0a8c0');
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13], [7, 2], [2, 8]]) zet(x, y, '#f0e8c0');
  };
  TEK.wilgentak = () => {
    leeg(); const pal = GRIJS_BLAD, r = rng(261);
    for (let x = 0; x < 16; x++) zet(x, 0, pal[2]);
    for (const x of [1, 4, 6, 9, 11, 14]) { const l = 8 + Math.floor(r() * 8); let xx = x; for (let y = 0; y < l; y++) { if (y > 3 && r() < 0.2) xx += r() < 0.5 ? -1 : 1; zn(xx, y, pal[1 + (y % 3)]); if (y % 3 === 1) zn(xx + 1, y, pal[4]); } }
  };
  function druipsteen(omlaag) {
    leeg(); const k = P('#6e6050', '#8a7a68', '#a6957f', '#c2b098', '#dccab0');
    for (const [cx, breed, lang] of [[8, 4, 15], [4, 2, 8], [12, 2, 10]]) for (let i = 0; i < lang; i++) {
      const hw = Math.max(0, Math.round(breed * (1 - i / lang))); for (let x = -hw; x <= hw; x++) { const y = omlaag ? i : 15 - i; zn(cx + x, y, k[x < 0 ? 3 : x > 0 ? 1 : 2]); }
      zn(cx, omlaag ? i : 15 - i, k[i % 4 === 0 ? 4 : 2]);
    }
  }
  TEK.druipsteen_hang = () => druipsteen(true);
  TEK.druipsteen_staand = () => druipsteen(false);
  TEK.gloeizwam = () => {
    leeg(); const hoed = P('#14a89a', '#2ad0c0', '#7affea', '#e0fff8'), st = P('#5ab8a8', '#9ae8d8', '#d0fff4');
    for (const [cx, top, hw, h] of [[5, 6, 3, 9], [11, 3, 3, 12], [8, 10, 2, 5]]) {
      for (let y = top + 2; y < top + h && y < 16; y++) { zn(cx, y, st[1]); zn(cx + 1, y, st[0]); }
      for (let y = 0; y < 3; y++) { const b = hw - (y === 0 ? 1 : 0); for (let x = -b; x <= b; x++) zn(cx + x, top + y, hoed[y === 0 ? 3 : (x < 0 ? 2 : 1)]); }
      for (let x = -hw; x <= hw; x++) zn(cx + x, top + 2, hoed[0]);
    }
  };
  function stekje(soort) {
    leeg();
    const blad = { eik: P('#2e6a26', '#3e8a32', '#5aaa44'), berk: P('#4e8a34', '#6aaa42', '#8cc85a'), spar: P('#1a4a2a', '#265e36', '#367844'), esdoorn: P('#8e1a1a', '#c02e28', '#f06a3a'), baobab: P('#5a6a2a', '#7a8a3a', '#9aa84a'), wilg: P('#4e6a4a', '#6a8a62', '#8aa880') }[soort];
    const stam = soort === 'berk' ? '#e8e4da' : soort === 'spar' ? '#552a1f' : '#6a4426';
    for (let y = 9; y <= 15; y++) zn(8, y, stam); if (soort === 'baobab') for (let y = 11; y <= 15; y++) zn(7, y, stam);
    if (soort === 'spar') { for (let y = 3; y <= 12; y++) { const hw = Math.floor((y - 3) / 2.5); for (let x = -hw; x <= hw; x++) zn(8 + x, y, blad[(y + x) % 2 ? 1 : (x < 0 ? 2 : 0)]); } return; }
    if (soort === 'wilg') { for (let x = 4; x <= 12; x++) for (let y = 4; y <= 6 + ((x * 7) % 4); y++) zn(x, y, blad[(x + y) % 3]); return; }
    for (let y = 2; y <= 9; y++) for (let x = 4; x <= 12; x++) { const d = Math.hypot((x - 8) / 4, (y - 5.5) / 3.6); if (d < 1 && !((x * 3 + y * 5) % 11 === 0)) zn(x, y, blad[d < 0.4 ? 2 : (x + y) % 2 ? 1 : 0]); }
  }
  for (const s of Object.keys(HOUTSOORT)) TEK['stekje_' + s] = () => stekje(s);

  // ---------------- bouwblokken
  TEK.glas = () => {
    leeg(); const r1 = '#e4f3f8', r2 = '#b8d8e4';
    for (let i = 0; i < 16; i++) { zet(i, 0, r1); zet(0, i, r1); zet(i, 15, r2); zet(15, i, r2); }
    for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]]) zet(x, y, '#ffffff');
    lijn(3, 7, 7, 3, '#ffffff'); lijn(4, 8, 8, 4, '#f2fbff'); lijn(10, 12, 12, 10, '#ffffff');
  };
  TEK.baksteen = () => {
    const pal = P('#6e2a1c', '#8e3624', '#a8462e', '#bf5c3c', '#d2744e'), r = rng(301), voeg = P('#b8ae9e', '#cfc6b6', '#ddd6c8');
    const toon = {};
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const rij = Math.floor(y / 4), ox = (rij % 2) * 4, bx = Math.floor(w(x + ox) / 8), key = rij * 4 + bx;
      if (y % 4 === 3 || w(x + ox) % 8 === 7) { zet(x, y, voeg[(x + y) % 3 === 0 ? 0 : 1]); continue; }
      if (!(key in toon)) toon[key] = 0.3 + r() * 0.5;
      zet(x, y, kies(pal, toon[key] + (y % 4 === 0 ? 0.15 : 0) - (y % 4 === 2 ? 0.12 : 0) + (hs(x, y, 9) - 0.5) * 0.2, x, y, 0.6));
    }
  };
  // dakpannen: rijen holle pannen, elke pan licht aan de ene en donker aan de andere kant, met een schaduw onder elke rij
  TEK.dakpannen = () => {
    const pal = P('#5a1d12', '#7a2c19', '#9a3d22', '#b6512c', '#cc6a3c', '#de8a58');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const rij = Math.floor(y / 4), ly = y % 4, lx = w(x + (rij % 2) * 2) % 4;
      let t = [0.75, 0.6, 0.42, 0.22][lx] + (hs(Math.floor(w(x + (rij % 2) * 2) / 4), rij, 23) - 0.5) * 0.25;
      if (ly === 3) t = 0.05; else if (ly === 0) t += 0.12;
      zet(x, y, kies(pal, Math.max(0, Math.min(1, t)), x, y, 0.5));
    }
  };
  // klinkers in visgraatverband: steentjes van 4 bij 2, om en om liggend en staand, in een trapje (herhaalt zich naadloos per 16)
  TEK.klinkers = () => {
    const pal = P('#5c2418', '#77301f', '#8f3e29', '#a54f35', '#b9654a'), voeg = P('#7d756a', '#948b7e');
    for (let m = -3; m <= 3; m++) for (let n = -6; n <= 10; n++) {
      const ox = 2 * n + 4 * m, oy = 2 * n - 4 * m;
      for (const [bx, by, bw, bh] of [[ox, oy, 4, 2], [ox, oy + 2, 2, 4]]) {
        const toon = 0.25 + hs(w(bx), w(by), bw) * 0.55;
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          if (x === bw - 1 || y === bh - 1) { zet(bx + x, by + y, voeg[(x + y) & 1]); continue; }
          zet(bx + x, by + y, kies(pal, toon + (x === 0 || y === 0 ? 0.12 : 0) + (hs(bx + x, by + y, 17) - 0.5) * 0.16, bx + x, by + y, 0.6));
        }
      }
    }
  };
  TEK.steenstenen = () => {
    const pal = PAL.steen, v = veld(311, 4, 2);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const rij = y < 8 ? 0 : 1, naad = rij ? 4 : 10, ly = y % 8, lx = w(x - naad);
      let t = 0.45 + (v[y * 16 + x] - 0.5) * 0.35;
      if (ly === 0 || lx === 0) t = 0.95; else if (ly === 7 || lx === 15) t = 0.02; else if (ly === 1 || lx === 1) t += 0.18; else if (ly === 6 || lx === 14) t -= 0.18;
      zet(x, y, kies(pal, Math.max(0, Math.min(1, t)), x, y, 0.5));
    }
  };
  TEK.gladde_steen = () => { const pal = P('#8f939d', '#9ea2ab', '#adb1b9', '#bcc0c6', '#cbced3'); kaart(pal, veld(321, 2, 2), 0.6, (x, y, t) => (x === 0 || y === 0) ? 0.95 : (x === 15 || y === 15) ? 0.0 : 0.35 + t * 0.35); };
  TEK.leitegels = () => {
    const pal = PAL.lei;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const rij = Math.floor(y / 4), ox = (rij % 2) * 4, lx = w(x + ox) % 8, ly = y % 4;
      const rand = ly === 3 && (lx < 1 || lx > 6) || ly === 3 && false;
      const onder = Math.hypot(lx - 3.5, (ly - 0) * 1.6) > 4.2;
      let t = 0.75 - ly * 0.16 + (hs(rij, Math.floor(w(x + ox) / 8), 5) - 0.5) * 0.3;
      if (onder || rand) t = 0.05; if (lx === 0) t = 0.12;
      zet(x, y, kies(pal, Math.max(0, Math.min(1, t)), x, y, 0.5));
    }
  };
  TEK.kalksteenblokken = () => {
    const pal = PAL.kalksteen, v = veld(331, 4, 2);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const lx = x % 8, ly = w(y + (x < 8 ? 0 : 4)) % 8;
      let t = 0.5 + (v[y * 16 + x] - 0.5) * 0.35;
      if (lx === 7 || ly === 7) t = 0.02; else if (lx === 0 || ly === 0) t += 0.28;
      // fijne beitelstreepjes
      else if ((x * 3 + y * 5) % 11 === 0) t -= 0.18;
      zet(x, y, kies(pal, Math.max(0, Math.min(1, t)), x, y, 0.55));
    }
    zet(3, 3, '#f7f5ef'); zet(11, 10, '#f7f5ef'); zet(5, 12, '#9c978a');
  };
  TEK.tegel_wit = () => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const rand = x === 0 || y === 0; const t = rand ? '#c9c4b8' : meng('#f7f5ef', '#e4e0d6', (x + y) / 30); zet(x, y, t); } zet(3, 3, '#ffffff'); zet(4, 3, '#ffffff'); zet(3, 4, '#ffffff'); };
  TEK.tegel_delfts = () => {
    TEK.tegel_wit();
    const b = P('#1a3478', '#2e4fa8', '#5a7ac8', '#a8bce6');
    // hoekornamentjes (samen een bloempje waar vier tegels elkaar raken)
    for (const [x, y] of [[1, 1], [2, 1], [1, 2], [15, 1], [14, 1], [15, 2], [1, 15], [1, 14], [2, 15], [15, 15], [14, 15], [15, 14]]) zet(x, y, b[1]);
    // molentje in het midden
    blok(7, 7, 8, 13, b[1]); blok(6, 12, 9, 13, b[0]); zet(7, 6, b[0]); zet(8, 6, b[0]);
    for (let i = 0; i < 4; i++) { const ax = [1, -1, 1, -1][i], ay = [1, 1, -1, -1][i]; for (let k = 1; k <= 4; k++) zet(7 + ax * k + (ax > 0 ? 1 : 0), 6 + ay * k, k === 4 ? b[2] : b[1]); }
    lijn(3, 14, 12, 14, b[2]); zet(5, 13, b[3]); zet(11, 13, b[3]);
  };
  const LINNEN = { wit: '#EEE9DD', rood: '#C8323C', oranje: '#E8782E', geel: '#E9C13A', groen: '#4E9A4E', blauw: '#2F5BB8', paars: '#7A4E9A', roze: '#E88AB0', zwart: '#2E2A30' };
  for (const [s, c] of Object.entries(LINNEN)) TEK['linnen_' + s] = () => {
    const v = veld(341 + s.length, 4, 1);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const weef = ((x >> 1) + (y >> 1)) % 2 ? (x % 2 ? 1.08 : 0.97) : (y % 2 ? 1.02 : 0.9); zet(x, y, maal(c, weef * (0.94 + v[y * 16 + x] * 0.1) * (s === 'zwart' ? 1.25 : 1))); }
    zet(5, 9, maal(c, 0.8)); zet(6, 9, maal(c, 0.82)); zet(12, 3, maal(c, 1.12));
  };
  function metaalStaven(pal) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const ly = y % 5, rij = Math.floor(y / 5); let t = [0.95, 0.75, 0.55, 0.35, 0.05][ly] + (y === 15 ? -0.3 : 0); const lx = w(x + rij * 5) % 8; if (lx === 0) t = 0.1; if (lx === 1) t += 0.1; zet(x, y, kies(pal, Math.max(0, Math.min(1, t)), x, y, 0.4)); } }
  TEK.ijzerblok = () => metaalStaven(PAL.ijzer);
  TEK.goudblok = () => { metaalStaven(PAL.goud); zet(4, 1, '#ffffff'); zet(12, 6, '#ffffff'); zet(6, 11, '#ffffff'); };
  TEK.koperblok = () => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const lx = x % 8, ly = y % 8; let t = 0.5 + 0.25 * Math.sin((x + y) * 0.4) + (hs(x, y, 4) - 0.5) * 0.2; if (lx === 0 || ly === 0) t = 0.95; if (lx === 7 || ly === 7) t = 0.08; zet(x, y, kies(PAL.koper, t, x, y, 0.5)); }
    for (const [x, y] of [[1, 1], [6, 1], [9, 9], [14, 14], [1, 9], [14, 6]]) zet(x, y, '#ffe0b8');
    for (const [x, y] of [[3, 5], [4, 5], [12, 12], [11, 3], [5, 13]]) zet(x, y, '#5abf9a');
  };
  TEK.robijnblok = () => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const fx = w(x) % 8 - 3.5, fy = w(y) % 8 - 3.5; const v = Math.abs(fx) + Math.abs(fy); let t = v > 6 ? 0.05 : fx + fy < 0 ? 0.85 - v * 0.06 : 0.45 - v * 0.05; if (Math.abs(fx - fy) < 0.6 && v < 4) t = 0.95; zet(x, y, kies(PAL.robijn, Math.max(0, Math.min(1, t)), x, y, 0.4)); }
  };
  TEK.kolenblok = () => { keien(P('#121218', '#1c1c24', '#2a2a34', '#3c3c48', '#5a5a6a'), 351, 10, '#08080c'); zet(4, 4, '#8a8a9e'); zet(11, 10, '#8a8a9e'); zet(9, 3, '#6a6a7e'); };
  TEK.boekenkast = () => {
    const hout = HOUTSOORT.eik.plank, kleur = P('#8e2a2a', '#2e4a8a', '#3a7a3e', '#c08a2a', '#6a3a7a', '#a84a2a', '#2a6a6a');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, hout[(y === 0 || y === 8) ? 4 : (y === 7 || y === 15) ? 0 : 2]);
    for (const top of [1, 9]) { let x = 1; const r = rng(361 + top); while (x < 15) { const b = 1 + Math.floor(r() * 2), h = 4 + Math.floor(r() * 3), c = kleur[Math.floor(r() * kleur.length)]; for (let k = 0; k < b && x + k < 15; k++) for (let y = top + 6 - h; y < top + 6; y++) zet(x + k, y, maal(c, k ? 0.8 : 1)); if (h > 4) zet(x, top + 7 - h, '#f2d070'); x += b + (r() < 0.2 ? 1 : 0); } }
  };
  TEK.hooi_zij = () => {
    const st = P('#a8862e', '#c9a640', '#e0c060', '#f0d880', '#faeab0'), v = veld(371, 2, 2, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, kies(st, v[y * 16 + x] * 0.8 + 0.1 + (hs(x, y, 3) - 0.5) * 0.3, x, y, 0.8));
    for (let y = 0; y < 16; y++) for (const x of [3, 12]) { zet(x, y, y % 2 ? '#7a2e1c' : '#9a3e26'); zet(x + 1, y, '#6a2618'); }
  };
  TEK.hooi_top = () => {
    const st = P('#8a6a22', '#c9a640', '#e0c060', '#f0d880');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, st[(hs(x, y, 11) * 4) | 0]);
    for (let x = 0; x < 16; x++) for (const y of [3, 12]) zet(x, y, '#8a3420');
  };
  TEK.lichtblok = () => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      const c = d > 6.5 ? (x + y) % 2 ? '#8a6a32' : '#a8823e' : d > 5.5 ? '#ffe9a8' : meng('#fff8dc', '#ffc84a', Math.min(1, Math.hypot(x - 7.5, y - 7.5) / 6));
      zet(x, y, c);
    }
    for (let i = 3; i < 13; i++) { zet(i, 7, '#fff2b8'); zet(7, i, '#fff2b8'); }
  };

  // ---------------- werkplaats en meubels
  TEK.werkbank_zij = () => {
    // gaatjesbord met gereedschap
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, y < 2 ? HOUTSOORT.eik.plank[y ? 1 : 3] : y === 15 ? '#5a3a22' : meng('#b8915e', '#a8804e', hs(x, y, 2) * 0.6));
    for (let y = 3; y < 15; y += 3) for (let x = 1; x < 16; x += 3) zet(x, y, '#4a3420');
    // hamer
    lijn(4, 5, 4, 13, '#8a5a32'); blok(2, 4, 6, 5, '#6a707a'); zet(2, 4, '#aab0b8'); zet(6, 5, '#3a3e46');
    // steeksleutel
    lijn(11, 5, 11, 13, '#9aa0a8'); zet(10, 4, '#9aa0a8'); zet(12, 4, '#9aa0a8'); zet(10, 13, '#7a8088'); zet(12, 13, '#7a8088'); zet(11, 6, '#d0d4da');
  };
  TEK.werkbank_top = () => {
    planken('eik');
    // duimstok langs de onderrand
    for (let x = 1; x < 15; x++) { zet(x, 13, x % 4 === 0 ? '#2a2420' : '#f2c84a'); zet(x, 14, '#e0b030'); }
    // bankschroef in de hoek
    blok(10, 1, 14, 4, '#6a707a'); blok(11, 2, 13, 3, '#9aa0a8'); lijn(12, 5, 12, 7, '#4a4e56'); zet(11, 7, '#c8323c'); zet(13, 7, '#c8323c');
    // een spijker en wat zaagsel
    zet(3, 4, '#c0c4ca'); zet(4, 4, '#7a7e86'); zet(6, 8, '#f0d8a8'); zet(7, 9, '#f0d8a8'); zet(5, 9, '#e8cc98');
  };
  TEK.werkbank_voor = () => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, y < 2 ? HOUTSOORT.eik.plank[y ? 1 : 3] : HOUTSOORT.eik.plank[(x === 0 || x === 15) ? 0 : 2]);
    for (const [y0, y1] of [[3, 8], [10, 14]]) { blok(2, y0, 13, y1, HOUTSOORT.eik.plank[1]); lijn(2, y0, 13, y0, HOUTSOORT.eik.plank[4]); lijn(2, y1, 13, y1, HOUTSOORT.eik.plank[0]); blok(7, y0 + 2, 8, y0 + 2, '#e0aa20'); zet(7, y0 + 3, '#8a6410'); zet(8, y0 + 3, '#8a6410'); }
    zet(0, 15, '#3a2414'); zet(15, 15, '#3a2414');
  };
  function ovenMuur() {
    const pal = P('#5e5650', '#77706a', '#8e8880', '#a59e94'), voeg = '#3a3430';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const rij = Math.floor(y / 4), lx = w(x + (rij % 2) * 3) % 6; if (y % 4 === 3 || lx === 5) zet(x, y, voeg); else zet(x, y, kies(pal, 0.3 + hs(rij, Math.floor(w(x + (rij % 2) * 3) / 6), 7) * 0.5 + (y % 4 === 0 ? 0.2 : 0), x, y, 0.5)); }
  }
  TEK.oven_zij = () => ovenMuur();
  TEK.oven_top = () => { const pal = P('#5e5650', '#77706a', '#8e8880', '#a59e94'); kaart(pal, veld(381, 4, 2), 0.7); for (let x = 4; x < 12; x++) for (let y = 5; y < 11; y++) zet(x, y, (x + y) % 2 ? '#2a2624' : '#3e3836'); for (let x = 4; x < 12; x++) { zet(x, 4, '#a59e94'); zet(x, 11, '#3a3430'); } };
  function ovenVoor(aan) {
    ovenMuur();
    for (let y = 4; y < 16; y++) for (let x = 2; x < 14; x++) {
      const d = Math.hypot(x - 7.5, (y - 9) * 1.1); if (y < 9 && d > 5.5) continue;
      if (d > 4.6 && y < 9 || x === 2 || x === 13) { zet(x, y, '#a8462e'); continue; }
      if (y === 15) { zet(x, y, '#2a2624'); continue; }
      if (!aan) zet(x, y, y > 12 ? '#3a2a22' : (x + y) % 2 ? '#1c1816' : '#241e1a');
      else { const t = (y - 5) / 10 + (hs(x, y, 13) - 0.5) * 0.3; zet(x, y, t > 0.75 ? '#fff0a0' : t > 0.55 ? '#ffc040' : t > 0.35 ? '#f07a20' : '#a8301a'); }
    }
    for (let x = 4; x < 12; x++) zet(x, 14, aan ? '#5a2a1a' : '#4a4e56'); // rooster
  }
  TEK.oven_voor = () => ovenVoor(false);
  TEK.oven_voor_aan = () => ovenVoor(true);
  const KISTHOUT = P('#4a2a18', '#6a3e22', '#8a5430', '#a86c40', '#c08654');
  function kistPlanken() { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const p = Math.floor(y / 5); let t = 0.45 + (hs(x, p, 3) - 0.5) * 0.2 + 0.1 * Math.sin(x * 0.9 + p * 2); if (y % 5 === 0) t = 0.85; if (y % 5 === 4) t = 0.1; zet(x, y, kies(KISTHOUT, Math.max(0, Math.min(1, t)), x, y, 0.6)); } }
  function beslag(x0, y0, x1, y1) { for (const [x, y] of [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x1, y0], [x1 - 1, y0], [x1, y0 + 1], [x0, y1], [x0 + 1, y1], [x0, y1 - 1], [x1, y1], [x1 - 1, y1], [x1, y1 - 1]]) zet(x, y, (x + y) % 3 ? '#c96a32' : '#e68e4e'); zet(x0 + 1, y0 + 1, '#5abf9a'); }
  TEK.kist_zij = () => { kistPlanken(); beslag(1, 2, 14, 15); for (let x = 1; x < 15; x++) zet(x, 6, '#2e1a0e'); };
  TEK.kist_top = () => { kistPlanken(); beslag(1, 1, 14, 14); for (let y = 1; y < 15; y++) { zet(5, y, '#a04a22'); zet(10, y, '#a04a22'); } };
  TEK.kist_voor = () => { TEK.kist_zij(); blok(6, 4, 9, 8, '#c96a32'); blok(7, 5, 8, 6, '#ffbb80'); zet(7, 7, '#2a1a10'); zet(8, 7, '#2a1a10'); lijn(6, 8, 9, 8, '#8a3e1a'); };
  TEK.fakkel = () => {
    leeg();
    // stokje (kolommen 7 en 8, rijen 9 tot 15) en vlam (rijen 5 tot 8)
    for (let y = 9; y <= 15; y++) { zet(7, y, '#8a5a32'); zet(8, y, y % 3 ? '#6a4426' : '#7a4e2d'); }
    zet(7, 8, '#ff9a2a'); zet(8, 8, '#e8702a'); zet(7, 7, '#ffd24a'); zet(8, 7, '#ffc040'); zet(7, 6, '#fff4c0'); zet(8, 6, '#ffe680'); zet(7, 5, '#ffe680'); zet(8, 4, '#ffd24a');
    // gloed voor het icoon (niet zichtbaar op het blok)
    for (const [x, y] of [[6, 6], [9, 6], [6, 7], [9, 7], [6, 8], [9, 8], [7, 4], [6, 5], [9, 5]]) zet(x, y, '#ffb84a');
  };
  TEK.fakkel_houder = () => { kaart(P('#22242a', '#30333a', '#40444c', '#555a64'), veld(391, 4, 1), 0.6); zet(3, 3, '#8a9099'); zet(12, 12, '#8a9099'); };
  TEK.lantaarn = () => {
    leeg();
    const ij = '#2e2a2a', ij2 = '#4a4644';
    // lijf: kolommen 5 tot 10, rijen 9 tot 15
    for (let y = 9; y <= 15; y++) for (let x = 5; x <= 10; x++) {
      const rand = x === 5 || x === 10 || y === 9 || y === 15;
      zet(x, y, rand ? (y === 9 ? ij2 : ij) : meng('#fff2b0', '#ffb84a', Math.hypot(x - 7.5, y - 12) / 3));
    }
    zet(7, 12, '#ffffff'); zet(8, 12, '#fff8d0'); lijn(5, 12, 10, 12, ij, 255); zet(7, 12, '#fff8d0'); zet(8, 12, '#ffffff');
    // kap en hengsel (alleen voor het icoon)
    blok(6, 7, 9, 8, ij2); zet(6, 7, '#6a6664'); blok(7, 5, 8, 6, ij); zet(7, 4, ij); zet(8, 4, ij); zet(6, 5, ij); zet(9, 5, ij);
  };
  TEK.lantaarn_top = () => { kaart(P('#2a2626', '#3a3636', '#4c4846', '#625e5c'), veld(401, 4, 1), 0.5); for (let i = 0; i < 16; i += 4) { zet(i, i, '#8a8684'); zet(15 - i, i, '#8a8684'); } };
  TEK.lantaarn_ketting = () => { leeg(); for (let y = 0; y < 16; y++) { const s = y % 4; if (s === 3) continue; zet(7, y, s === 1 ? '#6a6664' : '#3a3636'); zet(8, y, s === 1 ? '#4a4644' : '#2a2626'); } };
  const DEUR = P('#5a3620', '#7a4c2c', '#9a663a', '#b8804c', '#d09a62');
  TEK.deur_onder = () => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const rand = x < 2 || x > 13 || y > 13, paneel = (x >= 3 && x <= 12) && ((y >= 1 && y <= 5) || (y >= 7 && y <= 12));
      let t = rand ? 0.55 : paneel ? 0.4 : 0.6; if (paneel && (x === 3 || y === 1 || y === 7)) t = 0.15; if (paneel && (x === 12 || y === 5 || y === 12)) t = 0.8; if (x === 0 || x === 15) t = 0.1;
      zet(x, y, kies(DEUR, t + (hs(x, Math.floor(y / 3), 2) - 0.5) * 0.15, x, y, 0.5));
    }
    zet(12, 2, '#e0aa20'); zet(12, 3, '#b8860b'); zet(11, 2, '#fff0a8');
  };
  TEK.deur_boven = () => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const rand = x < 2 || x > 13 || y < 2, raam = x >= 3 && x <= 12 && y >= 3 && y <= 11;
      if (raam && x !== 7 && x !== 8 && y !== 7) { zet(x, y, [0, 0, 0], 0); continue; }
      let t = rand ? 0.55 : 0.6; if (x === 0 || x === 15 || y === 0) t = 0.1; if (raam) t = 0.8; if (y === 12 && x >= 3 && x <= 12) t = 0.15;
      zet(x, y, kies(DEUR, t + (hs(x, Math.floor(y / 3), 3) - 0.5) * 0.15, x, y, 0.5));
    }
  };
  TEK.luik = () => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const rand = x < 2 || x > 13 || y < 2 || y > 13;
      if (!rand && ((x >= 4 && x <= 5) || (x >= 10 && x <= 11)) && ((y >= 4 && y <= 5) || (y >= 10 && y <= 11))) { zet(x, y, [0, 0, 0], 0); continue; }
      let t = rand ? 0.7 : 0.45 + (y % 4 === 0 ? -0.25 : 0); if (x === 0 || y === 0) t = 0.9; if (x === 15 || y === 15) t = 0.1;
      zet(x, y, kies(DEUR, t + (hs(x, Math.floor(y / 4), 4) - 0.5) * 0.15, x, y, 0.5));
    }
    zet(7, 2, '#8a8e96'); zet(8, 2, '#8a8e96'); zet(7, 13, '#8a8e96'); zet(8, 13, '#8a8e96');
  };
  TEK.ladder = () => {
    leeg(); const h = HOUTSOORT.eik.plank;
    for (let y = 0; y < 16; y++) { zet(2, y, h[3]); zet(3, y, h[1]); zet(12, y, h[3]); zet(13, y, h[1]); }
    for (const y of [1, 5, 9, 13]) for (let x = 4; x <= 11; x++) { zet(x, y, h[4]); zet(x, y + 1, h[0]); }
  };
  const DEKEN = (x, y) => (((x >> 2) + (y >> 2)) % 2 ? '#c8323c' : ((x >> 2) % 2 && (y >> 2) % 2) ? '#a82430' : '#f2e8d8');
  TEK.bed_top = () => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, x === 0 || x === 15 ? '#8a2a30' : DEKEN(x, y)); };
  TEK.bed_zij = () => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, y >= 13 ? HOUTSOORT.eik.plank[y === 13 ? 3 : 1] : y >= 7 ? DEKEN(x, y + 1) : '#f2e8d8'); for (const x of [0, 15]) { zet(x, 14, '#5a3820'); zet(x, 15, '#5a3820'); } };
  TEK.bed_kop = () => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, y < 7 ? (x === 0 || x === 15 || y === 0 ? '#d8ccb8' : meng('#fbf6e9', '#e6dccb', y / 7)) : y === 7 ? '#c8bca8' : DEKEN(x, y)); };
  TEK.bed_kop_zij = () => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, y >= 13 ? HOUTSOORT.eik.plank[y === 13 ? 3 : 1] : y >= 7 ? (x < 7 ? (y === 7 ? '#e6dccb' : '#fbf6e9') : DEKEN(x, y + 1)) : '#f2e8d8'); };
  // taarten: een gouden zandtaartrand met ribbels, en bovenop bessen met poedersuiker, kersen met slagroom, of appel met kruimels
  const TA = { deeg: P('#8a5a26', '#b07a38', '#cf9a50', '#e6b76a', '#f5d496'), bes: P('#3a1030', '#6a1838', '#a01c34', '#cc2c40', '#ec5a66'), room: P('#e8dcc4', '#f4ecdb', '#fffaf0') };
  // de rand van boven gezien: geribbeld (om de twee pixels licht en donker), net als een taartvorm
  const taartRand = (x, y) => {
    const buiten = x < 1 || y < 1 || x > 14 || y > 14, rand = x < 3 || y < 3 || x > 12 || y > 12;
    if (!rand) return null;
    const langs = (x < 3 || x > 12) ? y : x, rib = (langs >> 1) % 2;
    return kies(TA.deeg, buiten ? 0.3 : rib ? 0.85 : 0.6, x, y, 0.5);
  };
  TEK.bessentaart_top = () => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = taartRand(x, y); if (r) { zet(x, y, r); continue; }
      // een laag bessen: ronde besjes, rood en donkerpaars door elkaar
      const bes = ((x * 5 + y * 3) % 4) < 2, donker = hs(x >> 1, y >> 1, 41) < 0.35;
      zet(x, y, bes ? kies(TA.bes, donker ? 0.15 : 0.7, x, y, 0.5) : kies(TA.bes, 0.4 + hs(x, y, 42) * 0.25, x, y, 0.5));
    }
    // glans op de besjes en een beetje poedersuiker
    for (const [x, y] of [[5, 5], [9, 6], [6, 9], [10, 10], [8, 8]]) zet(x, y, '#ff9aa4');
    for (const [x, y] of [[4, 7], [7, 4], [11, 5], [4, 11], [8, 11], [11, 8], [6, 6], [9, 9]]) zet(x, y, '#fbf6ee');
  };
  TEK.kersentaart_top = () => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = taartRand(x, y); if (r) { zet(x, y, r); continue; }
      zet(x, y, kies(TA.bes, 0.55 + hs(x, y, 43) * 0.25, x, y, 0.5));
    }
    // een kring van toefjes slagroom, met in elk toefje een kers
    for (const [x, y] of [[5, 5], [10, 5], [5, 10], [10, 10], [7, 3], [3, 7], [12, 8], [8, 12]]) {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) zn(x + dx, y + dy, kies(TA.room, dx + dy === 0 ? 1 : 0.5, x + dx, y + dy, 0.3));
    }
    for (const [x, y] of [[5, 5], [10, 5], [5, 10], [10, 10]]) { zet(x, y, '#a8162b'); zet(x + 1, y, '#7e1022'); }
    for (const [x, y] of [[7, 7], [8, 8]]) zet(x, y, '#ff8a8a');
  };
  TEK.appeltaart_top = () => {
    const v = veld(441, 4, 2);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = taartRand(x, y); if (r) { zet(x, y, r); continue; }
      // kruimels: hobbelig, goudbruin
      const t = 0.35 + (v[y * 16 + x] - 0.5) * 0.9 + ((x + y * 2) % 3 === 0 ? 0.15 : 0);
      zet(x, y, kies(TA.deeg, Math.max(0.1, Math.min(1, t)), x, y, 0.7));
    }
    // stukjes appel die tussen de kruimels uit komen, en kaneel
    for (const [x, y] of [[5, 6], [9, 4], [10, 9], [6, 10], [8, 7]]) { zet(x, y, '#f2e2a8'); zet(x + 1, y, '#e6cc84'); }
    for (const [x, y] of [[4, 4], [11, 11], [7, 12], [12, 6]]) zet(x, y, '#6a3e1c');
  };
  // de zijkant: bovenaan het beleg, dan de vulling en onderaan de gebakken bodem met ribbels
  TEK.taart_zij = () => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c;
      if (y < 8) c = kies(TA.deeg, 0.7, x, y, 0.5);
      else if (y < 10) c = kies(TA.deeg, y === 8 ? 0.95 : 0.8, x, y, 0.4);
      else if (y < 13) c = kies(TA.bes, 0.45 + hs(x, y, 44) * 0.35, x, y, 0.5);
      else c = kies(TA.deeg, y === 15 ? 0.2 : (x >> 1) % 2 ? 0.7 : 0.5, x, y, 0.5);
      zet(x, y, c);
    }
  };
  TEK.taart_onder = () => kaart(TA.deeg, veld(411, 4, 2), 0.7, (x, y, t) => 0.2 + t * 0.45);
  // waar een hap uit is: de doorsnede
  TEK.taart_binnen = () => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, y < 8 ? '#cf9a50' : y < 10 ? kies(TA.deeg, y === 8 ? 0.95 : 0.75, x, y, 0.4) : y < 13 ? kies(TA.bes, 0.3 + hs(x, y, 45) * 0.4, x, y, 0.6) : kies(TA.deeg, y === 15 ? 0.1 : 0.6, x, y, 0.5));
    for (const x of [2, 6, 10, 13]) { zet(x, 11, '#ec5a66'); zet(x + 1, 11, '#cc2c40'); zet(x, 10, '#ffa0a8'); }
  };

  // ---------------- barsten (hakken): een groeiend netwerk van lijntjes
  const BARST = (() => {
    const r = rng(421), uit = [], gezien = new Set();
    const takken = [[7, 7, 0], [8, 8, 2], [7, 8, 4], [8, 7, 6]];
    for (let stap = 0; stap < 90 && takken.length; stap++) {
      const t = takken[stap % takken.length];
      const dir = t[2] + Math.floor(r() * 3) - 1, dx = [1, 1, 0, -1, -1, -1, 0, 1][((dir % 8) + 8) % 8], dy = [0, 1, 1, 1, 0, -1, -1, -1][((dir % 8) + 8) % 8];
      t[0] = w(t[0] + dx); t[1] = w(t[1] + dy);
      const k = t[1] * 16 + t[0]; if (!gezien.has(k)) { gezien.add(k); uit.push(k); }
      if (r() < 0.08) takken.push([t[0], t[1], t[2] + (r() < 0.5 ? 2 : -2)]);
    }
    return uit;
  })();
  for (let s = 0; s < 10; s++) TEK['barst' + s] = () => { leeg(); const n = Math.round(BARST.length * (s + 1) / 10); for (let i = 0; i < n; i++) zet(BARST[i] & 15, BARST[i] >> 4, i % 3 ? '#1a1410' : '#2e241c'); };

  // ---------------- voorwerpen (met donkere omlijning)
  const STEELHOUT = P('#4a2e1a', '#7a4e2d', '#9a6a3a', '#b8864e');
  const MATERIAAL = { hout: HOUTSOORT.eik.plank, steen: P('#4e535e', '#737884', '#9a9ea8', '#c2c5cc'), koper: P('#7a3a18', '#c0622e', '#e48a48', '#ffc08a'), ijzer: P('#5e646c', '#a2a8b0', '#d2d6da', '#ffffff'), robijn: P('#6e0a1a', '#c8102e', '#f0506a', '#ffc0cc') };
  function stok(x0, y0, x1, y1) { lijn(x0, y0, x1, y1, STEELHOUT[2]); lijn(x0 + 1, y0, x1 + 1, y1, STEELHOUT[1]); zn(x0, y0, STEELHOUT[0]); }
  const gereedschap = {
    houweel: (m) => { stok(3, 13, 9, 7); const pts = [[3, 4], [4, 3], [5, 3], [6, 2], [7, 2], [8, 2], [9, 3], [10, 3], [11, 4], [12, 5], [12, 6], [13, 7], [13, 8], [14, 9]]; for (const [x, y] of pts) { zn(x, y, m[2]); zn(x, y + 1, m[1]); } zn(2, 5, m[1]); zn(14, 10, m[1]); zn(6, 2, m[3]); zn(8, 2, m[3]); zn(9, 6, m[0]); zn(10, 6, m[0]); zn(9, 5, m[1]); },
    schop: (m) => { stok(2, 14, 8, 8); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const dx = x - 11, dy = y - 5, a = (dx - dy) / 1.41, b = (dx + dy) / 1.41; if ((a * a) / 10.5 + (b * b) / 5.3 < 1) zn(x, y, b < -0.6 ? m[3] : b < 0.8 ? m[2] : m[1]); } zn(9, 7, m[0]); zn(8, 7, m[1]); zn(9, 8, m[0]); },
    bijl: (m) => {
      stok(3, 13, 11, 5);
      const v = ['..###..', '.#hhm#.', '#hhmmd#', '#hmmmd#', '.#mmd#.', '..#d#..'], k = { '#': m[0], h: m[3], m: m[2], d: m[1] };
      for (let y = 0; y < v.length; y++) for (let x = 0; x < 7; x++) { const c = v[y][x]; if (c !== '.') zn(6 + x + Math.floor(y / 2), 1 + y, k[c]); }
      zn(10, 5, STEELHOUT[1]); zn(11, 4, STEELHOUT[2]);
    },
    zwaard: (m) => { lijn(5, 10, 13, 2, m[2]); lijn(6, 10, 13, 3, m[1]); lijn(5, 9, 12, 2, m[3]); zn(14, 1, m[3]); lijn(3, 8, 7, 12, STEELHOUT[0]); lijn(3, 9, 6, 12, '#c8a040'); zn(4, 11, STEELHOUT[2]); zn(3, 12, STEELHOUT[2]); zn(2, 13, '#c8a040'); zn(1, 14, '#e0b840'); },
  };
  for (const g of Object.keys(gereedschap)) for (const m of Object.keys(MATERIAAL)) TEK['i_' + g + '_' + m] = () => { leeg(); gereedschap[g](MATERIAAL[m]); if (m === 'koper') { zn(8, 3, '#5abf9a'); zn(12, 6, '#5abf9a'); } omlijn(); };
  function klomp(pal, s, rand) { leeg(); const r = rng(s); for (let y = 3; y < 14; y++) for (let x = 3; x < 14; x++) { const d = Math.hypot((x - 8) / 5, (y - 8.5) / 4.4) + (hs(x, y, s) - 0.5) * 0.35; if (d < 1) zn(x, y, kies(pal, 1 - d * 0.6 - (x + y - 16) * 0.04, x, y, 0.7)); } if (rand) for (let i = 0; i < 5; i++) { const x = 4 + Math.floor(r() * 8), y = 5 + Math.floor(r() * 7); if (vol(x, y)) zn(x, y, rand[i % rand.length]); } omlijn(); }
  TEK.i_kolen = () => { klomp(P('#16161c', '#24242e', '#34343e', '#4c4c5a'), 501, ['#7a7a8e', '#a8a8bc']); };
  TEK.i_houtskool = () => { klomp(P('#1e1612', '#2e221a', '#40302a', '#54443a'), 502, ['#7a5a40', '#2a1e18']); };
  TEK.i_koperbrok = () => klomp(MATERIAAL.koper, 503, ['#5abf9a', '#777777', '#ffe0b8']);
  TEK.i_ijzerbrok = () => klomp(P('#6e4a38', '#a87a5a', '#cfa684', '#ecd0b2'), 504, ['#777b84', '#5a3a2a']);
  TEK.i_goudbrok = () => klomp(PAL.goud, 505, ['#ffffff', '#8a7a5a']);
  function staaf(pal) { leeg(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const u = x - y * 0.5, top = y >= 5 && y <= 7 && u >= 1 && u <= 9, voor = y >= 8 && y <= 10 && u >= -1 && u <= 8 - (y - 8) * 0.5; if (top) zn(x, y, pal[y === 5 ? 3 : 2]); else if (voor) zn(x, y, pal[y === 10 ? 0 : 1]); } omlijn(); }
  TEK.i_koperstaaf = () => staaf(MATERIAAL.koper);
  TEK.i_ijzerstaaf = () => staaf(MATERIAAL.ijzer);
  TEK.i_goudstaaf = () => staaf(PAL.goud.slice(1));
  TEK.i_robijn = () => {
    leeg(); const v = ['...####...', '..#hhmm#..', '.#hmmmmd#.', '#hmmmmmdd#', '#mmmmmddd#', '.#mmmddd#.', '..#mddd#..', '...#dd#...', '....##....'], k = { '#': '#8e0c22', h: '#ffd0d8', m: '#e8304a', d: '#a8142c' };
    for (let y = 0; y < v.length; y++) for (let x = 0; x < 10; x++) { const c = v[y][x]; if (c !== '.') zn(3 + x, 3 + y, k[c]); }
    omlijn();
  };
  TEK.i_appel = () => { leeg(); const a = P('#7a0e14', '#b81e22', '#e0382e', '#ff7a5a'); for (let y = 4; y < 15; y++) for (let x = 2; x < 15; x++) { const d = Math.hypot((x - 8.5) / 5.5, (y - 9.5) / 5) - (y < 6 && Math.abs(x - 8.5) < 1 ? -0.4 : 0); if (d < 1) zn(x, y, kies(a, 1 - d * 0.7 - (x + y - 16) * 0.05, x, y, 0.6)); } zn(6, 7, '#ffd0c0'); lijn(8, 4, 9, 1, '#5a3a22'); zn(10, 2, '#4e9a3a'); zn(11, 2, '#6aba4a'); zn(11, 3, '#4e9a3a'); omlijn(); };
  TEK.i_gebakken_appel = () => { leeg(); const a = P('#5a2210', '#8a3a18', '#b85a28', '#e08a48', '#ffc890'); for (let y = 5; y < 15; y++) for (let x = 2; x < 15; x++) { const d = Math.hypot((x - 8.5) / 5.5, (y - 10) / 4.6); if (d < 1) zn(x, y, kies(a, 1 - d * 0.7 - (x + y - 16) * 0.05, x, y, 0.6)); } zn(6, 8, '#fff0d0'); zn(7, 8, '#ffe0b0'); lijn(8, 5, 8, 3, '#3a2414'); zn(5, 12, '#6a2a14'); zn(10, 11, '#6a2a14'); omlijn(); };
  TEK.i_bessen = () => { leeg(); for (const [x, y] of [[6, 8], [10, 8], [8, 11], [5, 12], [11, 12]]) { for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (a * a + b * b < 2) zn(x + a, y + b, a + b < 0 ? '#e83048' : '#b81830'); zn(x - 1, y - 1, '#ffb0b8'); } lijn(8, 7, 8, 3, '#4a6a2a'); zn(9, 3, '#5aaa48'); zn(10, 3, '#5aaa48'); zn(10, 4, '#3e8a36'); omlijn(); };
  function kom(vulsel) { leeg(); const h = HOUTSOORT.eik.plank; for (let y = 7; y < 14; y++) for (let x = 1; x < 15; x++) { const d = Math.hypot((x - 7.5) / 6.6, (y - 7) / 6.2); if (d < 1) zn(x, y, kies(h, 0.75 - (y - 7) * 0.09, x, y, 0.5)); } for (let x = 2; x < 14; x++) zn(x, 7, vulsel ? vulsel[(x * 3) % vulsel.length] : h[0]); if (vulsel) for (let x = 3; x < 13; x++) zn(x, 6, vulsel[(x * 5 + 1) % vulsel.length]); omlijn(); }
  TEK.i_kom = () => kom(null);
  TEK.i_soep = () => kom(['#8a5a32', '#a8743e', '#c8925a', '#e8d0b0', '#c02e28']);
  function emmer(water) { leeg(); const m = MATERIAAL.ijzer; for (let y = 6; y < 15; y++) { const hw = 5 - (y - 6) * 0.25; for (let x = Math.ceil(7.5 - hw); x <= Math.floor(8.5 + hw); x++) zn(x, y, kies(m, x < 8 ? 0.7 : 0.35, x, y, 0.4)); } for (let x = 2; x <= 13; x++) zn(x, 6, water ? ((x % 3) ? '#3d8fd6' : '#8ac8f8') : '#3a3e46'); for (let x = 2; x <= 13; x++) zn(x, 5, m[3]); lijn(2, 5, 4, 2, m[1]); lijn(4, 2, 11, 2, m[1]); lijn(11, 2, 13, 5, m[1]); omlijn(); }
  TEK.i_emmer = () => emmer(false);
  TEK.i_emmer_water = () => emmer(true);
  TEK.i_kompas = () => { leeg(); for (let y = 2; y < 15; y++) for (let x = 2; x < 15; x++) { const d = Math.hypot(x - 8, y - 8.5); if (d < 6.3) zn(x, y, d > 5 ? (x + y < 16 ? '#e68e4e' : '#a04a22') : '#f4ecd8'); } lijn(8, 4, 8, 8, '#c8323c'); lijn(8, 9, 8, 13, '#4a4e56'); zn(8, 8, '#2a2420'); zn(7, 5, '#ff7a7a'); zn(5, 6, '#fffaf0'); omlijn(); };
  TEK.i_klok = () => { leeg(); for (let y = 2; y < 15; y++) for (let x = 2; x < 15; x++) { const d = Math.hypot(x - 8, y - 8.5); if (d < 6.3) zn(x, y, d > 5 ? (x + y < 16 ? '#f6cf4a' : '#b8860b') : (y < 9 ? '#cfe6ff' : '#2e3a6a')); } zn(8, 4, '#2a2420'); zn(12, 8, '#2a2420'); zn(4, 8, '#2a2420'); lijn(8, 8, 8, 5, '#2a2420'); lijn(8, 8, 10, 9, '#2a2420'); zn(6, 6, '#ffffff'); omlijn(); };
  TEK.i_taartpunt = () => {
    leeg();
    // een punt van opzij en een beetje van boven: bodem, vulling en bovenop slagroom met een bes
    for (let y = 4; y < 14; y++) for (let x = 2; x < 15; x++) {
      if (y < 13 - (x - 2) * 0.62 && y < 11) continue;
      const c = y >= 12 ? '#b07a38' : y >= 10 ? '#cc2c40' : y >= 8 ? '#e6b76a' : '#f4ecdb';
      zn(x, y, c);
    }
    zn(12, 5, '#a01c34'); zn(13, 5, '#cc2c40'); zn(12, 4, '#ff9aa4');
    omlijn();
  };
  TEK.i_linnendraad = () => { leeg(); const h = HOUTSOORT.eik.plank; blok(4, 3, 11, 4, h[3]); blok(4, 12, 11, 13, h[1]); for (let y = 5; y < 12; y++) for (let x = 5; x <= 10; x++) zn(x, y, (y + (x >> 1)) % 2 ? '#eee9dd' : '#d8d0bc'); lijn(10, 8, 14, 11, '#eee9dd'); omlijn(); };
  const VERF = { rood: '#C8323C', oranje: '#E8782E', geel: '#E9C13A', groen: '#4E9A4E', blauw: '#2F5BB8', paars: '#7A4E9A', roze: '#E88AB0', zwart: '#2E2A30' };
  for (const [s, c] of Object.entries(VERF)) TEK['i_verf_' + s] = () => {
    leeg();
    for (let y = 6; y < 15; y++) for (let x = 4; x <= 11; x++) zn(x, y, y < 9 ? maal(c, x < 7 ? 1.15 : 0.9) : y < 13 ? (x < 6 ? '#fbf6e9' : '#e8dcc0') : maal(c, 0.7));
    blok(4, 4, 11, 5, '#8a9099'); lijn(4, 4, 11, 4, '#c0c4ca');
    zn(9, 6, maal(c, 1.3)); zn(9, 7, c); zn(6, 10, c); zn(7, 10, c); zn(8, 11, maal(c, 0.8));
    omlijn();
  };
  TEK.i_rugzak = () => {
    leeg(); const l = P('#4a2a16', '#6a3e22', '#8a5430', '#a86c40');
    for (let y = 4; y < 15; y++) for (let x = 3; x <= 12; x++) { const rond = (y === 4 && (x < 5 || x > 10)) || (y === 14 && (x === 3 || x === 12)); if (!rond) zn(x, y, l[x < 5 ? 3 : x > 10 ? 1 : 2]); }
    for (let y = 4; y < 9; y++) for (let x = 3; x <= 12; x++) if (!(y === 4 && (x < 5 || x > 10))) zn(x, y, y === 8 ? '#8a1e26' : x < 6 ? '#e04a52' : '#c8323c');
    blok(7, 8, 8, 9, '#e0aa20'); zn(7, 9, '#8a6410'); lijn(6, 2, 9, 2, l[1]); zn(5, 3, l[1]); zn(10, 3, l[1]); lijn(5, 11, 10, 11, l[0]); zn(11, 12, '#e0aa20');
    omlijn();
  };
  TEK.i_stok = () => { leeg(); lijn(3, 13, 12, 3, STEELHOUT[2]); lijn(4, 13, 13, 3, STEELHOUT[1]); zn(12, 3, STEELHOUT[3]); zn(7, 9, STEELHOUT[0]); omlijn(); };

  // ---------------- de arm: een werkjas in de blauwe kleur van het gaatjesbord, met een manilla manchet
  TEK.arm_mouw = () => {
    const pal = P('#1E3263', '#26407A', '#2F4C8F', '#3A5AA0', '#4767AE');
    const v = veld(31, 4, 2);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      // grof geweven stof: een ruitje van draden, en naar de elleboog toe iets donkerder
      const draad = ((x + y) & 1) ? 0.06 : -0.04, plooi = Math.sin((y + x * 0.35) * 0.9) * 0.08;
      zet(x, y, kies(pal, 0.35 + v[y * 16 + x] * 0.4 + draad + plooi - (y < 3 ? 0.12 : 0), x, y, 0.6));
    }
    // een naad in het midden, met stiksels
    for (let y = 0; y < 13; y++) { zet(7, y, '#1E3263'); if (y % 3 === 1) zet(8, y, '#F2DDA0'); }
    // de manchet onderaan (bij de pols)
    for (let x = 0; x < 16; x++) { zet(x, 12, '#C9B27A'); zet(x, 13, '#F2DDA0'); zet(x, 14, '#E8CF8E'); zet(x, 15, '#B89D63'); if (x % 4 === 1) zet(x, 13, '#FBF6E9'); }
  };
  // de hand: licht en bijna kleurloos, zodat de huidskleur er netjes overheen kan; knokkels en een duim als schaduw
  TEK.arm_huid = () => {
    const pal = P('#c9c4c0', '#dcd8d4', '#ebe8e5', '#f6f4f2', '#ffffff');
    kaart(pal, veld(37, 4, 2), 0.5, (x, y, t) => t * 0.35 + 0.55 - (y > 13 ? 0.18 : 0));
    for (const x of [3, 7, 11]) { zet(x, 2, '#bdb7b2'); zet(x, 3, '#cfcac6'); }
    for (let y = 6; y < 12; y++) zet(1, y, y === 6 || y === 11 ? '#c4beb9' : '#d4cfcb');
  };
  // de stof van de arm als je een poppetje hebt: licht en bijna kleurloos (hij krijgt de kleur van je bovenstuk), met een naad en een manchet
  TEK.arm_stof = () => {
    const pal = P('#b8b4b0', '#cbc7c3', '#dcd9d6', '#ecebe9', '#f8f7f6');
    const v = veld(33, 4, 2);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const draad = ((x + y) & 1) ? 0.05 : -0.03, plooi = Math.sin((y + x * 0.35) * 0.9) * 0.07;
      zet(x, y, kies(pal, 0.45 + v[y * 16 + x] * 0.35 + draad + plooi - (y < 3 ? 0.1 : 0), x, y, 0.5));
    }
    for (let y = 0; y < 12; y++) zet(7, y, '#b0aca8');
    for (let x = 0; x < 16; x++) { zet(x, 12, '#c4c0bc'); zet(x, 13, '#a9a5a1'); zet(x, 14, '#bdb9b5'); zet(x, 15, '#9e9a96'); }
  };
  // ---------------- het gezicht van je poppetje: losse laagjes (ogen, mond, extra) die vlak voor het hoofd zitten.
  // Het hoofd is 10 breed en 10 hoog; vakje (fx, fy) van het gezicht (fx van links naar rechts, fy van boven naar beneden)
  // valt in de textuur op kolom (11 + fx) % 16 en rij 3 + fy (zo legt de tekenaar dozen op de textuur).
  const gz = (fx, fy, c) => zet((11 + fx) % 16, 3 + fy, c);
  const OOG = '#2A1E1A', WIT = '#FFFFFF', LID = '#6B4530';
  const tweeOgen = f => { f(2, 0); f(6, 1); };
  TEK.pop_ogen_rond = () => { leeg(); tweeOgen(x => { gz(x, 4, OOG); gz(x + 1, 4, OOG); gz(x, 5, OOG); gz(x + 1, 5, OOG); gz(x, 4, WIT); }); };
  TEK.pop_ogen_groot = () => { leeg(); tweeOgen(x => { for (let y = 3; y <= 5; y++) { gz(x, y, WIT); gz(x + 1, y, WIT); } gz(x, 4, OOG); gz(x + 1, 4, OOG); gz(x, 5, OOG); gz(x + 1, 5, OOG); gz(x + 1, 4, WIT); }); };
  TEK.pop_ogen_blij = () => { leeg(); tweeOgen(x => { gz(x - 1, 5, OOG); gz(x, 4, OOG); gz(x + 1, 4, OOG); gz(x + 2, 5, OOG); }); };
  TEK.pop_ogen_knipoog = () => { leeg(); gz(2, 4, WIT); gz(3, 4, OOG); gz(2, 5, OOG); gz(3, 5, OOG); gz(5, 5, OOG); gz(6, 5, OOG); gz(7, 5, OOG); gz(8, 4, OOG); };
  TEK.pop_ogen_slaperig = () => { leeg(); tweeOgen(x => { gz(x, 4, LID); gz(x + 1, 4, LID); gz(x, 5, OOG); gz(x + 1, 5, OOG); }); };
  TEK.pop_ogen_wimpers = () => { leeg(); tweeOgen((x, r) => { gz(x, 4, OOG); gz(x + 1, 4, OOG); gz(x, 5, OOG); gz(x + 1, 5, OOG); gz(x + (r ? 1 : 0), 4, WIT); gz(r ? x + 2 : x - 1, 3, OOG); gz(r ? x + 1 : x, 3, OOG); }); };
  const MOND = '#5A2620', TONG = '#E06070';
  TEK.pop_mond_lach = () => { leeg(); gz(3, 7, MOND); gz(6, 7, MOND); gz(4, 8, MOND); gz(5, 8, MOND); };
  TEK.pop_mond_grijns = () => { leeg(); for (let x = 3; x <= 6; x++) gz(x, 7, MOND); gz(4, 8, TONG); gz(5, 8, TONG); gz(3, 8, MOND); gz(6, 8, MOND); };
  TEK.pop_mond_oh = () => { leeg(); gz(4, 7, MOND); gz(5, 7, MOND); gz(4, 8, MOND); gz(5, 8, MOND); };
  TEK.pop_mond_tandjes = () => { leeg(); gz(3, 7, MOND); gz(4, 7, WIT); gz(5, 7, WIT); gz(6, 7, MOND); gz(4, 8, MOND); gz(5, 8, MOND); };
  TEK.pop_mond_rustig = () => { leeg(); gz(4, 8, MOND); gz(5, 8, MOND); };
  TEK.pop_sproetjes = () => { leeg(); for (const [x, y] of [[1, 6], [2, 7], [0, 7], [7, 7], [8, 6], [9, 7]]) gz(x, y, '#A0603A'); };
  TEK.pop_blosjes = () => { leeg(); for (const [x, y] of [[0, 6], [1, 6], [8, 6], [9, 6]]) gz(x, y, '#F08C9A'); };

  // ============================================================================
  // ronde 2: nieuwe steen, kersen- en notenhout, gekleurde basissen, decoratie, bloemen, landbouw en vondsten
  // ============================================================================
  // ---------------- steen
  TEK.graniet = () => {
    // roze-grijs met spikkels van veldspaat en zwarte mica
    kaart(P('#7a6a66', '#8e7c76', '#a28e86', '#b6a198', '#c8b4aa'), veld(1201, 4, 3), 0.9);
    const r = rng(1202);
    for (let i = 0; i < 22; i++) zet(Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.55 ? '#d89a8a' : '#e8c6b8');
    for (let i = 0; i < 14; i++) zet(Math.floor(r() * 16), Math.floor(r() * 16), '#3e3434');
  };
  TEK.graniet_glad = () => {
    const pal = P('#8e7c76', '#a28e86', '#b29c94', '#c2ada4', '#d2beb4'), r = rng(1203);
    kaart(pal, veld(1204, 2, 2), 0.5, (x, y, t) => (x === 0 || y === 0) ? 0.95 : (x === 15 || y === 15) ? 0.02 : 0.35 + t * 0.35);
    for (let i = 0; i < 12; i++) { const x = 1 + Math.floor(r() * 14), y = 1 + Math.floor(r() * 14); zet(x, y, r() < 0.5 ? '#d89a8a' : '#4a3e3e'); }
    zet(3, 2, '#f2e2d8'); zet(2, 3, '#f2e2d8');
  };
  TEK.basalt = () => {
    // staande zuilen: donkergrijs met verticale voegen
    const pal = P('#1e2026', '#2a2c34', '#373a44', '#454955', '#555a68'), v = veld(1205, 2, 2, 8);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const voeg = x % 5 === 0 ? 0.02 : x % 5 === 1 ? 0.18 : 0.45; zet(x, y, kies(pal, Math.min(1, voeg + v[y * 16 + x] * 0.35 + (x % 5 === 4 ? 0.2 : 0)), x, y, 0.6)); }
  };
  TEK.basalt_top = () => {
    // de zeskantige bovenkant van de zuilen
    const C = cellen(1206, 6), pal = P('#22242a', '#30333c', '#3e424c', '#4e5360', '#5e6474');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = y * 16 + x; zet(x, y, C.rand[k] < 0.9 ? '#16181c' : kies(pal, 0.35 + ((C.id[k] * 37) % 10) / 22 - C.d1[k] * 0.04, x, y, 0.6)); }
  };
  TEK.basalt_glad = () => { const pal = P('#2a2c34', '#33363f', '#3d404a', '#474b56', '#535866'); kaart(pal, veld(1207, 2, 2), 0.5, (x, y, t) => (x === 0 || y === 0) ? 0.95 : (x === 15 || y === 15) ? 0.0 : 0.35 + t * 0.3); zet(2, 2, '#7a8090'); };
  TEK.marmer = () => {
    // wit met grijze en een paar gouden aders
    const pal = P('#cfcbc6', '#dedad5', '#ebe8e4', '#f5f3f0', '#ffffff'); kaart(pal, veld(1208, 2, 2), 0.5, (x, y, t) => 0.55 + t * 0.4);
    const r = rng(1209);
    for (let a = 0; a < 3; a++) { let x = Math.floor(r() * 16), y = 0; const k = a === 2 ? '#c8a860' : '#9a9590'; while (y < 16) { zet(x, y, k); if (r() < 0.45) zet(x + 1, y, maal(k, 1.15)); x += r() < 0.5 ? 1 : r() < 0.5 ? -1 : 0; y++; } }
  };
  TEK.marmertegels = () => {
    TEK.marmer();
    for (let i = 0; i < 16; i++) { zet(i, 7, '#a8a39e'); zet(7, i, '#a8a39e'); zet(i, 8, '#ffffff'); zet(8, i, '#ffffff'); zet(i, 15, '#a8a39e'); zet(15, i, '#a8a39e'); zet(i, 0, '#ffffff'); zet(0, i, '#ffffff'); }
  };
  TEK.veen = () => {
    // donkerbruine turf met vezels van oude planten
    kaart(P('#1e140e', '#2a1c14', '#38261a', '#463222', '#563e2a'), veld(1210, 4, 3), 1);
    const r = rng(1211);
    for (let i = 0; i < 10; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); lijn(x, y, x + 2 + Math.floor(r() * 3), y + (r() < 0.5 ? 1 : 0), r() < 0.5 ? '#6a5236' : '#4e3e2a', 255, true); }
  };
  TEK.gebarsten_steen = () => {
    TEK.steenstenen();
    const r = rng(1212);
    for (let a = 0; a < 3; a++) { let x = 2 + Math.floor(r() * 12), y = 1 + Math.floor(r() * 4); for (let k = 0; k < 6; k++) { zet(x, y, '#3e424e'); x += r() < 0.5 ? 1 : -1; y += 1; if (y > 14) break; } }
  };
  // ---------------- kersen- en notenhout
  HOUTSOORT.kers = { schors: P('#3a1e1e', '#522a28', '#6a3834', '#7e4842', '#925a52'), ring: P('#b8645a', '#cc7a6c', '#de9282', '#eeac9a'), plank: P('#8a3e32', '#a8503e', '#c2664e', '#d67e62', '#e6987a') };
  HOUTSOORT.noten = { schors: P('#221812', '#30221a', '#3e2e22', '#4e3c2e', '#5e4a3a'), ring: P('#6e4e34', '#82603e', '#96744c', '#aa885c'), plank: P('#3a2618', '#4e3420', '#64442a', '#7a5636', '#8e6a44') };
  for (const s of ['kers', 'noten']) { TEK['stam_' + s] = () => schors(s); TEK['stam_' + s + '_ring'] = () => ring(s); TEK['planken_' + s] = () => planken(s); }
  const BLOESEM = P('#a8406a', '#d0608a', '#e888aa', '#f6b2c8', '#ffd8e4', '#ffffff');
  TEK.blad_kers = () => {
    // roze bloesem met hier en daar een groen blaadje
    bladeren(BLOESEM, 1213, bladVorm.eik(BLOESEM), 0.8);
    const r = rng(1214); for (let i = 0; i < 9; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); if (buf[(y * 16 + x) * 4 + 3]) zet(x, y, r() < 0.5 ? '#5a9a3a' : '#7ab84a'); }
  };
  TEK.blad_noten = () => bladeren(GRIJS_BLAD, 1215, bladVorm.esdoorn(GRIJS_BLAD), 0.78);
  TEK.stekje_kers = () => { leeg(); for (let y = 9; y <= 15; y++) zn(8, y, '#6a3834'); for (let y = 2; y <= 9; y++) for (let x = 4; x <= 12; x++) { const d = Math.hypot((x - 8) / 4, (y - 5.5) / 3.6); if (d < 1 && (x * 3 + y * 5) % 11) zn(x, y, d < 0.4 ? '#ffd8e4' : (x + y) % 2 ? '#e888aa' : '#d0608a'); } };
  TEK.stekje_noten = () => { leeg(); for (let y = 8; y <= 15; y++) zn(8, y, '#3e2e22'); for (let y = 1; y <= 9; y++) for (let x = 3; x <= 13; x++) { const d = Math.hypot((x - 8) / 5, (y - 5) / 4); if (d < 1 && (x * 5 + y * 3) % 7) zn(x, y, d < 0.45 ? '#7aa84a' : (x + y) % 2 ? '#4e7a2e' : '#3a6024'); } };
  // ---------------- grijze basissen voor gekleurde blokken (de kleur komt uit het palet)
  TEK.glas_kleur = () => {
    leeg();
    for (let i = 0; i < 16; i++) { zet(i, 0, '#ffffff'); zet(0, i, '#ffffff'); zet(i, 15, '#cfcfcf'); zet(15, i, '#cfcfcf'); }
    // een gekleurd waas met een schuine glans: losse pixels, zodat je erdoor kunt kijken
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) if ((x * 7 + y * 3) % 5 === 0 || (x + y) % 9 === 0) zet(x, y, (x + y) % 2 ? '#e6e6e6' : '#d2d2d2');
    lijn(3, 7, 7, 3, '#ffffff'); lijn(10, 12, 12, 10, '#ffffff');
  };
  TEK.pleister = () => {
    kaart(P('#c8c8c8', '#d4d4d4', '#dedede', '#e8e8e8', '#f2f2f2'), veld(1216, 4, 2), 0.6);
    const r = rng(1217); for (let i = 0; i < 6; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 15); zet(x, y, '#ffffff'); zet(x + 1, y, '#f6f6f6'); }
  };
  TEK.tegel_glazuur = () => {
    // vier tegeltjes met een glanzende rand
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const lx = x % 8, ly = y % 8; let c = meng('#f2f2f2', '#d0d0d0', (lx + ly) / 16); if (lx === 0 || ly === 0) c = '#9e9e9e'; else if (lx === 1 || ly === 1) c = '#ffffff'; zet(x, y, c); }
    for (const [x, y] of [[3, 3], [11, 3], [3, 11], [11, 11]]) { zet(x, y, '#ffffff'); zet(x + 1, y, '#ffffff'); }
  };
  TEK.tapijt = () => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const weef = ((x >> 1) + (y >> 1)) % 2 ? 0.95 : 0.86, rand = x === 0 || y === 0 || x === 15 || y === 15; zet(x, y, rand ? '#b4b4b4' : maal('#f0f0f0', weef + (hs(x, y, 17) - 0.5) * 0.06)); }
    for (let i = 2; i < 14; i++) { zet(i, 2, '#c8c8c8'); zet(i, 13, '#c8c8c8'); zet(2, i, '#c8c8c8'); zet(13, i, '#c8c8c8'); }
  };
  // ---------------- decoratie
  TEK.bloempot = () => {
    // terracotta, met een rand bovenaan (de pot is 6 hoog: rijen 10 tot 15)
    const pal = P('#7a3a22', '#9a4a2a', '#b85e36', '#cc7446', '#de8e5c');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, kies(pal, y === 10 ? 0.95 : y === 11 ? 0.2 : 0.45 + (hs(x, y, 19) - 0.5) * 0.25 - (x > 9 ? 0.15 : 0), x, y, 0.5));
  };
  TEK.pot_aarde = () => { kaart(PAL.aarde, veld(1218, 4, 2), 1); for (let i = 0; i < 16; i++) { zet(i, 0, '#cc7446'); zet(i, 15, '#7a3a22'); zet(0, i, '#cc7446'); zet(15, i, '#7a3a22'); } };
  TEK.kaars = () => {
    // was in het midden (kolommen 7 en 8, rijen 11 tot 15) en een vlammetje (rijen 8 tot 10)
    leeg();
    for (let y = 11; y <= 15; y++) { zet(7, y, y === 11 ? '#fff8e6' : '#f2e6c8'); zet(8, y, y === 11 ? '#f2e6c8' : '#dccca6'); }
    zet(7, 10, '#3a2a1a'); zet(8, 10, '#ffb030'); zet(7, 9, '#ffd24a'); zet(8, 9, '#fff0a0'); zet(7, 8, '#fff8d0'); zet(8, 8, '#ffe680');
  };
  TEK.klimop = () => {
    leeg(); const r = rng(1219), pal = GRIJS_BLAD;
    for (let s = 0; s < 3; s++) { let x = 2 + s * 5 + Math.floor(r() * 2); for (let y = 0; y < 16; y++) { zet(x, y, '#5a5a5a'); if (y % 3 === s % 3) { const kant = r() < 0.5 ? -1 : 1; zet(x + kant, y, pal[3]); zet(x + kant * 2, y, pal[2]); zet(x + kant, y - 1, pal[4]); } if (r() < 0.25) x += r() < 0.5 ? 1 : -1; x = Math.max(1, Math.min(14, x)); } }
  };
  TEK.mos = () => { kaart(P('#2e5a1e', '#3e7226', '#4e8a2e', '#62a03a', '#7ab84a'), veld(1220, 4, 3), 1); const r = rng(1221); for (let i = 0; i < 12; i++) zet(Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? '#9ad05a' : '#244a16'); };
  TEK.spinnenweb = () => {
    leeg(); const c = '#e8e8ec', d = '#c8c8d0';
    lijn(0, 0, 15, 15, c); lijn(15, 0, 0, 15, c); lijn(8, 0, 8, 15, d); lijn(0, 8, 15, 8, d);
    for (const r0 of [2.5, 5, 7]) for (let a = 0; a < 32; a++) { const t = a / 32 * Math.PI * 2; zn(Math.round(8 + Math.cos(t) * r0), Math.round(8 + Math.sin(t) * r0), a % 2 ? c : d); }
  };
  TEK.glas_in_lood = () => {
    // vakjes in drie kleuren met donker lood ertussen
    const kl = ['#c8323c', '#2f5bb8', '#e9c13a', '#4e9a4e', '#e8f4f8'];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const lood = x === 0 || y === 0 || x === 15 || y === 15 || x === 8 || y === 8 || Math.abs(x - y) === 0 && x > 1 && x < 14 || Math.abs(x + y - 15) === 0 && x > 1 && x < 14;
      if (lood) { zet(x, y, '#2a2c32'); continue; }
      const vak = (x < 8 ? 0 : 1) + (y < 8 ? 0 : 2) + (x > y ? 1 : 0) + (x + y > 15 ? 2 : 0);
      zet(x, y, maal(kl[vak % 5], 0.85 + hs(x, y, 23) * 0.25));
    }
  };
  TEK.schilderij = () => {
    // een eigen schilderijtje: heuvels, een molen en een zon, in een houten lijst
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (x === 0 || y === 0 || x === 15 || y === 15) { zet(x, y, (x + y) % 2 ? '#7a4e2d' : '#5a3820'); continue; }
      if (x === 1 || y === 1 || x === 14 || y === 14) { zet(x, y, '#c8a060'); continue; }
      const heuvel = y > 9 + Math.round(Math.sin(x * 0.6) * 1.5);
      zet(x, y, heuvel ? (y > 12 ? '#3e7226' : '#5a9a3a') : y < 6 ? '#8ac8f8' : '#b8e0ff');
    }
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) zet(11 + x, 4 + y, '#ffd24a');
    blok(5, 6, 6, 10, '#7a4e2d'); lijn(3, 4, 8, 9, '#f2e6c8'); lijn(8, 4, 3, 9, '#f2e6c8');
  };
  // ---------------- nieuwe bloemen
  function bloem(kleur, hart, hoog, vorm) {
    leeg(); steel(8, hoog, 15, STEEL[1]); zn(7, 12, STEEL[2]); zn(6, 11, STEEL[2]); zn(9, 13, STEEL[2]); zn(10, 12, STEEL[2]);
    const y0 = hoog - 2;
    if (vorm === 'rond') { for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) zn(8 + x, y0 + y, kleur[(x + y) > 0 ? 0 : 1]); zn(8, y0, hart); zn(7, y0 - 1, kleur[2]); }
    else if (vorm === 'groot') { for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const d = x * x + y * y; if (d <= 11) zn(8 + x, y0 + y, d <= 3 ? (d === 0 ? kleur[2] : hart) : kleur[(x + y + 9) % 2]); } }
    else if (vorm === 'aar') { for (let y = 0; y < 6; y++) { zn(8, y0 - 3 + y, kleur[y % 2]); if (y % 2) { zn(7, y0 - 3 + y, kleur[2]); zn(9, y0 - 3 + y, kleur[1]); } } }
    else { for (const [x, y] of [[0, -2], [-2, 0], [2, 0], [0, 2], [-1, -1], [1, 1], [1, -1], [-1, 1]]) zn(8 + x, y0 + y, kleur[(x + y + 4) % 2]); zn(8, y0, hart); }
  }
  TEK.zonnebloem = () => bloem(P('#e8a010', '#f8c830', '#fff080'), '#5a3a1a', 7, 'groot');
  TEK.klaproos = () => bloem(P('#a8101e', '#e02a30', '#ff6a5a'), '#1e1a1a', 7, 'rond');
  TEK.lavendel = () => bloem(P('#6a4aa8', '#9a7ad8', '#c8b0f0'), '#6a4aa8', 6, 'aar');
  TEK.madelief = () => bloem(P('#e8e4dc', '#ffffff', '#ffd0d8'), '#f2c230', 9, 'ster');
  TEK.vergeetmenietje = () => bloem(P('#3a72c8', '#6aa0f0', '#b8d8ff'), '#f2d24a', 9, 'ster');
  // ---------------- mijnspoor
  TEK.spoor = () => kaart(P('#3a3e46', '#4e535c', '#6a7078', '#8a9099', '#aab0b8'), veld(1222, 2, 1, 8), 0.5, (x, y, t) => 0.3 + t * 0.4 + (x % 4 === 0 ? 0.2 : 0));
  TEK.spoor_hout = () => planken('spar');
  // ---------------- bewoners: licht en bijna wit, want elke bewoner krijgt er zijn eigen kleur overheen
  TEK.bw_huid = () => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, maal('#ffffff', 0.93 + hs(x, y, 41) * 0.05)); };
  // het gezicht zit op de voorkant van het hoofd: kolommen 12 tot en met 3 (doorlopend) en rijen 7 tot en met 14
  TEK.bw_gezicht = () => {
    TEK.bw_huid();
    const f = (fx, fy, c) => zet((12 + fx) % 16, 7 + fy, c);
    // twee ronde oogjes met een lichtpuntje, zachte blosjes en een kleine glimlach (8 bij 8 pixels)
    for (const ox of [1, 5]) { f(ox, 3, '#fbf8f2'); f(ox + 1, 3, '#2b211e'); f(ox, 4, '#2b211e'); f(ox + 1, 4, '#2b211e'); f(ox, 2, '#cbb4a6'); f(ox + 1, 2, '#cbb4a6'); }
    f(0, 5, '#f8d6cc'); f(7, 5, '#f8d6cc'); f(1, 5, '#fae2da'); f(6, 5, '#fae2da');
    f(2, 5, '#b98276'); f(5, 5, '#b98276'); f(3, 6, '#9a5248'); f(4, 6, '#9a5248');
  };
  TEK.bw_stof = () => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, maal('#ffffff', 0.8 + ((x + y) % 4 === 0 ? -0.06 : 0) + ((x * 3 + y) % 5 === 0 ? 0.05 : 0) + hs(x, y, 43) * 0.1)); };
  TEK.bw_haar = () => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, maal('#ffffff', 0.72 + (x % 3 === 0 ? -0.12 : 0) + (hs(x, Math.floor(y / 3), 47) - 0.5) * 0.22)); };
  TEK.bw_leer = () => { const pal = P('#4a2a16', '#5e3720', '#73452a', '#865434'); kaart(pal, veld(1301, 3, 2), 0.6, (x, y, t) => (x === 1 || x === 14) && y % 2 === 0 ? 0.95 : 0.3 + t * 0.4); };
  TEK.bw_schoen = () => { const pal = P('#24180f', '#33231a', '#443025'); kaart(pal, veld(1303, 2, 1), 0.5, (x, y, t) => (y === 0 ? 0.9 : 0.25 + t * 0.4)); };
  TEK.bw_bril = () => vul('#262a33');
  // het stuwspoor: messing rails met een rode streep, zodat je het van ver ziet
  TEK.stuwspoor = () => kaart(P('#7a5418', '#a87a24', '#d2a63a', '#ecc85a', '#fbe79a'), veld(1223, 2, 1, 8), 0.5, (x, y, t) => 0.35 + t * 0.35 + (x % 4 === 0 ? 0.2 : 0) - (y % 8 < 2 ? 0.25 : 0));
  // een karretje: een houten bak met ijzeren randen op twee wielen (van opzij)
  TEK.i_karretje = () => {
    leeg();
    const hout = HOUTSOORT.spar.plank;
    blok(2, 5, 13, 10, hout[2]); for (let x = 2; x <= 13; x++) { zn(x, 7, hout[1]); zn(x, 9, hout[3]); }
    blok(1, 4, 14, 4, '#8a9099'); lijn(1, 4, 14, 4, '#c0c4ca'); blok(1, 4, 2, 10, '#6a7078'); blok(13, 4, 14, 10, '#6a7078'); lijn(2, 11, 13, 11, '#4e535c');
    for (const cx of [4, 11]) { for (let y = 10; y <= 14; y++) for (let x = cx - 2; x <= cx + 2; x++) { const d = Math.hypot(x - cx, y - 12); if (d < 2.3) zn(x, y, d < 1 ? '#c0c4ca' : '#3a3e46'); } }
    omlijn();
  };
  // ---------------- landbouw
  TEK.akker = () => {
    // voren in de aarde
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const voor = y % 4; zet(x, y, kies(PAL.aarde, voor === 0 ? 0.85 : voor === 3 ? 0.08 : 0.45 + (hs(x, y, 29) - 0.5) * 0.3, x, y, 0.6)); }
  };
  TEK.akker_nat = () => {
    const nat = P('#22140e', '#2e1c14', '#3c261a', '#4a3222', '#5a3e2a');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const voor = y % 4; zet(x, y, kies(nat, voor === 0 ? 0.85 : voor === 3 ? 0.06 : 0.42 + (hs(x, y, 29) - 0.5) * 0.3, x, y, 0.6)); }
    for (let x = 2; x < 16; x += 5) zet(x, 3, '#6a8aa8');
  };
  TEK.kiem_klein = () => { leeg(); for (const bx of [4, 11]) { zn(bx, 15, STEEL[1]); zn(bx, 14, STEEL[2]); zn(bx - 1, 13, STEEL[3]); zn(bx + 1, 13, STEEL[3]); } };
  TEK.kiem_groot = () => { leeg(); for (const bx of [3, 8, 12]) { for (let y = 11; y <= 15; y++) zn(bx, y, STEEL[1]); zn(bx - 1, 11, STEEL[3]); zn(bx + 1, 10, STEEL[3]); zn(bx - 1, 12, STEEL[2]); zn(bx + 1, 12, STEEL[2]); } };
  function gewasLoof(hoogte, kleur, extra) {
    leeg(); const r = rng(1223 + hoogte);
    for (let i = 0; i < 5; i++) { let x = 2 + i * 3; const h = hoogte - Math.floor(r() * 3); for (let k = 0; k < h; k++) { zn(x, 15 - k, kleur[k > h - 3 ? 2 : 1]); if (k > 2 && k % 2) { zn(x - 1, 15 - k, kleur[3]); zn(x + 1, 14 - k, kleur[0]); } if (r() < 0.25) x += r() < 0.5 ? 1 : -1; } }
    if (extra) extra(r);
  }
  const LOOF = P('#2c5a22', '#3d7a2e', '#5a9a3a', '#7cb84c');
  const GRAAN = P('#8a6a1a', '#b8902a', '#dcb440', '#f2d872');
  TEK.tarwe_jong = () => gewasLoof(9, LOOF);
  TEK.tarwe_rijp = () => gewasLoof(13, GRAAN, () => { for (let i = 0; i < 5; i++) { const x = 2 + i * 3; for (let y = 2; y <= 5; y++) { zn(x, y, GRAAN[y % 2 ? 3 : 2]); zn(x + 1, y + 1, GRAAN[1]); } } });
  TEK.aardappel_jong = () => gewasLoof(7, LOOF);
  TEK.aardappel_rijp = () => gewasLoof(9, LOOF, () => { for (const [x, y] of [[4, 6], [9, 5], [12, 7]]) { zn(x, y, '#ffffff'); zn(x + 1, y, '#e8d8f0'); zn(x, y - 1, '#f2e0ff'); } zn(5, 15, '#c89a5a'); zn(6, 15, '#b8864e'); zn(11, 15, '#c89a5a'); });
  TEK.wortel_jong = () => gewasLoof(6, LOOF);
  TEK.wortel_rijp = () => gewasLoof(9, LOOF, () => { for (const x of [4, 9, 12]) { zn(x, 15, '#e07b2e'); zn(x + 1, 15, '#c8601e'); zn(x, 14, '#f0954a'); } });
  TEK.biet_jong = () => gewasLoof(6, P('#3d5a22', '#4e7a2e', '#6a9a3a', '#8ab84c'));
  TEK.biet_rijp = () => gewasLoof(8, P('#3d5a22', '#4e7a2e', '#6a9a3a', '#8ab84c'), () => { for (const x of [3, 8, 12]) { blok(x, 13, x + 2, 15, '#efe6d2'); zn(x + 1, 13, '#ffffff'); zn(x, 15, '#d8ccb0'); } });
  TEK.pompoen_jong = () => gewasLoof(5, LOOF, () => { for (const x of [3, 11]) { blok(x, 12, x + 2, 14, LOOF[2]); zn(x + 1, 13, LOOF[3]); } });
  TEK.pompoen_rijp = () => gewasLoof(5, LOOF, () => { for (let y = 10; y <= 15; y++) for (let x = 4; x <= 11; x++) { const d = Math.hypot((x - 7.5) / 4, (y - 12.6) / 3); if (d < 1) zn(x, y, x % 3 === 0 ? '#c8601e' : y < 12 ? '#f6a040' : '#e07b2e'); } zn(7, 9, '#4e7a2e'); zn(8, 9, '#3d5a22'); });
  TEK.pompoen_zij = () => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const rib = x % 4; zet(x, y, rib === 0 ? '#b8541a' : rib === 1 ? '#e8822e' : rib === 2 ? '#f69a44' : '#d86e24'); } for (let x = 0; x < 16; x++) { zet(x, 0, '#c8641e'); zet(x, 15, '#a04a16'); } };
  TEK.pompoen_top = () => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const a = Math.atan2(y - 7.5, x - 7.5), rib = Math.floor((a + Math.PI) / (Math.PI / 4)) % 2; zet(x, y, rib ? '#e8822e' : '#d06a22'); } blok(7, 6, 8, 9, '#5a3a1a'); zet(7, 6, '#4e7a2e'); zet(8, 7, '#3d5a22'); };
  // ---------------- de smidse, sterrensteen en de oude kist
  TEK.smidse_zij = () => { ovenMuur(); for (let x = 0; x < 16; x++) { zet(x, 0, '#5e646c'); zet(x, 1, '#8a9099'); zet(x, 2, '#3a3e46'); } };
  TEK.smidse_top = () => {
    // een aambeeldplaat van ijzer met een hamer erop
    const m = PAL.ijzer; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) zet(x, y, kies(m, x === 0 || y === 0 ? 0.95 : x === 15 || y === 15 ? 0.05 : 0.45 + (hs(x, y, 41) - 0.5) * 0.2, x, y, 0.5));
    lijn(3, 12, 10, 5, '#7a4e2d'); lijn(4, 12, 11, 5, '#5a3820'); blok(9, 2, 13, 5, '#3a3e46'); lijn(9, 2, 13, 2, '#b8bdc4');
  };
  TEK.smidse_voor = () => {
    ovenMuur();
    for (let y = 6; y < 14; y++) for (let x = 3; x < 13; x++) { const t = (y - 6) / 8 + (hs(x, y, 43) - 0.5) * 0.3; zet(x, y, x === 3 || x === 12 || y === 6 ? '#3a3e46' : t > 0.7 ? '#ffd060' : t > 0.45 ? '#f07a20' : '#8a2a14'); }
    for (let x = 0; x < 16; x++) { zet(x, 0, '#5e646c'); zet(x, 1, '#8a9099'); zet(x, 2, '#3a3e46'); }
  };
  TEK.sterrensteen = () => {
    // donkerpaarse steen uit de ruimte met fonkelende puntjes
    kaart(P('#120e22', '#1e1834', '#2a2246', '#382e5a', '#463a6e'), veld(1224, 4, 3), 0.9);
    const r = rng(1225);
    for (let i = 0; i < 9; i++) { const x = 1 + Math.floor(r() * 14), y = 1 + Math.floor(r() * 14), k = r() < 0.5 ? '#fff4c0' : '#b8d8ff'; zet(x, y, k); if (r() < 0.6) { zet(x + 1, y, maal(k, 0.7)); zet(x, y + 1, maal(k, 0.7)); } }
  };
  TEK.buitkist_zij = () => { TEK.kist_zij(); for (let i = 0; i < 16; i++) { zet(i, 3, '#3a3e46'); zet(i, 12, '#3a3e46'); } const r = rng(1226); for (let n = 0; n < 8; n++) zet(Math.floor(r() * 16), Math.floor(r() * 16), '#4e6a3a'); };
  TEK.buitkist_top = () => { TEK.kist_top(); for (let i = 0; i < 16; i++) { zet(i, 4, '#3a3e46'); zet(i, 11, '#3a3e46'); } const r = rng(1227); for (let n = 0; n < 8; n++) zet(Math.floor(r() * 16), Math.floor(r() * 16), '#4e6a3a'); };
  TEK.buitkist_voor = () => { TEK.buitkist_zij(); blok(6, 5, 9, 9, '#5e646c'); blok(7, 6, 8, 7, '#b8bdc4'); zet(7, 8, '#16181c'); zet(8, 8, '#16181c'); };

  // ---------------- voorwerpen van ronde 2
  function verfpot(c) {
    leeg();
    for (let y = 6; y < 15; y++) for (let x = 4; x <= 11; x++) zn(x, y, y < 9 ? maal(c, x < 7 ? 1.15 : 0.9) : y < 13 ? (x < 6 ? '#fbf6e9' : '#e8dcc0') : maal(c, 0.7));
    blok(4, 4, 11, 5, '#8a9099'); lijn(4, 4, 11, 4, '#c0c4ca');
    zn(9, 6, maal(c, 1.3)); zn(9, 7, c); zn(6, 10, c); zn(7, 10, c); zn(8, 11, maal(c, 0.8));
    omlijn();
  }
  TEK.i_verf_wit = () => verfpot('#F2EFE6'); TEK.i_verf_beige = () => verfpot('#E8D39A'); TEK.i_verf_lichtblauw = () => verfpot('#5EAAE8'); TEK.i_verf_bruin = () => verfpot('#7A4E2D');
  for (const m of Object.keys(MATERIAAL)) TEK['i_schoffel_' + m] = () => {
    leeg(); stok(3, 13, 10, 6); const k = MATERIAAL[m];
    // een plat blad dwars op de steel
    for (let x = 8; x <= 14; x++) { zn(x, 3, k[x < 11 ? 3 : 2]); zn(x, 4, k[1]); } zn(13, 5, k[1]); zn(14, 5, k[0]); zn(9, 5, STEELHOUT[1]); zn(10, 5, STEELHOUT[2]);
    if (m === 'koper') zn(12, 3, '#5abf9a');
    omlijn();
  };
  // gereedschap met sterrenglans: hetzelfde plaatje met fonkelende puntjes
  for (const g of ['houweel', 'schop', 'bijl', 'zwaard', 'schoffel']) for (const m of Object.keys(MATERIAAL)) TEK['i_' + g + '_' + m + '_ster'] = () => {
    TEK['i_' + g + '_' + m]();
    for (const [x, y, k] of [[13, 1, '#fff4c0'], [14, 2, '#ffffff'], [12, 2, '#b8d8ff'], [2, 10, '#fff4c0'], [1, 11, '#ffffff'], [6, 1, '#b8d8ff']]) zn(x, y, k);
  };
  function zaadjes(kl, n, s) { leeg(); const r = rng(s); for (let i = 0; i < n; i++) { const x = 3 + Math.floor(r() * 10), y = 4 + Math.floor(r() * 9); zn(x, y, kl[0]); zn(x + 1, y, kl[1]); zn(x, y + 1, kl[2] || kl[1]); } omlijn(); }
  TEK.i_tarwezaad = () => zaadjes(['#dcb440', '#b8902a', '#8a6a1a'], 7, 1301);
  TEK.i_bietenzaad = () => zaadjes(['#9a6a4a', '#7a4e32', '#5a3a22'], 6, 1302);
  TEK.i_pompoenpit = () => { leeg(); for (const [x, y] of [[5, 6], [9, 9]]) { for (let k = 0; k < 4; k++) { zn(x + k, y + (k >> 1), '#f2e6c8'); zn(x + k, y + 1 + (k >> 1), '#dccca6'); } zn(x, y, '#ffffff'); } omlijn(); };
  TEK.i_tarwe = () => { leeg(); for (const bx of [5, 8, 11]) { lijn(bx - 2, 14, bx, 7, GRAAN[1]); for (let y = 2; y <= 7; y++) { zn(bx + (y % 2), y, GRAAN[y % 2 ? 3 : 2]); } } lijn(4, 11, 11, 11, '#8a6a1a'); omlijn(); };
  TEK.i_aardappel = () => { leeg(); for (let y = 5; y < 13; y++) for (let x = 3; x < 14; x++) { const d = Math.hypot((x - 8.5) / 5.2, (y - 9) / 3.6); if (d < 1) zn(x, y, kies(P('#8a6234', '#b0844a', '#cca064', '#e2bc82'), 1 - d * 0.6, x, y, 0.6)); } zn(6, 8, '#6a4a28'); zn(10, 10, '#6a4a28'); zn(9, 7, '#6a4a28'); omlijn(); };
  TEK.i_gepofte_aardappel = () => { leeg(); for (let y = 5; y < 13; y++) for (let x = 3; x < 14; x++) { const d = Math.hypot((x - 8.5) / 5.2, (y - 9) / 3.6); if (d < 1) zn(x, y, kies(P('#6a3e1a', '#8e5a28', '#b47a3a', '#d09a52'), 1 - d * 0.6, x, y, 0.6)); } blok(7, 7, 10, 8, '#fff0b0'); zn(8, 7, '#f2c230'); omlijn(); };
  TEK.i_wortel = () => { leeg(); for (let i = 0; i < 9; i++) { const x = 4 + i, y = 12 - i; zn(x, y, '#e07b2e'); zn(x + 1, y, '#c8601e'); if (i < 6) zn(x, y + 1, '#f0954a'); } lijn(12, 3, 14, 1, '#4e9c3c'); lijn(13, 4, 15, 3, '#3d7a2e'); zn(12, 2, '#7cb84c'); omlijn(); };
  TEK.i_suikerbiet = () => { leeg(); for (let y = 6; y < 14; y++) for (let x = 4; x < 13; x++) { const d = Math.hypot((x - 8) / 4.2, (y - 9) / 4) + (y > 11 ? (y - 11) * 0.1 : 0); if (d < 1) zn(x, y, kies(P('#c8bca0', '#ded2b6', '#efe6d2', '#ffffff'), 1 - d * 0.6, x, y, 0.5)); } zn(8, 14, '#c8bca0'); for (const [x, y] of [[7, 5], [8, 3], [9, 4], [10, 2]]) zn(x, y, '#4e9c3c'); omlijn(); };
  TEK.i_suiker = () => { leeg(); for (let y = 7; y < 14; y++) for (let x = 3; x < 13; x++) { if (y < 7 + Math.abs(x - 8) * 0.8) continue; zn(x, y, (x * 3 + y) % 4 ? '#ffffff' : '#e6e6ee'); } zn(7, 6, '#ffffff'); omlijn(); };
  TEK.i_brood = () => { leeg(); const k = P('#7a4a1a', '#a8682a', '#cc8a3e', '#e8ae5e'); for (let y = 5; y < 13; y++) for (let x = 2; x < 15; x++) { const d = Math.hypot((x - 8.5) / 6.4, (y - 9.5) / 4) ; if (d < 1 && y > 5) zn(x, y, kies(k, 1 - d * 0.55 - (y - 6) * 0.04, x, y, 0.6)); } for (const x of [5, 8, 11]) { zn(x, 7, '#f2d29a'); zn(x + 1, 8, '#f2d29a'); } omlijn(); };
  TEK.i_hutspot = () => kom(['#e8a040', '#f2c060', '#e07b2e', '#d8c090', '#f6d880']);
  TEK.i_pompoensoep = () => kom(['#e07b2e', '#f09a44', '#c8601e', '#ffd8a0', '#f6a040']);
  TEK.i_appelmoes = () => kom(['#f2e2a8', '#e8d48e', '#f8ecc0', '#dcc278', '#ffffff']);
  TEK.i_stroopwafel = () => {
    leeg(); const d = P('#8a5a22', '#b07a34', '#cc9a4e', '#e6b86a');
    for (let y = 3; y < 14; y++) for (let x = 2; x < 14; x++) { const r0 = Math.hypot(x - 7.5, y - 8.2); if (r0 < 5.6) zn(x, y, r0 > 4.8 ? d[0] : ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0) ? d[1] : d[3]); }
    lijn(3, 8, 12, 8, '#6a3e12'); omlijn();
  };
  TEK.i_kersen = () => { leeg(); for (const [x, y] of [[5, 11], [10, 11]]) { for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (a * a + b * b < 2.2) zn(x + a, y + b, a + b < 0 ? '#e02a3a' : '#a8162b'); zn(x - 1, y - 1, '#ffb0b8'); } lijn(5, 9, 8, 3, '#4a6a2a'); lijn(10, 9, 8, 3, '#4a6a2a'); zn(9, 2, '#5aaa48'); zn(10, 2, '#7cc85a'); omlijn(); };
  TEK.i_walnoot = () => { leeg(); for (let y = 4; y < 14; y++) for (let x = 3; x < 14; x++) { const dd = Math.hypot((x - 8.5) / 5, (y - 9) / 4.6); if (dd < 1) zn(x, y, x === 8 || x === 9 ? '#5a3e22' : kies(P('#6a4a2a', '#8a6638', '#a8824a', '#c49e62'), 1 - dd * 0.6 + hs(x, y, 51) * 0.2, x, y, 0.6)); } omlijn(); };
  TEK.i_papier = () => { leeg(); for (let y = 3; y < 14; y++) for (let x = 3; x < 13; x++) zn(x, y, x === 12 || y === 13 ? '#d8d0bc' : '#fbf6e9'); for (const y of [6, 8, 10]) lijn(5, y, 10, y, '#c8c0aa'); zn(12, 3, '#d8d0bc'); omlijn(); };
  TEK.i_kaart = () => {
    leeg();
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) { const land = Math.sin(x * 0.7) + Math.cos(y * 0.6) > 0.2; zn(x, y, x === 2 || y === 2 || x === 13 || y === 13 ? '#c8a060' : land ? ((x + y) % 4 ? '#8ac860' : '#6aa848') : '#6ab0e8'); }
    zn(9, 6, '#c8323c'); zn(8, 7, '#c8323c'); zn(10, 7, '#c8323c'); zn(9, 8, '#c8323c'); lijn(4, 11, 7, 9, '#7a4e2d'); omlijn();
  };
  TEK.i_sterrensplinter = () => { leeg(); const v = ['....#....', '...#h#...', '..#hmm#..', '.#hmmmd#.', '#hmmmmdd#', '.#mmmdd#.', '..#mdd#..', '...#d#...', '....#....'], k = { '#': '#2a2246', h: '#ffffff', m: '#b8d8ff', d: '#6a7ae8' }; for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const c = v[y][x]; if (c !== '.') zn(4 + x, 3 + y, k[c]); } zn(13, 3, '#fff4c0'); zn(2, 12, '#fff4c0'); omlijn(); };
  TEK.i_was = () => { leeg(); for (let y = 5; y < 13; y++) for (let x = 3; x < 13; x++) zn(x, y, y === 5 ? '#fff8e6' : x > 10 ? '#d8c690' : '#efe0b0'); zn(5, 7, '#ffffff'); omlijn(); };

  // ---------------- alles tekenen: eerst de blokken, dan de voorwerpen (eigen stapel)
  for (let i = 0; i < N + ND; i++) {
    const naam = i < N ? G.TEXNAMEN[i] : G.DTEXNAMEN[i - N];
    buf = new Uint8Array(1024);
    const f = TEK[naam];
    if (f) f();
    else {
      ontbreekt.push(naam);
      // terugval: rustige ruis in een kleur uit de naam
      const h = hs(naam.length, naam.charCodeAt(0), naam.charCodeAt(naam.length - 1));
      kaart([[90 + h * 120, 90, 120], [130 + h * 100, 130, 150], [170, 170 - h * 60, 180]], veld(i, 4, 2), 0.8);
    }
    if (i < N) data.set(buf, i * 1024); else ddata.set(buf, (i - N) * 1024);
  }
  buf = null;
  return { N, data, ND, ddata, ontbreekt };
}

// ============================================================================
// Iconen voor de rugzak: kubusjes en platte plaatjes, scherp op elke maat.
// ============================================================================
export function RB_ICONEN(G, T) {
  'use strict';
  const cache = new Map();
  const TINT = { 1: [0x6F, 0xB3, 0x4A], 2: [0x4E, 0x9E, 0x3A], 3: [0x3D, 0x8F, 0xD6] };
  // laag: een blokplaatje; laag + 4096: een plaatje uit de stapel van de voorwerpen
  const texel = (laag, x, y) => { const d = laag >= 4096 ? T.ddata : T.data, l = laag >= 4096 ? laag - 4096 : laag, i = l * 1024 + ((Math.max(0, Math.min(15, y | 0)) * 16 + Math.max(0, Math.min(15, x | 0))) * 4); return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
  // een vlak: laag, getint of niet, en een eventuele overlay (gras over de zijkant)
  function bron(laag, tint, overlay) {
    return (x, y) => {
      const c = texel(laag, x, y);
      if (tint && !overlay) { const t = Array.isArray(tint) ? tint : TINT[tint]; c[0] = Math.min(255, c[0] * t[0] / 255); c[1] = Math.min(255, c[1] * t[1] / 255); c[2] = Math.min(255, c[2] * t[2] / 255); }
      if (overlay) { const o = texel(laag + 1, x, y); if (o[3]) { const t = TINT[tint] || [255, 255, 255]; return [o[0] * t[0] / 255, o[1] * t[1] / 255, o[2] * t[2] / 255, 255]; } }
      return c;
    };
  }
  // dozen projecteren: wereld (x, y, z) in 0..1 naar het scherm; zichtbaar zijn boven (+y), links (+z) en rechts (+x)
  function dozen(maat, lijst) {
    const c = document.createElement('canvas'); c.width = c.height = maat; const g = c.getContext('2d'), img = g.createImageData(maat, maat), d = img.data;
    const s = 0.47, hh = 0.47, y0 = 0.03;
    const proj = (x, y, z) => [0.5 + (x - z) * s, y0 + (x + z) * s / 2 + (1 - y) * hh];
    const vlak = (O, A, B, f, schaduw, uv) => {
      // parallellogram O + a*A + b*B; omgekeerd uitrekenen per pixel
      const det = A[0] * B[1] - A[1] * B[0]; if (Math.abs(det) < 1e-9) return;
      const x0 = Math.max(0, Math.floor(Math.min(O[0], O[0] + A[0], O[0] + B[0], O[0] + A[0] + B[0]) * maat)), x1 = Math.min(maat - 1, Math.ceil(Math.max(O[0], O[0] + A[0], O[0] + B[0], O[0] + A[0] + B[0]) * maat));
      const y1a = Math.max(0, Math.floor(Math.min(O[1], O[1] + A[1], O[1] + B[1], O[1] + A[1] + B[1]) * maat)), y1b = Math.min(maat - 1, Math.ceil(Math.max(O[1], O[1] + A[1], O[1] + B[1], O[1] + A[1] + B[1]) * maat));
      for (let py = y1a; py <= y1b; py++) for (let px = x0; px <= x1; px++) {
        const qx = (px + 0.5) / maat - O[0], qy = (py + 0.5) / maat - O[1];
        const a = (qx * B[1] - qy * B[0]) / det, b = (A[0] * qy - A[1] * qx) / det;
        if (a < 0 || a >= 1 || b < 0 || b >= 1) continue;
        const [tx, ty] = uv(a, b), k = f(tx, ty); if (k[3] < 128) continue;
        const i = (py * maat + px) * 4; d[i] = k[0] * schaduw; d[i + 1] = k[1] * schaduw; d[i + 2] = k[2] * schaduw; d[i + 3] = 255;
      }
    };
    for (const b of lijst) {
      const [x0, y0b, z0, x1, y1, z1] = b.a.map(v => v / 16);
      // boven
      vlak(proj(x0, y1, z0), [proj(x1, y1, z0)[0] - proj(x0, y1, z0)[0], proj(x1, y1, z0)[1] - proj(x0, y1, z0)[1]], [proj(x0, y1, z1)[0] - proj(x0, y1, z0)[0], proj(x0, y1, z1)[1] - proj(x0, y1, z0)[1]], b.boven, 1, (a, bb) => [(x0 + a * (x1 - x0)) * 16, (z0 + bb * (z1 - z0)) * 16]);
      // links: +z vlak
      vlak(proj(x0, y1, z1), [proj(x1, y1, z1)[0] - proj(x0, y1, z1)[0], proj(x1, y1, z1)[1] - proj(x0, y1, z1)[1]], [0, (y1 - y0b) * hh], b.links, 0.8, (a, bb) => [(x0 + a * (x1 - x0)) * 16, (1 - (y1 - bb * (y1 - y0b))) * 16]);
      // rechts: +x vlak
      vlak(proj(x1, y1, z1), [proj(x1, y1, z0)[0] - proj(x1, y1, z1)[0], proj(x1, y1, z0)[1] - proj(x1, y1, z1)[1]], [0, (y1 - y0b) * hh], b.rechts, 0.62, (a, bb) => [(1 - (z1 - a * (z1 - z0))) * 16, (1 - (y1 - bb * (y1 - y0b))) * 16]);
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  function plat(maat, f) {
    const c = document.createElement('canvas'); c.width = c.height = maat; const g = c.getContext('2d'), img = g.createImageData(maat, maat), d = img.data;
    for (let py = 0; py < maat; py++) for (let px = 0; px < maat; px++) { const k = f(Math.floor(px * 16 / maat), Math.floor(py * 16 / maat)); if (!k || k[3] < 128) continue; const i = (py * maat + px) * 4; d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; d[i + 3] = 255; }
    g.putImageData(img, 0, 0); return c;
  }
  const PLAT = new Set(['kruis', 'fakkel', 'lantaarn', 'deur', 'ladder', 'lelie', 'luik']);
  // de kleuren van het palet (een tikje lichter, net als in de wereld)
  const PALRGB = G.PALET.map(p => { const n = parseInt(p[4].slice(1), 16); return [Math.min(300, ((n >> 16) & 255) * 1.1), Math.min(300, ((n >> 8) & 255) * 1.1), Math.min(300, (n & 255) * 1.1)]; });
  function maak(id, maat) {
    const it = G.IT[id]; if (!it) return plat(maat, () => null);
    if (!it.blok) return plat(maat, bron(it.tex + 4096));
    const b0 = G.BL[it.blok], b = it.kleur !== undefined ? Object.assign({}, b0, { tint: PALRGB[it.kleur] }) : b0;
    if (b.vorm === 'deur') { const bo = G.TEXNR.deur_boven; return plat(maat, (x, y) => (x < 4 || x > 11) ? null : texel(y < 8 ? bo : b.tz, (x - 4) * 2, (y % 8) * 2)); }
    if (b.vorm === 'hek') {
      // twee paaltjes met twee latten, in de kleur van de planken
      return plat(maat, (x, y) => { const paal = (x >= 3 && x <= 4) || (x >= 11 && x <= 12), lat = (y >= 4 && y <= 5) || (y >= 10 && y <= 11); if (paal && y >= 1) { const c = texel(b.tz, x * 3, y); return [c[0] * (x % 2 ? 0.8 : 1.05), c[1] * (x % 2 ? 0.8 : 1.05), c[2] * (x % 2 ? 0.8 : 1.05), 255]; } if (lat && x >= 1 && x <= 14) { const c = texel(b.tz, x, y); return [c[0] * (y % 2 ? 0.85 : 1), c[1] * (y % 2 ? 0.85 : 1), c[2] * (y % 2 ? 0.85 : 1), 255]; } if ((paal && y === 0) || (lat && (x === 0 || x === 15))) return [42, 30, 26, 255]; if ((y === 3 || y === 6 || y === 9 || y === 12) && x >= 1 && x <= 14 && !paal) return [42, 30, 26, 255]; if ((x === 2 || x === 5 || x === 10 || x === 13) && y >= 1) return [42, 30, 26, 255]; return null; });
    }
    if (PLAT.has(b.vorm)) { const laag = b.vorm === 'lelie' ? b.tz : b.tz; return plat(maat, bron(laag, b.tint)); }
    if (b.vorm === 'kubus') {
      const tz = bron(b.tz, b.tint, b.overlay), tv = b.stand === 'richting' ? bron(b.tv, b.tint) : tz;
      let boven = bron(b.tb, b.tint);
      return dozen(maat, [{ a: [0, 0, 0, 16, 16, 16], boven, links: tv, rechts: tz }]);
    }
    // andere vormen: de echte dozen uit de vormen, naar het zuiden gedraaid zodat de voorkant links te zien is
    const st = b.vorm === 'kist' || b.stand === 'richting' ? 2 : 0;
    let dz = G.vormDozen(it.blok | ((it.stand || st) << 8), null);
    // kleine vormen (bloempot, kaars) groter maken, zodat je ze in een vakje goed ziet
    if (b.vorm === 'pot' || b.vorm === 'kaars') {
      let x0 = 16, y0 = 16, z0 = 16, x1 = 0, y1 = 0, z1 = 0; for (const d of dz) { x0 = Math.min(x0, d[0]); y0 = Math.min(y0, d[1]); z0 = Math.min(z0, d[2]); x1 = Math.max(x1, d[3]); y1 = Math.max(y1, d[4]); z1 = Math.max(z1, d[5]); }
      const f = Math.min(2.2, 15 / Math.max(x1 - x0, y1 - y0, z1 - z0)), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      dz = dz.map(d => [8 + (d[0] - cx) * f, (d[1] - y0) * f, 8 + (d[2] - cz) * f, 8 + (d[3] - cx) * f, (d[4] - y0) * f, 8 + (d[5] - cz) * f].concat(d.slice(6)));
    }
    const lijst = dz.map(d => ({ a: d.slice(0, 6), boven: bron(d[8], b.tint), links: bron(d[10], b.tint), rechts: bron(d[6], b.tint) }));
    return dozen(maat, lijst);
  }
  function canvas(id, maat) { maat = maat || 48; const k = id + ':' + maat; if (!cache.has(k)) cache.set(k, { c: maak(id, maat), u: null }); return cache.get(k).c; }
  function icoon(id, maat) { maat = maat || 48; canvas(id, maat); const e = cache.get(id + ':' + maat); if (!e.u) e.u = e.c.toDataURL(); return e.u; }
  return { icoon, canvas };
}
