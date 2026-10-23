// Alle recepten: herkenbaar, niet dubbelzinnig, en elk voorwerp is in overleven te krijgen
const { gedeeld } = require('./laad'); const G = gedeeld(); const { REC, OVEN, IT, I, B, BL, TAG } = G;
let fouten = 0; const fout = t => { console.log('FOUT ' + t); fouten++; };
const nm = id => (IT[id] ? IT[id].sleutel : '?' + id);
const eerste = s => (typeof s === 'string' ? TAG[s][0] : s);
let getest = 0;
for (const r of REC) {
  const maten = r.los ? (r.los.length <= 4 ? [2, 3] : [3]) : (r.w <= 2 && r.h <= 2 ? [2, 3] : [3]);
  for (const maat of maten) for (const spiegel of [false, true]) for (const [ox, oy] of [[0, 0], [maat - (r.w || 1), maat - (r.h || 1)]]) {
    const raster = new Array(maat * maat).fill(0);
    if (r.los) { const vrij = maat === 2 ? [3, 0, 2, 1] : [4, 0, 8, 2, 6, 1, 3, 5, 7]; r.los.forEach((s, i) => { raster[vrij[(i + oy) % vrij.length]] = eerste(s); }); if (spiegel) continue; }
    else for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const c = r.patroon[y][spiegel ? r.w - 1 - x : x]; if (c !== ' ') raster[(y + oy) * maat + x + ox] = eerste(r.sleutels[c]); }
    const g = G.zoekRecept(raster, maat); getest++;
    if (!g) fout(`${nm(r.uit)} niet herkend (maat ${maat}${spiegel ? ', gespiegeld' : ''})`);
    else if (g.uit !== r.uit) fout(`${nm(r.uit)}: hetzelfde raster geeft ${nm(g.uit)} (dubbelzinnig)`);
  }
  // alle leden van een groep werken (bijvoorbeeld berkenplanken voor stokken)
  if (!r.los) for (const c in r.sleutels) { const s = r.sleutels[c]; if (typeof s !== 'string') continue; for (const id of TAG[s]) { const raster = new Array(9).fill(0); for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const k = r.patroon[y][x]; if (k !== ' ') raster[y * 3 + x] = k === c ? id : eerste(r.sleutels[k]); } const g = G.zoekRecept(raster, 3); if (!g || g.uit !== r.uit) fout(`${nm(r.uit)} met ${nm(id)} werkt niet`); } }
}
console.log('rasters getest:', getest, 'recepten:', REC.length, 'oven:', OVEN.length);
// bereikbaarheid: wat valt er uit de wereld, en wat kun je daarvan maken
const bereik = new Set();
for (const b of BL) if (b && b.geeft) { const g = typeof b.geeft === 'string' ? (I[b.geeft] !== undefined ? I[b.geeft] : B[b.geeft]) : b.geeft; if (IT[g]) bereik.add(g); }
// extra opbrengsten (zie opbrengst() in p6_doen.js) en wat er in de wereld groeit of ligt
for (const k of ['appel', 'stok', 'bessen', 'vlas', 'bessenstruik', 'kolen', 'grind', 'mostkei', 'waterlelie', 'riet', 'cactus', 'stekje_eik', 'stekje_berk', 'stekje_spar', 'stekje_esdoorn', 'stekje_baobab', 'stekje_wilg', 'blad_eik', 'wilgentak', 'paddenstoel_bruin', 'paddenstoel_rood', 'gloeizwam', 'druipsteen_hang', 'druipsteen_staand', 'kalksteen', 'klei', 'ijs',
  // ronde 2: uit bladeren, gras, wilde gewassen en de natuur
  'kersen', 'walnoot', 'stekje_kers', 'stekje_noten', 'tarwezaad', 'bietenzaad', 'aardappel', 'wortel', 'suikerbiet', 'pompoen', 'pompoenpit', 'tarwe', 'zonnebloem', 'klaproos', 'lavendel', 'madelief', 'vergeetmenietje', 'mos', 'klimop', 'graniet', 'basalt', 'marmer', 'veen', 'stam_kers', 'stam_noten', 'linnendraad', 'sterrensplinter'].filter(k => k !== 'ijs')) bereik.add(I[k] !== undefined ? I[k] : B[k]);
// bladeren krijg je met een zwaard
for (const s of ['blad_eik', 'blad_berk', 'blad_spar', 'blad_esdoorn', 'blad_baobab', 'blad_wilg', 'blad_esdoorn_oranje', 'blad_esdoorn_geel', 'blad_kers', 'blad_noten']) bereik.add(B[s]);
// stap 4: wat dieren en griezels laten vallen (shared/wezens.js), en eieren van kippen
for (const w of G.WEZENS.WEZENS) for (const [k] of w.buit) bereik.add(I[k] !== undefined ? I[k] : B[k]);
bereik.add(I.ei);
let meer = true;
const heeft = s => (typeof s === 'string' && s[0] === '#' ? TAG[s].some(id => bereik.has(id)) : bereik.has(s));
while (meer) {
  meer = false;
  for (const r of REC) { if (bereik.has(r.uit)) continue; const ing = r.los ? r.los : Object.values(r.sleutels); if (ing.every(heeft)) { bereik.add(r.uit); meer = true; } }
  for (const o of OVEN) if (!bereik.has(o.uit) && bereik.has(o.in)) { bereik.add(o.uit); meer = true; }
  if (bereik.has(I.emmer) && !bereik.has(I.emmer_water)) { bereik.add(I.emmer_water); meer = true; }
  // melken: een lege emmer bij een koe
  if (bereik.has(I.emmer) && !bereik.has(I.emmer_melk)) { bereik.add(I.emmer_melk); meer = true; }
  // de smidse: gereedschap met een sterrensplinter krijgt sterrenglans
  IT.forEach((it, id) => { if (it && it.ster && !bereik.has(id) && bereik.has(it.basis) && bereik.has(I.sterrensplinter) && bereik.has(B.smidse)) { bereik.add(id); meer = true; } });
}
const niet = IT.map((it, id) => (it && !bereik.has(id) ? it.sleutel : null)).filter(Boolean).filter(k => !['rugzak', 'taartpunt'].includes(k));
// blokken die (net als echt) iets anders opleveren: alleen in de bouwstand te pakken
const ALLEEN_BOUWEN = ['gras', 'ijs', 'bosgrond', 'sneeuwgras', 'hooggras', 'varen', 'dorre_struik', 'erts_kolen', 'erts_koper', 'erts_ijzer', 'erts_goud', 'erts_ijzer_lei', 'erts_goud_lei', 'erts_robijn',
  // ronde 2: deze leveren iets anders op (spinnenweb: draad, akker: aarde, sterrensteen: splinters, oude kist: een kist)
  'spinnenweb', 'akker', 'sterrensteen', 'buitkist'];
for (let i = niet.length - 1; i >= 0; i--) if (ALLEEN_BOUWEN.includes(niet[i])) niet.splice(i, 1);
if (niet.length) fout('niet te krijgen in overleven: ' + niet.join(', '));
else console.log('elk voorwerp is in overleven te krijgen (' + bereik.size + ')');
// texturen voor alles
for (const it of IT) if (it && (it.tex == null || it.tex >= G.TEXNAMEN.length)) fout('geen textuur voor ' + it.sleutel);
// overlay staat direct na de zijkant
for (const b of BL) if (b && b.overlay && G.TEXNAMEN[b.tz + 1] !== G.TEXNAMEN[b.tz] + '_over') fout('overlay niet na zijkant bij ' + b.sleutel);
console.log(fouten ? fouten + ' FOUTEN' : 'alle recepttests goed');
process.exit(fouten ? 1 : 0);
