// Alle blokken, hun texturen en de snelle tabellen voor de rekenhulpjes.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).

// ============================================================================
// Blokken. Een blokwaarde is een getal van 16 bits: de onderste 8 bits zijn het blok, de bovenste 8 de stand.
// ============================================================================
const TEXNAMEN = [], TEXNR = {};
const tex = n => { if (!(n in TEXNR)) { TEXNR[n] = TEXNAMEN.length; TEXNAMEN.push(n); } return TEXNR[n]; };
// plaatjes van voorwerpen (gereedschap, eten, grondstoffen) en de arm staan in een eigen stapel, zodat er voor blokken plek genoeg blijft
const DTEXNAMEN = [], DTEXNR = {};
const dtex = n => { if (!(n in DTEXNR)) { DTEXNR[n] = DTEXNAMEN.length; DTEXNAMEN.push(n); } return DTEXNR[n]; };
const BL = [], B = {};
// laag: 0 vast, 1 uitgesneden (bladeren, glas, planten), 2 water
// vorm: kubus, kruis, fakkel, lantaarn, plaat, trap, deur, luik, ladder, hek, bed, kist, cactus, water, lelie, laag (dun laagje)
function blok(id, sleutel, nl, en, e) {
  e = e || {};
  const d = {
    id, sleutel, nl, en, vorm: e.vorm || 'kubus', laag: e.laag || 0, licht: e.licht || 0,
    hard: e.hard == null ? 1 : e.hard, gereed: e.gereed || null, klasse: e.klasse || 0,
    geluid: e.geluid || 'steen', tint: e.tint || 0, zwaai: !!e.zwaai, gloed: !!e.gloed,
    geeft: e.geeft === undefined ? id : e.geeft, vervang: !!e.vervang, wasweg: !!e.wasweg,
    item: e.item === undefined ? true : e.item, stand: e.stand || null, plaatsOp: e.plaatsOp || null,
    overlay: !!e.overlay, rot: !!e.rot, as: !!e.as, gebruik: e.gebruik || null,
    kleur: !!e.kleur, groep: e.groep || null, nietInMenu: !!e.nietInMenu,
  };
  const t = e.tex || sleutel;
  const f = typeof t === 'string' ? { boven: t, onder: t, zij: t } : Object.assign({ boven: t.zij, onder: t.zij }, t);
  // de overlay (gras over de zijkant) staat altijd direct na de zijkant in de textuurstapel
  d.tz = tex(f.zij); if (e.overlay) tex(f.zij + '_over');
  d.tb = tex(f.boven); d.to = tex(f.onder); d.tv = tex(f.voor || f.zij); d.ta = tex(f.achter || f.zij);
  if (f.extra) for (const x of f.extra) tex(x);
  const kub = d.vorm === 'kubus';
  d.dicht = kub && d.laag === 0 && !e.nietDicht;           // vult de hele ruimte en houdt licht tegen
  d.vast = e.vast === undefined ? (d.vorm !== 'kruis' && d.vorm !== 'water' && d.vorm !== 'lelie' && d.vorm !== 'fakkel' && id !== 0) : e.vast;
  d.demp = e.demp !== undefined ? e.demp : d.dicht ? 15 : 0;
  BL[id] = d; B[sleutel] = id;
  return d;
}
blok(0, 'lucht', 'Lucht', 'Air', { vorm: 'niets', item: false, vast: false, demp: 0, vervang: true, tex: 'aarde' });
BL[0].dicht = false;
// natuur
blok(1, 'gras', 'Grasblok', 'Grass block', { tex: { boven: 'gras_top', onder: 'aarde', zij: 'gras_zij' }, tint: 1, overlay: true, hard: 0.6, gereed: 'schop', geluid: 'gras', geeft: 2 });
blok(2, 'aarde', 'Aarde', 'Dirt', { hard: 0.5, gereed: 'schop', geluid: 'aarde' });
blok(3, 'steen', 'Steen', 'Stone', { hard: 1.5, gereed: 'houweel', klasse: 1, geeft: 4 });
blok(4, 'kei', 'Keien', 'Cobbles', { hard: 2, gereed: 'houweel', klasse: 1 });
blok(5, 'zand', 'Zand', 'Sand', { hard: 0.5, gereed: 'schop', geluid: 'zand' });
blok(6, 'grind', 'Grind', 'Gravel', { hard: 0.6, gereed: 'schop', geluid: 'grind' });
blok(7, 'klei', 'Klei', 'Clay', { hard: 0.6, gereed: 'schop', geluid: 'aarde' });
blok(8, 'zandsteen', 'Zandsteen', 'Sandstone', { tex: { boven: 'zandsteen_top', onder: 'zandsteen_top', zij: 'zandsteen' }, hard: 0.8, gereed: 'houweel', klasse: 1 });
blok(9, 'sneeuw', 'Sneeuw', 'Snow', { hard: 0.3, gereed: 'schop', geluid: 'sneeuw' });
blok(10, 'ijs', 'IJs', 'Ice', { laag: 2, hard: 0.5, gereed: 'houweel', geluid: 'glas', geeft: 0, demp: 1, nietDicht: true });
blok(11, 'modder', 'Modder', 'Mud', { hard: 0.5, gereed: 'schop', geluid: 'modder' });
blok(12, 'bosgrond', 'Bosgrond', 'Forest floor', { tex: { boven: 'bosgrond_top', onder: 'aarde', zij: 'bosgrond_zij' }, hard: 0.5, gereed: 'schop', geluid: 'aarde', geeft: 2 });
blok(13, 'bodemsteen', 'Bodemsteen', 'Bottom stone', { hard: -1, item: false, geeft: 0 });
blok(14, 'leisteen', 'Leisteen', 'Slate', { hard: 3, gereed: 'houweel', klasse: 1 });
blok(15, 'water', 'Water', 'Water', { vorm: 'water', laag: 2, hard: -1, item: false, geeft: 0, demp: 2, vervang: true, tint: 3, geluid: 'water' });
blok(16, 'erts_kolen', 'Kolenerts', 'Coal ore', { hard: 3, gereed: 'houweel', klasse: 1, geeft: 'kolen' });
blok(17, 'erts_koper', 'Kopererts', 'Copper ore', { hard: 3, gereed: 'houweel', klasse: 2, geeft: 'koperbrok' });
blok(18, 'erts_ijzer', 'IJzererts', 'Iron ore', { hard: 3, gereed: 'houweel', klasse: 3, geeft: 'ijzerbrok' });
blok(19, 'erts_goud', 'Gouderts', 'Gold ore', { hard: 3, gereed: 'houweel', klasse: 4, geeft: 'goudbrok' });
blok(20, 'erts_ijzer_lei', 'IJzererts in leisteen', 'Iron ore in slate', { hard: 4, gereed: 'houweel', klasse: 3, geeft: 'ijzerbrok' });
blok(21, 'erts_goud_lei', 'Gouderts in leisteen', 'Gold ore in slate', { hard: 4, gereed: 'houweel', klasse: 4, geeft: 'goudbrok' });
blok(22, 'erts_robijn', 'Robijnerts', 'Ruby ore', { hard: 4.5, gereed: 'houweel', klasse: 4, geeft: 'robijn' });
blok(23, 'mergel', 'Mergel', 'Marl', { hard: 0.9, gereed: 'houweel', klasse: 1 });
// hout: stam, bladeren en planken van zes bomen
const HOUT = [['eik', 'Eiken', 'Oak'], ['berk', 'Berken', 'Birch'], ['spar', 'Sparren', 'Spruce'], ['esdoorn', 'Esdoorn', 'Maple'], ['baobab', 'Baobab', 'Baobab'], ['wilg', 'Wilgen', 'Willow']];
HOUT.forEach(([s, nl, en], i) => {
  blok(24 + i, 'stam_' + s, nl + 'stam', en + ' log', { tex: { boven: 'stam_' + s + '_ring', onder: 'stam_' + s + '_ring', zij: 'stam_' + s }, hard: 2, gereed: 'bijl', geluid: 'hout', as: true });
  blok(36 + i, 'planken_' + s, nl + 'planken', en + ' planks', { hard: 2, gereed: 'bijl', geluid: 'hout' });
});
// bladeren: 30 tot 35 horen bij de zes bomen, 42 en 43 zijn extra herfstkleuren. Getinte bladeren krijgen de kleur van de streek.
[[30, 'eik', 'Eikenbladeren', 'Oak leaves', 2], [31, 'berk', 'Berkenbladeren', 'Birch leaves', 2], [32, 'spar', 'Sparrennaalden', 'Spruce needles', 2], [33, 'esdoorn', 'Rode esdoornbladeren', 'Red maple leaves', 0],
  [34, 'baobab', 'Baobabbladeren', 'Baobab leaves', 2], [35, 'wilg', 'Wilgenbladeren', 'Willow leaves', 2], [42, 'esdoorn_oranje', 'Oranje bladeren', 'Orange leaves', 0], [43, 'esdoorn_geel', 'Gele bladeren', 'Yellow leaves', 0]]
  .forEach(([id, s, nl, en, tint]) => blok(id, 'blad_' + s, nl, en, { laag: 1, hard: 0.2, gereed: 'zwaard', geluid: 'blad', tint, zwaai: true, demp: 1, geeft: 0 }));
// planten
const plant = (id, s, nl, en, e) => blok(id, s, nl, en, Object.assign({ vorm: 'kruis', laag: 1, hard: 0, geluid: 'gras', zwaai: true, vervang: false, wasweg: true, plaatsOp: 'grond' }, e));
plant(44, 'hooggras', 'Hoog gras', 'Tall grass', { tint: 1, vervang: true, geeft: 0 });
plant(45, 'varen', 'Varen', 'Fern', { tint: 1, vervang: true, geeft: 0 });
plant(46, 'dorre_struik', 'Dorre struik', 'Dry shrub', { vervang: true, geeft: 'stok', plaatsOp: 'zand' });
plant(47, 'tulp_rood', 'Rode tulp', 'Red tulip');
plant(48, 'tulp_geel', 'Gele tulp', 'Yellow tulip');
plant(49, 'tulp_oranje', 'Oranje tulp', 'Orange tulip');
plant(50, 'tulp_roze', 'Roze tulp', 'Pink tulip');
plant(51, 'paardenbloem', 'Paardenbloem', 'Dandelion');
plant(52, 'korenbloem', 'Korenbloem', 'Cornflower');
plant(53, 'heide', 'Heide', 'Heather');
plant(54, 'vlas', 'Vlas', 'Flax');
plant(55, 'paddenstoel_bruin', 'Bruine paddenstoel', 'Brown mushroom', { zwaai: false, plaatsOp: 'vast' });
plant(56, 'paddenstoel_rood', 'Rode paddenstoel', 'Red mushroom', { zwaai: false, plaatsOp: 'vast' });
plant(57, 'riet', 'Riet', 'Reed', { plaatsOp: 'riet', hard: 0.1 });
blok(58, 'waterlelie', 'Waterlelie', 'Water lily', { vorm: 'lelie', laag: 1, hard: 0, geluid: 'blad', vast: false, plaatsOp: 'water' });
plant(59, 'bessenstruik', 'Bessenstruik', 'Berry bush', { tex: 'bessenstruik', zwaai: false, vast: false, hard: 0.3, geeft: 'bessen', tint: 0, stand: 'bessen', extra: ['bessenstruik_vol'], wasweg: false, plaatsOp: 'grond' });
BL[59].tex2 = tex('bessenstruik_vol');
blok(60, 'cactus', 'Cactus', 'Cactus', { vorm: 'cactus', laag: 1, tex: { boven: 'cactus_top', onder: 'cactus_top', zij: 'cactus' }, hard: 0.4, geluid: 'blad', plaatsOp: 'zand' });
plant(61, 'wilgentak', 'Wilgentak', 'Willow twig', { tint: 2, vervang: true, plaatsOp: 'hang', geeft: 0, gereed: 'zwaard' });
plant(62, 'druipsteen_hang', 'Hangende druipsteen', 'Hanging dripstone', { zwaai: false, geluid: 'steen', hard: 1, gereed: 'houweel', plaatsOp: 'hang', wasweg: false, geeft: 'druipsteen_hang' });
plant(63, 'druipsteen_staand', 'Staande druipsteen', 'Standing dripstone', { zwaai: false, geluid: 'steen', hard: 1, gereed: 'houweel', plaatsOp: 'vast', wasweg: false });
plant(64, 'gloeizwam', 'Gloeizwam', 'Glow fungus', { zwaai: false, licht: 10, gloed: true, plaatsOp: 'vast' });
HOUT.forEach(([s, nl, en], i) => plant(65 + i, 'stekje_' + s, nl + 'stekje', en + ' sapling', { stand: 'groei', plaatsOp: 'grond' }));
// bouwen
blok(71, 'glas', 'Glas', 'Glass', { laag: 1, hard: 0.3, geluid: 'glas', geeft: 0, nietDicht: true });
blok(72, 'baksteen', 'Baksteen', 'Bricks', { hard: 2, gereed: 'houweel', klasse: 1 });
blok(73, 'steenstenen', 'Gekapte steen', 'Cut stone', { hard: 1.5, gereed: 'houweel', klasse: 1 });
blok(74, 'gladde_steen', 'Gladde steen', 'Smooth stone', { hard: 1.5, gereed: 'houweel', klasse: 1 });
blok(75, 'leitegels', 'Leistenen tegels', 'Slate tiles', { hard: 3, gereed: 'houweel', klasse: 1 });
blok(76, 'mergelblokken', 'Mergelblokken', 'Marl blocks', { hard: 1, gereed: 'houweel', klasse: 1 });
blok(77, 'mostkei', 'Bemoste keien', 'Mossy cobbles', { hard: 2, gereed: 'houweel', klasse: 1 });
blok(78, 'tegel_wit', 'Witte tegel', 'White tile', { hard: 1.2, gereed: 'houweel', klasse: 1, geluid: 'glas' });
blok(79, 'tegel_delfts', 'Delfts blauwe tegel', 'Delft blue tile', { hard: 1.2, gereed: 'houweel', klasse: 1, geluid: 'glas' });
const KLEUREN = [['wit', 'Wit', 'White', 'Witte'], ['rood', 'Rood', 'Red', 'Rode'], ['oranje', 'Oranje', 'Orange', 'Oranje'], ['geel', 'Geel', 'Yellow', 'Gele'], ['groen', 'Groen', 'Green', 'Groene'], ['blauw', 'Blauw', 'Blue', 'Blauwe'], ['paars', 'Paars', 'Purple', 'Paarse'], ['roze', 'Roze', 'Pink', 'Roze'], ['zwart', 'Zwart', 'Black', 'Zwarte']];
KLEUREN.forEach(([s, nl, en], i) => blok(80 + i, 'linnen_' + s, nl + ' linnen', en + ' linen', { hard: 0.8, geluid: 'stof' }));
blok(89, 'werkbank', 'Werkbank', 'Workbench', { tex: { boven: 'werkbank_top', onder: 'planken_eik', zij: 'werkbank_zij', voor: 'werkbank_voor' }, hard: 2.5, gereed: 'bijl', geluid: 'hout', stand: 'richting', gebruik: 'werkbank' });
blok(90, 'oven', 'Oven', 'Furnace', { tex: { boven: 'oven_top', onder: 'oven_top', zij: 'oven_zij', voor: 'oven_voor' }, hard: 3.5, gereed: 'houweel', klasse: 1, stand: 'richting', gebruik: 'oven' });
blok(91, 'oven_aan', 'Brandende oven', 'Lit furnace', { tex: { boven: 'oven_top', onder: 'oven_top', zij: 'oven_zij', voor: 'oven_voor_aan' }, hard: 3.5, gereed: 'houweel', klasse: 1, stand: 'richting', gebruik: 'oven', licht: 13, item: false, geeft: 90 });
blok(92, 'kist', 'Kist', 'Chest', { vorm: 'kist', tex: { boven: 'kist_top', onder: 'kist_top', zij: 'kist_zij', voor: 'kist_voor' }, hard: 2.5, gereed: 'bijl', geluid: 'hout', stand: 'richting', gebruik: 'kist' });
blok(93, 'fakkel', 'Fakkel', 'Torch', { vorm: 'fakkel', laag: 1, hard: 0, licht: 14, geluid: 'hout', stand: 'fakkel', wasweg: true, gloed: true, plaatsOp: 'fakkel' });
blok(94, 'lantaarn', 'Lantaarn', 'Lantern', { vorm: 'lantaarn', laag: 1, hard: 1, licht: 15, geluid: 'metaal', stand: 'lantaarn', gereed: 'houweel', gloed: true });
blok(95, 'lichtblok', 'Lichtblok', 'Light block', { hard: 0.5, licht: 15, geluid: 'glas', gloed: true });
blok(96, 'deur', 'Houten deur', 'Wooden door', { vorm: 'deur', laag: 1, tex: { zij: 'deur_onder', extra: ['deur_boven'] }, hard: 3, gereed: 'bijl', geluid: 'hout', stand: 'deur', gebruik: 'deur' });
blok(97, 'luik', 'Houten luik', 'Wooden hatch', { vorm: 'luik', laag: 1, hard: 3, gereed: 'bijl', geluid: 'hout', stand: 'luik', gebruik: 'luik' });
blok(98, 'ladder', 'Ladder', 'Ladder', { vorm: 'ladder', laag: 1, hard: 0.4, gereed: 'bijl', geluid: 'hout', stand: 'muur', vast: false });
blok(99, 'hek', 'Houten hek', 'Wooden fence', { vorm: 'hek', laag: 0, tex: 'planken_eik', hard: 2, gereed: 'bijl', geluid: 'hout' });
blok(100, 'bed', 'Bed', 'Bed', { vorm: 'bed', laag: 0, tex: { boven: 'bed_top', onder: 'planken_eik', zij: 'bed_zij', extra: ['bed_kop', 'bed_kop_zij'] }, hard: 0.3, geluid: 'stof', stand: 'bed', gebruik: 'bed' });
// trappen en platen
const STEENSOORT = [['hout', 'Houten', 'Wooden', 'planken_eik', 'bijl', 'hout', 0], ['kei', 'Keien', 'Cobble', 'kei', 'houweel', 'steen', 1], ['baksteen', 'Bakstenen', 'Brick', 'baksteen', 'houweel', 'steen', 1], ['zandsteen', 'Zandstenen', 'Sandstone', 'zandsteen_top', 'houweel', 'steen', 1], ['steenstenen', 'Stenen', 'Stone', 'steenstenen', 'houweel', 'steen', 1]];
STEENSOORT.forEach(([s, nl, en, t, g, gl, k], i) => {
  blok(101 + i, 'trap_' + s, (s === 'kei' ? 'Keien' : nl + ' ') + 'trap', en + ' stairs', { vorm: 'trap', tex: t, hard: 2, gereed: g, klasse: k, geluid: gl, stand: 'trap' });
  blok(106 + i, 'plaat_' + s, (s === 'kei' ? 'Keien' : nl + ' ') + 'plaat', en + ' slab', { vorm: 'plaat', tex: t, hard: 2, gereed: g, klasse: k, geluid: gl, stand: 'plaat' });
});
// blokken van grondstoffen
blok(111, 'koperblok', 'Koperblok', 'Copper block', { hard: 4, gereed: 'houweel', klasse: 2, geluid: 'metaal' });
blok(112, 'ijzerblok', 'IJzerblok', 'Iron block', { hard: 5, gereed: 'houweel', klasse: 3, geluid: 'metaal' });
blok(113, 'goudblok', 'Goudblok', 'Gold block', { hard: 4, gereed: 'houweel', klasse: 3, geluid: 'metaal' });
blok(114, 'robijnblok', 'Robijnblok', 'Ruby block', { hard: 5, gereed: 'houweel', klasse: 4, geluid: 'glas' });
blok(115, 'kolenblok', 'Kolenblok', 'Coal block', { hard: 4, gereed: 'houweel', klasse: 1 });
blok(116, 'sneeuwgras', 'Besneeuwd gras', 'Snowy grass', { tex: { boven: 'sneeuw', onder: 'aarde', zij: 'sneeuwgras_zij' }, hard: 0.6, gereed: 'schop', geluid: 'sneeuw', geeft: 2 });
blok(117, 'vlaai', 'Vlaai', 'Vlaai pie', { vorm: 'vlaai', laag: 0, tex: { boven: 'vlaai_top', onder: 'vlaai_onder', zij: 'vlaai_zij' }, hard: 0.4, geluid: 'stof', stand: 'hap', gebruik: 'vlaai' });
blok(118, 'boekenkast', 'Boekenkast', 'Bookshelf', { tex: { boven: 'planken_eik', onder: 'planken_eik', zij: 'boekenkast' }, hard: 1.5, gereed: 'bijl', geluid: 'hout' });
blok(119, 'hooi', 'Strobaal', 'Straw bale', { tex: { boven: 'hooi_top', onder: 'hooi_top', zij: 'hooi_zij' }, hard: 0.5, geluid: 'gras', as: true });

// ---------------- ronde 2: meer steen, twee houtsoorten, kleur, decoratie, planten, landbouw en dingen om te vinden
// het kleurenpalet van het rommelhoekje (12 kleuren); gekleurde blokken bewaren hun kleur in de stand (0 tot 11)
const PALET = [['wit', 'Wit', 'White', 'Witte', '#F2EFE6'], ['manilla', 'Manilla', 'Manila', 'Manilla', '#E8D39A'], ['muntgeel', 'Muntgeel', 'Coin yellow', 'Muntgele', '#E9B949'],
  ['oranje', 'Oranje', 'Orange', 'Oranje', '#E07B2E'], ['rood', 'Rood', 'Red', 'Rode', '#C8323C'], ['roze', 'Roze', 'Pink', 'Roze', '#E890B4'], ['paars', 'Paars', 'Purple', 'Paarse', '#7E4BAA'],
  ['bordblauw', 'Bordblauw', 'Board blue', 'Bordblauwe', '#2F4C8F'], ['hemelsblauw', 'Hemelsblauw', 'Sky blue', 'Hemelsblauwe', '#5EAAE8'], ['groen', 'Groen', 'Green', 'Groene', '#4E9C3C'],
  ['bruin', 'Bruin', 'Brown', 'Bruine', '#7A4E2D'], ['inkt', 'Inktzwart', 'Ink black', 'Inktzwarte', '#23252B']];
// steen
blok(120, 'graniet', 'Graniet', 'Granite', { hard: 2.2, gereed: 'houweel', klasse: 1 });
blok(121, 'graniet_glad', 'Gepolijst graniet', 'Polished granite', { hard: 2.2, gereed: 'houweel', klasse: 1 });
blok(122, 'basalt', 'Basalt', 'Basalt', { tex: { boven: 'basalt_top', onder: 'basalt_top', zij: 'basalt' }, hard: 2.5, gereed: 'houweel', klasse: 1, as: true });
blok(123, 'basalt_glad', 'Gepolijst basalt', 'Polished basalt', { hard: 2.5, gereed: 'houweel', klasse: 1 });
blok(124, 'marmer', 'Marmer', 'Marble', { hard: 2, gereed: 'houweel', klasse: 1 });
blok(125, 'marmertegels', 'Marmeren tegels', 'Marble tiles', { hard: 2, gereed: 'houweel', klasse: 1, geluid: 'glas' });
blok(126, 'veen', 'Veen', 'Peat', { hard: 0.6, gereed: 'schop', geluid: 'aarde' });
const STEEN2 = [['graniet', 'Granieten', 'Granite', 'graniet_glad'], ['basalt', 'Basalten', 'Basalt', 'basalt_glad'], ['marmer', 'Marmeren', 'Marble', 'marmertegels']];
STEEN2.forEach(([s2, nl, en, t], i) => {
  blok(127 + i * 2, 'trap_' + s2, nl + ' trap', en + ' stairs', { vorm: 'trap', tex: t, hard: 2, gereed: 'houweel', klasse: 1, stand: 'trap' });
  blok(128 + i * 2, 'plaat_' + s2, nl + ' plaat', en + ' slab', { vorm: 'plaat', tex: t, hard: 2, gereed: 'houweel', klasse: 1, stand: 'plaat' });
});
// twee nieuwe houtsoorten: kers (roze bloesem, in boomgaarden) en noten (donker hout, in het bos)
const HOUT2 = [['kers', 'Kersen', 'Cherry', 'Kersenbloesem', 'Cherry blossom', 0], ['noten', 'Noten', 'Walnut', 'Notenbladeren', 'Walnut leaves', 2]];
HOUT2.forEach(([s2, nl, en, bnl, ben, tint], i) => {
  const b0 = 133 + i * 4;
  blok(b0, 'stam_' + s2, nl + 'stam', en + ' log', { tex: { boven: 'stam_' + s2 + '_ring', onder: 'stam_' + s2 + '_ring', zij: 'stam_' + s2 }, hard: 2, gereed: 'bijl', geluid: 'hout', as: true });
  blok(b0 + 1, 'blad_' + s2, bnl, ben, { laag: 1, hard: 0.2, gereed: 'zwaard', geluid: 'blad', tint, zwaai: true, demp: 1, geeft: 0 });
  blok(b0 + 2, 'planken_' + s2, nl + 'planken', en + ' planks', { hard: 2, gereed: 'bijl', geluid: 'hout' });
  plant(b0 + 3, 'stekje_' + s2, nl + 'stekje', en + ' sapling', { stand: 'groei', plaatsOp: 'grond' });
});
// kleur: gekleurd glas, pleisterwerk, geglazuurde tegels en tapijt, elk in de 12 kleuren van het palet
blok(141, 'glas_kleur', 'Gekleurd glas', 'Coloured glass', { laag: 1, hard: 0.3, geluid: 'glas', geeft: 0, nietDicht: true, kleur: true, item: false, groep: 'kleur' });
blok(142, 'pleister', 'Pleisterwerk', 'Plaster', { hard: 1.2, gereed: 'houweel', klasse: 1, kleur: true, item: false, groep: 'kleur' });
blok(143, 'tegel_glazuur', 'Geglazuurde tegel', 'Glazed tile', { hard: 1.2, gereed: 'houweel', klasse: 1, geluid: 'glas', kleur: true, item: false, groep: 'kleur' });
blok(144, 'tapijt', 'Tapijt', 'Carpet', { vorm: 'tapijt', hard: 0.3, geluid: 'stof', kleur: true, item: false, groep: 'kleur', plaatsOp: 'vast', wasweg: true });
// decoratie
blok(145, 'bloempot', 'Bloempot', 'Flower pot', { vorm: 'pot', laag: 1, hard: 0.3, geluid: 'steen', stand: 'pot', gebruik: 'pot', plaatsOp: 'vast', groep: 'deco' });
blok(146, 'kaars', 'Kaars', 'Candle', { vorm: 'kaars', laag: 1, hard: 0, licht: 11, gloed: true, geluid: 'stof', wasweg: true, plaatsOp: 'vast', vast: false, groep: 'licht' });
blok(147, 'tafel', 'Tafel', 'Table', { vorm: 'tafel', tex: 'planken_eik', hard: 2, gereed: 'bijl', geluid: 'hout', groep: 'deco' });
blok(148, 'stoel', 'Stoel', 'Chair', { vorm: 'stoel', tex: 'planken_eik', hard: 2, gereed: 'bijl', geluid: 'hout', stand: 'richting', groep: 'deco' });
blok(149, 'klimop', 'Klimop', 'Ivy', { vorm: 'ladder', laag: 1, hard: 0.2, gereed: 'zwaard', geluid: 'blad', stand: 'muur', vast: false, tint: 2, zwaai: true, wasweg: true, groep: 'natuur' });
blok(150, 'mos', 'Mostapijt', 'Moss carpet', { vorm: 'tapijt', hard: 0.1, geluid: 'blad', plaatsOp: 'vast', wasweg: true, groep: 'natuur' });
plant(151, 'spinnenweb', 'Spinnenweb', 'Cobweb', { zwaai: false, hard: 1, gereed: 'zwaard', geluid: 'stof', geeft: 'linnendraad', plaatsOp: 'vrij', wasweg: false, groep: 'deco' });
blok(152, 'glas_in_lood', 'Glas-in-lood', 'Stained glass window', { laag: 1, hard: 0.3, geluid: 'glas', geeft: 0, nietDicht: true, groep: 'deco' });
blok(153, 'schilderij', 'Schilderij', 'Painting', { vorm: 'ladder', hard: 0.3, gereed: 'bijl', geluid: 'hout', stand: 'muur', vast: false, groep: 'deco' });
// nieuwe bloemen (ook voor verf)
plant(154, 'zonnebloem', 'Zonnebloem', 'Sunflower');
plant(155, 'klaproos', 'Klaproos', 'Poppy');
plant(156, 'lavendel', 'Lavendel', 'Lavender');
plant(157, 'madelief', 'Madelief', 'Daisy');
plant(158, 'vergeetmenietje', 'Vergeet-mij-nietje', 'Forget-me-not');
blok(159, 'gebarsten_steen', 'Gebarsten stenen', 'Cracked stone bricks', { hard: 1.5, gereed: 'houweel', klasse: 1 });
blok(160, 'mijnspoor', 'Mijnspoor', 'Mine rail', { vorm: 'spoor', laag: 1, tex: 'spoor', hard: 0.7, gereed: 'houweel', geluid: 'metaal', stand: 'spoor', plaatsOp: 'vast', vast: false, groep: 'deco' });
// landbouw: een akker (met een schoffel), vijf gewassen in vier stappen, en de pompoen
blok(161, 'akker', 'Akker', 'Farmland', { tex: { boven: 'akker', onder: 'aarde', zij: 'aarde', extra: ['akker_nat'] }, hard: 0.5, gereed: 'schop', geluid: 'aarde', geeft: 'aarde', stand: 'nat', groep: 'natuur' });
BL[161].natTex = tex('akker_nat');
const GEWAS = [['tarwe', 'Tarwe', 'Wheat'], ['aardappel', 'Aardappelplant', 'Potato plant'], ['wortel', 'Wortelplant', 'Carrot plant'], ['biet', 'Bietenplant', 'Beet plant'], ['pompoen', 'Pompoenplant', 'Pumpkin plant']];
GEWAS.forEach(([s2, nl, en], i) => {
  const d = plant(162 + i, 'gewas_' + s2, nl, en, { zwaai: true, vervang: false, stand: 'gewas', plaatsOp: 'akker', item: false, geeft: 0, groep: 'natuur', tex: s2 + '_rijp', extra: ['kiem_klein', 'kiem_groot', s2 + '_jong'] });
  d.standTex = [tex('kiem_klein'), tex('kiem_groot'), tex(s2 + '_jong'), tex(s2 + '_rijp')];
});
blok(167, 'pompoen', 'Pompoen', 'Pumpkin', { tex: { boven: 'pompoen_top', onder: 'pompoen_top', zij: 'pompoen_zij' }, hard: 1, gereed: 'bijl', geluid: 'hout', groep: 'natuur' });
blok(168, 'kersenvlaai', 'Kersenvlaai', 'Cherry vlaai', { vorm: 'vlaai', tex: { boven: 'kersenvlaai_top', onder: 'vlaai_onder', zij: 'vlaai_zij' }, hard: 0.4, geluid: 'stof', stand: 'hap', gebruik: 'vlaai', groep: 'eten' });
blok(169, 'appelvlaai', 'Appelvlaai', 'Apple vlaai', { vorm: 'vlaai', tex: { boven: 'appelvlaai_top', onder: 'vlaai_onder', zij: 'vlaai_zij' }, hard: 0.4, geluid: 'stof', stand: 'hap', gebruik: 'vlaai', groep: 'eten' });
// de smidse (gereedschap herstellen en verbeteren), sterrensteen (heel zeldzaam), en een oude kist met buit
blok(170, 'smidse', 'Smidse', 'Smithy', { tex: { boven: 'smidse_top', onder: 'smidse_top', zij: 'smidse_zij', voor: 'smidse_voor' }, hard: 3.5, gereed: 'houweel', klasse: 1, geluid: 'metaal', stand: 'richting', gebruik: 'smidse', groep: 'werk' });
blok(171, 'sterrensteen', 'Sterrensteen', 'Starstone', { hard: 5, gereed: 'houweel', klasse: 3, licht: 6, gloed: true, geeft: 'sterrensplinter', groep: 'natuur' });
blok(172, 'buitkist', 'Oude kist', 'Old chest', { vorm: 'kist', tex: { boven: 'buitkist_top', onder: 'buitkist_top', zij: 'buitkist_zij', voor: 'buitkist_voor' }, hard: 2.5, gereed: 'bijl', geluid: 'hout', stand: 'richting', gebruik: 'kist', geeft: 'kist', groep: 'werk', nietInMenu: true });
// ronde 3: een stuwspoor (geeft een karretje vaart), en het mijnspoor kan nu ook bochten en hellingen
blok(173, 'stuwspoor', 'Stuwspoor', 'Booster rail', { vorm: 'spoor', laag: 1, tex: 'stuwspoor', hard: 0.7, gereed: 'houweel', geluid: 'metaal', stand: 'spoor', plaatsOp: 'vast', vast: false, groep: 'deco' });
for (const n of ['spoor_hout', 'pot_aarde']) tex(n);
// voor de bewoners van de dorpjes (licht van kleur: ze krijgen per bewoner een kleur eroverheen)
for (const n of ['bw_huid', 'bw_gezicht', 'bw_stof', 'bw_haar', 'bw_leer', 'bw_schoen', 'bw_bril']) tex(n);
// klinkers in visgraatverband: de straten van een dorpje
blok(174, 'klinkers', 'Klinkers', 'Paving bricks', { hard: 1.8, gereed: 'houweel', klasse: 1 });
// rode dakpannen (voor de pannendaken in de dorpjes), ook als trap en plaat
blok(175, 'dakpannen', 'Dakpannen', 'Roof tiles', { hard: 1.5, gereed: 'houweel', klasse: 1 });
blok(176, 'trap_dakpannen', 'Dakpannentrap', 'Roof tile stairs', { vorm: 'trap', tex: 'dakpannen', hard: 1.5, gereed: 'houweel', klasse: 1, stand: 'trap' });
blok(177, 'plaat_dakpannen', 'Dakpannenplaat', 'Roof tile slab', { vorm: 'plaat', tex: 'dakpannen', hard: 1.5, gereed: 'houweel', klasse: 1, stand: 'plaat' });

// texturen die alleen in vormen gebruikt worden, vooraf vastleggen (dan is de volgorde overal gelijk)
for (const n of ['fakkel_houder', 'lantaarn_top', 'lantaarn_ketting', 'vlaai_binnen', 'barst0', 'barst1', 'barst2', 'barst3', 'barst4', 'barst5', 'barst6', 'barst7', 'barst8', 'barst9']) tex(n);
const MAXBLOK = 178;
for (let i = 0; i < 256; i++) if (!BL[i]) BL[i] = null;
// snelle tabellen voor de rekenhulpjes
const DICHT = new Uint8Array(256), DEMP = new Uint8Array(256), LICHT = new Uint8Array(256), VAST = new Uint8Array(256), LAAG = new Uint8Array(256), VORM = new Uint8Array(256), VERVANG = new Uint8Array(256);
const VORMEN = ['niets', 'kubus', 'kruis', 'fakkel', 'lantaarn', 'plaat', 'trap', 'deur', 'luik', 'ladder', 'hek', 'bed', 'kist', 'cactus', 'water', 'lelie', 'vlaai', 'tapijt', 'pot', 'kaars', 'tafel', 'stoel', 'spoor'];
const VN = {}; VORMEN.forEach((v, i) => VN[v] = i);
for (let i = 0; i < 256; i++) { const d = BL[i]; if (!d) continue; DICHT[i] = d.dicht ? 1 : 0; DEMP[i] = d.demp; LICHT[i] = d.licht; VAST[i] = d.vast ? 1 : 0; LAAG[i] = d.laag; VORM[i] = VN[d.vorm] || 0; VERVANG[i] = d.vervang ? 1 : 0; }
const W = B.water;
const isWater = v => (v & 255) === W;

export {
  TEXNAMEN, TEXNR, tex, DTEXNAMEN, DTEXNR, dtex, BL, B, blok, HOUT, plant, KLEUREN, STEENSOORT, PALET, STEEN2,
  HOUT2, GEWAS, MAXBLOK, DICHT, DEMP, LICHT, VAST, LAAG, VORM, VERVANG, VORMEN, VN, W, isWater,
};
