// Geen verwijzingen naar Limburg (stap 2): node test/geen_limburg.js
// 1. nergens in de code, de schermen of de vertalingen: vlaai, mergel, Limburg, Maastricht en dergelijke, en geen Limburgse namen
//    (behalve de lijst met de oude namen, die nodig is om bewoners uit een oudere wereld eenmalig om te zetten)
// 2. de namen van blokken en voorwerpen in het Nederlands en het Engels
// 3. het omzetten van oude namen: elke oude naam krijgt een eigen nieuwe naam (dus nog steeds uniek in een dorpje)
const fs = require('fs'), path = require('path');
const { G } = require('../shared/index.js');
const WORTEL = path.join(__dirname, '..');
let fouten = 0; const mis = (...a) => { fouten++; console.log('MIS:', ...a); };
const VERBODEN = /limburg|vlaai|mergel|maastricht|vrijthof|valkenburg|heuvelland|vastelaovend|alaaf|sjeng|sraar|wullem|lewie|\bthei\b|\bfuns\b|\bbets\b|\bsef\b|\bgiel\b/i;
// regels die de oude namen alleen nodig hebben om oude werelden om te zetten
const OMZETTEN = /NAMEN_OUD = |logboek\.vlaai|k === 'vlaai'/;
const bestanden = [];
const loop = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) loop(p); else if (/\.(js|html|css)$/.test(p)) bestanden.push(p); } };
loop(path.join(WORTEL, 'shared')); loop(path.join(WORTEL, 'client', 'src')); bestanden.push(path.join(WORTEL, 'site', 'kop.html'), path.join(WORTEL, 'site', 'pagina.html'));
let regels = 0;
for (const p of bestanden) fs.readFileSync(p, 'utf8').split('\n').forEach((r, i) => { regels++; if (VERBODEN.test(r) && !OMZETTEN.test(r)) mis(path.relative(WORTEL, p) + ':' + (i + 1), r.trim().slice(0, 120)); });
console.log('code en schermen nagelopen:', bestanden.length, 'bestanden,', regels, 'regels');
// 2.
for (const b of G.BL) if (b && (VERBODEN.test(b.nl) || VERBODEN.test(b.en) || VERBODEN.test(b.sleutel))) mis('blok', b.id, b.nl, b.en);
for (const it of G.IT) if (it && (VERBODEN.test(it.nl) || VERBODEN.test(it.en) || VERBODEN.test(it.sleutel))) mis('voorwerp', it.id, it.nl, it.en);
for (const n of G.TEXNAMEN.concat(G.DTEXNAMEN)) if (VERBODEN.test(n)) mis('textuur', n);
console.log('namen:', [23, 76, 117, 168, 169].map(i => G.BL[i].nl + ' / ' + G.BL[i].en).join(', ') + ', ' + G.IT[275].nl + ' / ' + G.IT[275].en);
// 3. de namen van de bewoners (uit de bron, want ze staan in de spelcode)
const bron = fs.readFileSync(path.join(WORTEL, 'client', 'src', 'spel', 'p6c_bewoners.js'), 'utf8');
const lijst = n => bron.match(new RegExp('const ' + n + " = '([^']+)'\\.split"))[1].split(' ');
const NIEUW = lijst('NAMEN'), OUD = lijst('NAMEN_OUD');
if (NIEUW.length !== OUD.length) mis('de nieuwe lijst met namen is niet even lang als de oude', NIEUW.length, OUD.length);
if (new Set(NIEUW).size !== NIEUW.length) mis('dubbele namen in de nieuwe lijst');
for (const n of NIEUW) if (VERBODEN.test(n)) mis('naam', n);
console.log('bewoners:', NIEUW.length, 'nieuwe namen (' + NIEUW.slice(0, 6).join(', ') + ', ...); elke oude naam krijgt de nieuwe op dezelfde plek');
console.log(fouten ? 'MISLUKT' : 'geen verwijzingen naar Limburg');
process.exit(fouten ? 1 : 0);
