// Recepten voor de werkbank en de oven, en het herkennen van een recept in een raster.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { B, HOUT, HOUT2, KLEUREN, PALET, STEEN2, STEENSOORT } from './blokken.js';
import { I, KLASSE, TAG, past } from './voorwerpen.js';

// ============================================================================
// Recepten
// ============================================================================
const REC = [], OVEN = [];
const n = s => (typeof s === 'string' && s[0] !== '#' ? (I[s] !== undefined ? I[s] : B[s]) : s);
function vorm(uit, aantal, patroon, sleutels, groep) {
  const k = {}; for (const c in sleutels) k[c] = n(sleutels[c]);
  REC.push({ uit: n(uit), aantal, patroon, sleutels: k, groep: groep || 'bouwen', w: patroon[0].length, h: patroon.length });
}
function los(uit, aantal, lijst, groep) { REC.push({ uit: n(uit), aantal, los: lijst.map(n), groep: groep || 'bouwen' }); }
function smelt(in_, uit, aantal) { OVEN.push({ in: n(in_), uit: n(uit), aantal: aantal || 1 }); }
HOUT.forEach(([s], i) => los('planken_' + s, 4, ['stam_' + s], 'basis'));
vorm('stok', 4, ['P', 'P'], { P: '#planken' }, 'basis');
vorm('werkbank', 1, ['PP', 'PP'], { P: '#planken' }, 'basis');
vorm('kist', 1, ['PPP', 'P P', 'PPP'], { P: '#planken' }, 'handig');
vorm('oven', 1, ['KKK', 'K K', 'KKK'], { K: 'kei' }, 'handig');
vorm('fakkel', 4, ['K', 'S'], { K: '#kolen', S: 'stok' }, 'licht');
vorm('lantaarn', 1, [' K ', 'GFG', ' K '], { K: 'koperstaaf', G: 'glas', F: 'fakkel' }, 'licht');
vorm('lichtblok', 2, ['GZG', 'ZOZ', 'GZG'], { G: 'glas', Z: 'gloeizwam', O: 'goudstaaf' }, 'licht');
vorm('deur', 3, ['PP', 'PP', 'PP'], { P: '#planken' }, 'bouwen');
vorm('luik', 2, ['PPP', 'PPP'], { P: '#planken' }, 'bouwen');
vorm('ladder', 3, ['S S', 'SSS', 'S S'], { S: 'stok' }, 'bouwen');
vorm('hek', 3, ['PSP', 'PSP'], { P: '#planken', S: 'stok' }, 'bouwen');
vorm('bed', 1, ['LLL', 'PPP'], { L: '#linnen', P: '#planken' }, 'handig');
vorm('kom', 4, ['P P', ' P '], { P: '#planken' }, 'eten');
vorm('emmer', 1, ['I I', ' I '], { I: 'ijzerstaaf' }, 'handig');
vorm('kompas', 1, [' K ', 'KRK', ' K '], { K: 'koperstaaf', R: 'robijn' }, 'handig');
vorm('klok', 1, [' G ', 'GKG', ' G '], { G: 'goudstaaf', K: '#kolen' }, 'handig');
vorm('boekenkast', 1, ['PPP', 'LLL', 'PPP'], { P: '#planken', L: '#linnen' }, 'bouwen');
vorm('hooi', 1, ['RRR', 'RRR', 'RRR'], { R: 'riet' }, 'bouwen');
los('riet', 9, ['hooi'], 'bouwen');
for (let k = 1; k <= 5; k++) {
  const m = KLASSE[k][5], s = KLASSE[k][0];
  vorm('houweel_' + s, 1, ['MMM', ' S ', ' S '], { M: m, S: 'stok' }, 'gereedschap');
  vorm('schop_' + s, 1, ['M', 'S', 'S'], { M: m, S: 'stok' }, 'gereedschap');
  vorm('bijl_' + s, 1, ['MM', 'MS', ' S'], { M: m, S: 'stok' }, 'gereedschap');
  vorm('zwaard_' + s, 1, ['M', 'M', 'S'], { M: m, S: 'stok' }, 'gereedschap');
}
vorm('steenstenen', 4, ['SS', 'SS'], { S: 'steen' }, 'bouwen');
vorm('zandsteen', 1, ['ZZ', 'ZZ'], { Z: 'zand' }, 'bouwen');
vorm('leitegels', 4, ['LL', 'LL'], { L: 'leisteen' }, 'bouwen');
vorm('mergelblokken', 4, ['MM', 'MM'], { M: 'mergel' }, 'bouwen');
los('mostkei', 1, ['kei', 'varen'], 'bouwen');
STEENSOORT.forEach(([s, , , , , , ], i) => {
  const m = s === 'hout' ? '#planken' : s === 'zandsteen' ? 'zandsteen' : s;
  vorm('trap_' + s, 4, ['M  ', 'MM ', 'MMM'], { M: m }, 'bouwen');
  vorm('plaat_' + s, 6, ['MMM'], { M: m }, 'bouwen');
});
// linnen en verf
vorm('linnendraad', 2, ['VV'], { V: 'vlas' }, 'kleur');
vorm('linnen_wit', 1, ['DD', 'DD'], { D: 'linnendraad' }, 'kleur');
TAG['#linnen'] = KLEUREN.map((k, i) => 80 + i);
KLEUREN.forEach(([s], i) => { if (i) los('linnen_' + s, 1, ['linnen_wit', 'verf_' + s], 'kleur'); });
los('verf_rood', 2, ['tulp_rood'], 'kleur'); los('verf_geel', 2, ['paardenbloem'], 'kleur'); los('verf_geel', 2, ['tulp_geel'], 'kleur');
los('verf_oranje', 2, ['tulp_oranje'], 'kleur'); los('verf_roze', 2, ['tulp_roze'], 'kleur'); los('verf_blauw', 2, ['korenbloem'], 'kleur');
los('verf_paars', 2, ['heide'], 'kleur'); los('verf_zwart', 2, ['#kolen'], 'kleur'); los('verf_paars', 2, ['verf_rood', 'verf_blauw'], 'kleur');
los('verf_oranje', 2, ['verf_rood', 'verf_geel'], 'kleur'); los('verf_roze', 2, ['verf_rood', 'linnendraad'], 'kleur');
los('tegel_delfts', 1, ['tegel_wit', 'verf_blauw'], 'kleur');
// grondstofblokken heen en terug
for (const [blk, st] of [['koperblok', 'koperstaaf'], ['ijzerblok', 'ijzerstaaf'], ['goudblok', 'goudstaaf'], ['robijnblok', 'robijn'], ['kolenblok', 'kolen']]) {
  vorm(blk, 1, ['SSS', 'SSS', 'SSS'], { S: st }, 'bouwen'); los(st, 9, [blk], 'bouwen');
}
// eten
los('soep', 1, ['kom', 'paddenstoel_bruin', 'paddenstoel_rood'], 'eten');
vorm('vlaai', 1, ['BBB', 'AAA', 'PPP'], { B: 'bessen', A: 'appel', P: '#planken' }, 'eten');
// oven
smelt('zand', 'glas'); smelt('kei', 'steen'); smelt('steen', 'gladde_steen'); smelt('klei', 'baksteen'); smelt('mergel', 'tegel_wit');
smelt('koperbrok', 'koperstaaf'); smelt('ijzerbrok', 'ijzerstaaf'); smelt('goudbrok', 'goudstaaf'); smelt('appel', 'gebakken_appel');
smelt('cactus', 'verf_groen'); smelt('modder', 'klei');
for (let i = 0; i < 6; i++) OVEN.push({ in: 24 + i, uit: I.houtskool, aantal: 1 });

// ---------------- ronde 2
// steen polijsten, trappen en platen
vorm('graniet_glad', 4, ['GG', 'GG'], { G: 'graniet' }, 'bouwen');
vorm('basalt_glad', 4, ['GG', 'GG'], { G: 'basalt' }, 'bouwen');
vorm('marmertegels', 4, ['GG', 'GG'], { G: 'marmer' }, 'bouwen');
STEEN2.forEach(([s2, , , t]) => { vorm('trap_' + s2, 4, ['M  ', 'MM ', 'MMM'], { M: t }, 'bouwen'); vorm('plaat_' + s2, 6, ['MMM'], { M: t }, 'bouwen'); });
smelt('steenstenen', 'gebarsten_steen');
// de nieuwe houtsoorten
HOUT2.forEach(([s2]) => los('planken_' + s2, 4, ['stam_' + s2], 'basis'));
// verf uit de nieuwe bloemen en vondsten, en mengen
los('verf_wit', 2, ['madelief'], 'kleur'); los('verf_rood', 2, ['klaproos'], 'kleur'); los('verf_paars', 2, ['lavendel'], 'kleur');
los('verf_geel', 2, ['zonnebloem'], 'kleur'); los('verf_lichtblauw', 2, ['vergeetmenietje'], 'kleur'); los('verf_bruin', 2, ['walnoot'], 'kleur');
los('verf_beige', 2, ['verf_geel', 'verf_wit'], 'kleur'); los('verf_lichtblauw', 2, ['verf_blauw', 'verf_wit'], 'kleur');
// per kleur van het palet: welke verf hoort erbij
const VERF = ['verf_wit', 'verf_beige', 'verf_geel', 'verf_oranje', 'verf_rood', 'verf_roze', 'verf_paars', 'verf_blauw', 'verf_lichtblauw', 'verf_groen', 'verf_bruin', 'verf_zwart'];
// gekleurd glas, pleisterwerk, geglazuurde tegels en tapijt: een basis, en daarna verven
vorm('pleister_wit', 4, ['MZ', 'ZM'], { M: 'mergel', Z: 'zand' }, 'kleur');
vorm('tapijt_wit', 3, ['LL'], { L: 'linnen_wit' }, 'kleur');
los('tegel_glazuur_wit', 4, ['tegel_wit', 'tegel_wit', 'tegel_wit', 'tegel_wit', 'verf_wit'], 'kleur');
PALET.forEach(([k], i) => {
  los('glas_kleur_' + k, 8, ['glas', 'glas', 'glas', 'glas', 'glas', 'glas', 'glas', 'glas', VERF[i]], 'kleur');
  if (i) {
    los('pleister_' + k, 8, ['pleister_wit', 'pleister_wit', 'pleister_wit', 'pleister_wit', 'pleister_wit', 'pleister_wit', 'pleister_wit', 'pleister_wit', VERF[i]], 'kleur');
    los('tegel_glazuur_' + k, 4, ['tegel_wit', 'tegel_wit', 'tegel_wit', 'tegel_wit', VERF[i]], 'kleur');
    los('tapijt_' + k, 8, ['tapijt_wit', 'tapijt_wit', 'tapijt_wit', 'tapijt_wit', 'tapijt_wit', 'tapijt_wit', 'tapijt_wit', 'tapijt_wit', VERF[i]], 'kleur');
  }
});
// decoratie
vorm('bloempot', 1, ['B B', ' B '], { B: 'baksteen' }, 'bouwen');
smelt('bessen', 'was');
vorm('kaars', 2, ['D', 'W'], { D: 'linnendraad', W: 'was' }, 'licht');
vorm('tafel', 1, ['PPP', 'S S'], { P: '#planken', S: 'stok' }, 'bouwen');
vorm('stoel', 2, ['P  ', 'PPP', 'S S'], { P: '#planken', S: 'stok' }, 'bouwen');
los('glas_in_lood', 4, ['glas', 'glas', 'glas', 'glas', 'verf_rood', 'verf_blauw', 'verf_geel'], 'bouwen');
vorm('schilderij', 1, ['SSS', 'SLS', 'SSS'], { S: 'stok', L: 'linnen_wit' }, 'bouwen');
vorm('mijnspoor', 8, ['I I', 'ISI', 'I I'], { I: 'ijzerstaaf', S: 'stok' }, 'bouwen');
vorm('stuwspoor', 6, ['G G', 'GSG', 'G G'], { G: 'goudstaaf', S: 'stok' }, 'bouwen');
vorm('klinkers', 4, ['BB', 'BB'], { B: 'baksteen' }, 'bouwen');
vorm('dakpannen', 4, ['KB', 'BK'], { K: 'klei', B: 'baksteen' }, 'bouwen');
vorm('trap_dakpannen', 4, ['M  ', 'MM ', 'MMM'], { M: 'dakpannen' }, 'bouwen'); vorm('plaat_dakpannen', 6, ['MMM'], { M: 'dakpannen' }, 'bouwen');
vorm('karretje', 1, ['I I', 'III'], { I: 'ijzerstaaf' }, 'handig');
// landbouw en eten
for (let k = 1; k <= 5; k++) vorm('schoffel_' + KLASSE[k][0], 1, ['MM', ' S', ' S'], { M: KLASSE[k][5], S: 'stok' }, 'gereedschap');
vorm('brood', 1, ['TTT'], { T: 'tarwe' }, 'eten');
smelt('aardappel', 'gepofte_aardappel');
los('suiker', 2, ['suikerbiet'], 'eten');
los('pompoenpit', 4, ['pompoen'], 'eten');
los('hutspot', 1, ['kom', 'aardappel', 'aardappel', 'wortel', 'wortel'], 'eten');
los('pompoensoep', 1, ['kom', 'pompoen'], 'eten');
los('stroopwafel', 2, ['tarwe', 'tarwe', 'suiker'], 'eten');
los('appelmoes', 1, ['kom', 'appel', 'appel', 'suiker'], 'eten');
vorm('kersenvlaai', 1, ['KKK', 'SSS', 'TTT'], { K: 'kersen', S: 'suiker', T: 'tarwe' }, 'eten');
vorm('appelvlaai', 1, ['AAA', 'SSS', 'TTT'], { A: 'appel', S: 'suiker', T: 'tarwe' }, 'eten');
// papier en de kaart, en de smidse
vorm('papier', 3, ['RRR'], { R: 'riet' }, 'handig');
vorm('kaart', 1, ['PP', 'PH'], { P: 'papier', H: '#kolen' }, 'handig');
vorm('smidse', 1, ['III', 'KSK', 'KKK'], { I: 'ijzerstaaf', K: 'kei', S: 'steenstenen' }, 'handig');
// oven: veen en de nieuwe stammen tot houtskool
smelt('veen', 'houtskool'); smelt('stam_kers', 'houtskool'); smelt('stam_noten', 'houtskool');

// ---------------- een recept herkennen in een raster (2 x 2 of 3 x 3)
function zoekRecept(raster, maat) {
  // raster: lijst met voorwerpnummers of 0, rij na rij
  let x0 = maat, y0 = maat, x1 = -1, y1 = -1;
  const ids = [];
  for (let y = 0; y < maat; y++) for (let x = 0; x < maat; x++) { const v = raster[y * maat + x]; if (v) { ids.push(v); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
  if (!ids.length) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  for (const r of REC) {
    if (r.los) {
      if (r.los.length !== ids.length) continue;
      const rest = ids.slice(); let ok = true;
      for (const s of r.los) { const j = rest.findIndex(v => past(s, v)); if (j < 0) { ok = false; break; } rest.splice(j, 1); }
      if (ok) return r;
      continue;
    }
    if (r.w !== w || r.h !== h || r.w > maat || r.h > maat) continue;
    for (const spiegel of [false, true]) {
      let ok = true;
      for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) {
        const c = r.patroon[y][spiegel ? w - 1 - x : x], v = raster[(y0 + y) * maat + x0 + x];
        if (c === ' ') { if (v) ok = false; } else if (!v || !past(r.sleutels[c], v)) ok = false;
      }
      if (ok) return r;
    }
  }
  return null;
}
const ovenRecept = id => OVEN.find(r => r.in === id) || null;

export {
  REC, OVEN, n, vorm, los, smelt, VERF, zoekRecept, ovenRecept,
};
