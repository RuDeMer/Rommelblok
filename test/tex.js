const UIT = require('./uit');
const L = require('./laad'); const G = L.gedeeld(); const RB_TEXTUREN = L.laad('texturen.js', 'RB_TEXTUREN'); const png = require('./png');
let t = performance.now(); const T = RB_TEXTUREN(G); const ms = performance.now() - t;
t = performance.now(); RB_TEXTUREN(G); console.log('tijd', ms.toFixed(1), 'ms (tweede keer', (performance.now() - t).toFixed(1), 'ms), lagen', T.N, 'ontbreekt', T.ontbreekt.length, T.ontbreekt.join(' '));
const opaak = new Set(), uit = new Set(), tint = {};
for (const b of G.BL) { if (!b || !b.id) continue; const ls = [b.tb, b.to, b.tz, b.tv, b.ta]; if (b.laag === 0) ls.forEach(l => opaak.add(l)); else if (b.laag === 1) ls.forEach(l => uit.add(l)); if (b.tint && b.tint < 3) { tint[b.tb] = b.tint; if (!b.overlay) tint[b.tz] = b.tint; else tint[b.tz + 1] = b.tint; } if (b.overlay) uit.add(b.tz + 1); }
for (const n of ['fakkel_houder', 'lantaarn_top', 'taart_binnen']) opaak.add(G.TEXNR[n]);
for (const n of G.TEXNAMEN) if (n.startsWith('i_') || n.startsWith('barst') || n === 'lantaarn_ketting' || n === 'deur_boven' || n === 'bessenstruik_vol') uit.add(G.TEXNR[n]);
const ov = new Set(G.BL.filter(b => b && b.overlay).map(b => b.tz + 1));
let fout = 0;
for (let l = 0; l < T.N; l++) {
  let a0 = 0, a255 = 0, half = 0;
  for (let i = 0; i < 256; i++) { const a = T.data[l * 1024 + i * 4 + 3]; if (a === 0) a0++; else if (a === 255) a255++; else half++; }
  const n = G.TEXNAMEN[l];
  if (opaak.has(l) && !uit.has(l) && !ov.has(l) && (a0 || half)) { console.log('niet opaak:', n, a0, half); fout++; }
  if (uit.has(l) && half && n !== 'ijs') { console.log('half doorzichtig:', n, half); fout++; }
  if (a0 === 256) { console.log('leeg:', n); fout++; }
}
// helderheid van getinte texturen
for (const l in tint) { let s = 0, n = 0, kleur = 0; for (let i = 0; i < 256; i++) { const o = l * 1024 + i * 4; if (!T.data[o + 3]) continue; const r = T.data[o], g = T.data[o + 1], b = T.data[o + 2]; s += (r + g + b) / 765; n++; kleur += Math.max(r, g, b) - Math.min(r, g, b); } console.log('getint', G.TEXNAMEN[l], 'helderheid', (s / n).toFixed(2), 'kleur', (kleur / n).toFixed(1)); }
// overzichtsplaat
const S = 4, K = 14, R = Math.ceil(T.N / K), W = K * (16 * S + 6), Hh = R * (16 * S + 6), img = Buffer.alloc(W * Hh * 3, 0);
for (let i = 0; i < W * Hh; i++) { img[i * 3] = 112; img[i * 3 + 1] = 112; img[i * 3 + 2] = 118; }
const TK = { 1: [0x6F, 0xB3, 0x4A], 2: [0x4E, 0x9E, 0x3A] };
for (let l = 0; l < T.N; l++) {
  const ox = (l % K) * (16 * S + 6) + 3, oy = Math.floor(l / K) * (16 * S + 6) + 3;
  for (let y = 0; y < 16 * S; y++) for (let x = 0; x < 16 * S; x++) {
    const o = l * 1024 + (Math.floor(y / S) * 16 + Math.floor(x / S)) * 4, a = T.data[o + 3] / 255, tk = TK[tint[l]];
    const p = ((oy + y) * W + ox + x) * 3;
    for (let c = 0; c < 3; c++) { const v = T.data[o + c] * (tk ? tk[c] / 255 : 1); img[p + c] = Math.round(img[p + c] * (1 - a) + v * a); }
  }
}
png(UIT + '/texturen_overzicht.png', W, Hh, img);
console.log(fout ? 'FOUTEN ' + fout : 'regels kloppen', '— rijen van', K, ':', G.TEXNAMEN.map((n, i) => (i % K === 0 ? '\n' + i + ': ' : '') + n).join(' '));
