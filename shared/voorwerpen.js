// Voorwerpen: blokken (1 tot 255) en dingen (256 en hoger), gereedschap, groepen voor het bouwmenu.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { B, BL, KLEUREN, MAXBLOK, PALET, dtex } from './blokken.js';

// ============================================================================
// Voorwerpen: blokken (1 tot 255) en dingen (256 en hoger)
// ============================================================================
const IT = [], I = {};
function ding(id, sleutel, nl, en, e) { const d = Object.assign({ id, sleutel, nl, en, stapel: 64, tex: dtex('i_' + sleutel), ding: true }, e || {}); IT[id] = d; I[sleutel] = id; return d; }
for (let i = 1; i < MAXBLOK; i++) { const b = BL[i]; if (b && b.item) { IT[i] = { id: i, sleutel: b.sleutel, nl: b.nl, en: b.en, stapel: 64, blok: i, nietInMenu: b.nietInMenu }; I[b.sleutel] = i; } }
ding(256, 'stok', 'Stok', 'Stick', { brand: 5 });
ding(257, 'kolen', 'Kolen', 'Coal', { brand: 80 });
ding(258, 'houtskool', 'Houtskool', 'Charcoal', { brand: 80 });
ding(259, 'koperbrok', 'Koperbrok', 'Copper lump');
ding(260, 'ijzerbrok', 'IJzerbrok', 'Iron lump');
ding(261, 'goudbrok', 'Goudbrok', 'Gold lump');
ding(262, 'koperstaaf', 'Koperstaaf', 'Copper bar');
ding(263, 'ijzerstaaf', 'IJzerstaaf', 'Iron bar');
ding(264, 'goudstaaf', 'Goudstaaf', 'Gold bar');
ding(265, 'robijn', 'Robijn', 'Ruby');
ding(266, 'appel', 'Appel', 'Apple', { eten: 4 });
ding(267, 'gebakken_appel', 'Gebakken appel', 'Baked apple', { eten: 7 });
ding(268, 'bessen', 'Bessen', 'Berries', { eten: 2 });
ding(269, 'soep', 'Paddenstoelensoep', 'Mushroom soup', { eten: 9, stapel: 1, rest: 'kom' });
ding(270, 'kom', 'Kom', 'Bowl', { brand: 5 });
ding(271, 'emmer', 'Emmer', 'Bucket', { stapel: 16 });
ding(272, 'emmer_water', 'Emmer met water', 'Water bucket', { stapel: 1 });
ding(273, 'kompas', 'Kompas', 'Compass', { stapel: 1 });
ding(274, 'klok', 'Klok', 'Clock', { stapel: 1 });
ding(275, 'vlaaipunt', 'Punt vlaai', 'Slice of vlaai', { eten: 5 });
ding(276, 'linnendraad', 'Linnendraad', 'Linen thread');
KLEUREN.forEach(([s, , en, bijv], i) => { if (i) ding(277 + i - 1, 'verf_' + s, bijv + ' verf', en + ' dye'); });
ding(285, 'rugzak', 'Achtergelaten rugzak', 'Left-behind backpack', { stapel: 1 });
// ronde 2: verf in de kleuren die nog ontbraken, landbouw en eten, papier en de kaart, en zeldzame vondsten
ding(340, 'verf_wit', 'Witte verf', 'White dye'); ding(341, 'verf_beige', 'Manilla verf', 'Manila dye');
ding(342, 'verf_lichtblauw', 'Hemelsblauwe verf', 'Sky blue dye'); ding(343, 'verf_bruin', 'Bruine verf', 'Brown dye');
ding(344, 'tarwezaad', 'Tarwezaad', 'Wheat seeds', { plant: 'gewas_tarwe' });
ding(345, 'tarwe', 'Tarwe', 'Wheat');
ding(346, 'aardappel', 'Aardappel', 'Potato', { eten: 1, plant: 'gewas_aardappel' });
ding(347, 'gepofte_aardappel', 'Gepofte aardappel', 'Baked potato', { eten: 6 });
ding(348, 'wortel', 'Wortel', 'Carrot', { eten: 3, plant: 'gewas_wortel' });
ding(349, 'bietenzaad', 'Bietenzaad', 'Beet seeds', { plant: 'gewas_biet' });
ding(350, 'suikerbiet', 'Suikerbiet', 'Sugar beet', { eten: 1 });
ding(351, 'suiker', 'Suiker', 'Sugar');
ding(352, 'pompoenpit', 'Pompoenpit', 'Pumpkin seed', { plant: 'gewas_pompoen' });
ding(353, 'brood', 'Brood', 'Bread', { eten: 5 });
ding(354, 'hutspot', 'Hutspot', 'Hutspot stew', { eten: 10, stapel: 1, rest: 'kom' });
ding(355, 'pompoensoep', 'Pompoensoep', 'Pumpkin soup', { eten: 7, stapel: 1, rest: 'kom' });
ding(356, 'stroopwafel', 'Stroopwafel', 'Syrup waffle', { eten: 3 });
ding(357, 'appelmoes', 'Appelmoes', 'Apple sauce', { eten: 6, stapel: 1, rest: 'kom' });
ding(358, 'kersen', 'Kersen', 'Cherries', { eten: 2 });
ding(359, 'walnoot', 'Walnoot', 'Walnut', { eten: 2 });
ding(360, 'papier', 'Papier', 'Paper');
ding(361, 'kaart', 'Kaart', 'Map', { stapel: 1 });
ding(362, 'sterrensplinter', 'Sterrensplinter', 'Star shard');
ding(363, 'was', 'Was', 'Wax');
ding(364, 'karretje', 'Karretje', 'Cart', { stapel: 1 });
// gereedschap
const KLASSE = [null, ['hout', 'Houten', 'Wooden', 2, 60, '#planken'], ['steen', 'Stenen', 'Stone', 4, 132, 'kei'], ['koper', 'Koperen', 'Copper', 5, 200, 'koperstaaf'], ['ijzer', 'IJzeren', 'Iron', 6.5, 260, 'ijzerstaaf'], ['robijn', 'Robijnen', 'Ruby', 9, 1600, 'robijn']];
const GEREED = [['houweel', 'houweel', 'pickaxe'], ['schop', 'schop', 'shovel'], ['bijl', 'bijl', 'axe'], ['zwaard', 'zwaard', 'sword']];
let gid = 300;
for (let k = 1; k <= 5; k++) for (const [g, nl, en] of GEREED) {
  const K = KLASSE[k];
  ding(gid++, g + '_' + K[0], K[1] + ' ' + nl, K[2] + ' ' + en, { stapel: 1, gereed: g, klasse: k, snel: K[3], duur: K[4], brand: k === 1 ? 10 : 0, tex: dtex('i_' + g + '_' + K[0]) });
}
// ---------------- groepen voor het bouwmenu (bouwstand): elk voorwerp staat in precies één groep
const NATUURLIJK = new Set(['gras', 'aarde', 'zand', 'grind', 'klei', 'sneeuw', 'ijs', 'modder', 'bosgrond', 'leisteen', 'mergel', 'sneeuwgras', 'zandsteen', 'steen', 'bodemsteen']);
const WERKBLOKKEN = new Set(['werkbank', 'oven', 'oven_aan', 'kist']);
function bouwGroep(id) {
  const it = IT[id]; if (!it) return null;
  if (it.groep) return it.groep;
  if (!it.blok) { if (it.gereed || ['emmer', 'emmer_water', 'kompas', 'klok'].includes(it.sleutel)) return 'werk'; if (it.eten) return 'eten'; return 'spul'; }
  const b = BL[it.blok], k = b.sleutel;
  if (b.groep) return b.groep;
  if (WERKBLOKKEN.has(k)) return 'werk';
  if (k === 'vlaai') return 'eten';
  if (k.startsWith('linnen_')) return 'kleur';
  if (k.startsWith('stam_') || k.startsWith('planken_') || ['trap_hout', 'plaat_hout', 'deur', 'luik', 'ladder', 'hek'].includes(k)) return 'hout';
  if (NATUURLIJK.has(k) || k.startsWith('erts_') || k.startsWith('blad_') || b.vorm === 'kruis' || b.vorm === 'lelie' || b.vorm === 'cactus' || b.laag === 1 && b.vorm !== 'kubus' && !b.licht) return 'natuur';
  if (b.licht) return 'licht';
  if (['bed', 'boekenkast', 'hooi'].includes(k)) return 'deco';
  return 'bouw';
}
// de arm in beeld: een mouw en een hand (de hand wordt in de huidskleur getint)
dtex('arm_mouw'); dtex('arm_huid');
for (let k = 1; k <= 5; k++) { const K = KLASSE[k]; ding(319 + k, 'schoffel_' + K[0], K[1] + ' schoffel', K[2] + ' hoe', { stapel: 1, gereed: 'schoffel', klasse: k, snel: K[3], duur: K[4], brand: k === 1 ? 10 : 0, tex: dtex('i_schoffel_' + K[0]) }); }
// gereedschap met sterrenglans (verbeterd in de smidse met een sterrensplinter): 500 en hoger, gaat 1,5 keer zo lang mee en hakt 20% sneller
for (let gid2 = 300; gid2 <= 324; gid2++) {
  const g = IT[gid2]; if (!g) continue;
  IT[500 + gid2 - 300] = Object.assign({}, g, { id: 500 + gid2 - 300, sleutel: g.sleutel + '_ster', nl: g.nl + ' met sterrenglans', en: g.en + ' with starlight', snel: g.snel * 1.2, duur: Math.round(g.duur * 1.5), ster: true, basis: gid2, tex: dtex('i_' + g.sleutel + '_ster'), brand: 0 });
  I[g.sleutel + '_ster'] = 500 + gid2 - 300; g.sterVersie = 500 + gid2 - 300;
}
// gekleurde blokken: per familie 12 voorwerpen (400 en hoger), die het blok met de kleur in de stand neerzetten
const KLEURFAM = [[141, 'glas_kleur', (p) => p[1] + ' glas', (p) => p[2] + ' glass'], [142, 'pleister', (p) => p[1] + ' pleisterwerk', (p) => p[2] + ' plaster'],
  [143, 'tegel_glazuur', (p) => p[3] + ' geglazuurde tegel', (p) => p[2] + ' glazed tile'], [144, 'tapijt', (p) => p[1] + ' tapijt', (p) => p[2] + ' carpet']];
const KLEURITEM = {};
KLEURFAM.forEach(([bid, sl, nl, en], f) => {
  KLEURITEM[bid] = [];
  PALET.forEach((p, k) => { const id = 400 + f * 12 + k; IT[id] = { id, sleutel: sl + '_' + p[0], nl: nl(p), en: en(p), stapel: 64, blok: bid, stand: k, kleur: k }; I[IT[id].sleutel] = id; KLEURITEM[bid].push(id); });
});
// welk voorwerp hoort bij een blokwaarde (voor oppakken, kiezen en opbrengst)
function itemVan(v) { const id = v & 255, b = BL[id]; if (!b) return 0; if (b.kleur) return KLEURITEM[id][Math.min(11, (v >> 8) & 15)]; return IT[id] ? id : 0; }
// brandstof van blokken
for (let i = 0; i < 6; i++) { IT[24 + i].brand = 15; IT[36 + i].brand = 15; IT[65 + i].brand = 5; }
for (const s of ['werkbank', 'kist', 'boekenkast', 'hek', 'ladder', 'luik', 'trap_hout', 'plaat_hout']) IT[B[s]].brand = 15;
IT[B.kolenblok].brand = 720; IT[B.hooi].brand = 20;
for (const s2 of ['stam_kers', 'stam_noten', 'planken_kers', 'planken_noten', 'tafel', 'stoel']) IT[B[s2]].brand = 15;
IT[B.stekje_kers].brand = 5; IT[B.stekje_noten].brand = 5; IT[B.veen].brand = 40; IT[I.papier].brand = 2;
for (const id in IT) if (IT[id] && IT[id].blok) IT[id].tex = BL[IT[id].blok].tz;

// tags
const TAG = { '#planken': [36, 37, 38, 39, 40, 41, B.planken_kers, B.planken_noten], '#stam': [24, 25, 26, 27, 28, 29, B.stam_kers, B.stam_noten], '#kolen': [I.kolen, I.houtskool] };
const past = (sleutel, id) => (typeof sleutel === 'string' && sleutel[0] === '#' ? TAG[sleutel].includes(id) : sleutel === id);

export {
  IT, I, ding, KLASSE, GEREED, gid, NATUURLIJK, WERKBLOKKEN, bouwGroep, KLEURFAM, KLEURITEM, itemVan, TAG, past,
};
