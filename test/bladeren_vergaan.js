// Bladeren vergaan als ze niet meer aan een stam zitten (de wereldbaas, zonder browser): node test/bladeren_vergaan.js
// 1. hak je de stam van een boom weg, dan vergaan zijn bladeren: niet meteen, maar verspreid over 1,5 tot 60 seconden,
//    en er valt af en toe iets uit (een stekje, appel of stok)
// 2. bladeren die een speler neerzette (stand 0) blijven altijd, ook als ze nergens aan vastzitten
// 3. de bomen eromheen houden al hun bladeren, ook na lang wachten (willekeurige tikken)
const { G } = require('../shared/index.js');
const { RB_WERELD } = require('../client/src/werkers/werker.js');
const B = G.B, BL = G.BL;
let fout = 0; const mis = (...a) => { fout++; console.log('MIS:', ...a); };
const BLAD = id => BL[id] && BL[id].sleutel.startsWith('blad_'), STAM = id => BL[id] && BL[id].sleutel.startsWith('stam_');
const berichten = [], Wb = RB_WERELD(G, { postMessage: m => berichten.push(m) });
Wb.start(777); Wb.setSpeler(8, 8, 3); for (let i = 0; i < 600; i++) Wb.tik();
// alle natuurbladeren tellen in de geladen stukken
const natuur = () => { let n = 0; for (const s of Wb.stukken.values()) if (s.d) for (const v of s.d) if (BLAD(v & 255) && (v >> 8) === 1) n++; return n; };
// een losse eik hoog in de lucht (met de echte bomenmaker van de wereld), zodat hij nergens aan een buurboom hangt
const boom = [8, 96, 8], stam = [], bladBoom = [];
G.maakWereld(777).zetBoom('eik', boom[0], boom[1], boom[2], G.rng(5), (x, y, z, v, vr) => { const oud = Wb.get(x, y, z); if (vr !== 2 && oud !== 0) return; Wb.zet(x, y, z, v); });
for (let y = boom[1]; STAM(Wb.get(boom[0], y, boom[2]) & 255); y++) stam.push(y);
for (let dy = -2; dy <= stam.length + 4; dy++) for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) { const x = boom[0] + dx, y = boom[1] + dy, z = boom[2] + dz, v = Wb.get(x, y, z); if (v > 0 && BLAD(v & 255) && (v >> 8) === 1) bladBoom.push([x, y, z]); }
console.log('boom op ' + boom.join(',') + ': stam van ' + stam.length + ' hoog, ' + bladBoom.length + ' bladeren eromheen');
const voor = natuur();
// een zwevend blad dat een speler neerzette, een eind verderop
const geplaatst = [boom[0] + 12, 100, boom[2]]; Wb.zet(...geplaatst, B.blad_eik, true);
// 2. eerst wachten zonder iets te doen: de willekeurige tikken mogen niets laten vergaan
for (let i = 0; i < 400; i++) Wb.willekeurig();
Wb.bladTik(); for (const e of Wb.vergaan.values()) e[3] = 0; Wb.bladTik();
if (natuur() !== voor) mis('zonder hakken verdwenen er ' + (voor - natuur()) + ' bladeren');
// 1. de stam weghakken (zoals een speler: vanaf de pagina)
for (const y of stam) Wb.zet(boom[0], y, boom[2], 0, true);
Wb.bladTik();
const wacht = [...Wb.vergaan.values()].map(e => (e[3] - performance.now()) / 1000);
const losBoom = bladBoom.filter(([x, y, z]) => Wb.vergaan.has(x + ',' + y + ',' + z)).length;
console.log('na het hakken: ' + Wb.vergaan.size + ' bladeren wachten om te vergaan (' + losBoom + ' van deze boom), na ' + Math.min(...wacht).toFixed(1) + ' tot ' + Math.max(...wacht).toFixed(1) + ' s, de helft binnen ' + wacht.sort((a, b) => a - b)[wacht.length >> 1].toFixed(1) + ' s');
if (!Wb.vergaan.size) mis('na het hakken gaat er niets vergaan');
if (Math.min(...wacht) < 1.4 || Math.max(...wacht) > 60.1) mis('de wachttijd ligt niet tussen 1,5 en 60 s');
if (natuur() !== voor) mis('er verdween meteen al iets');
// tijd vooruit: alles is aan de beurt
const drops = () => berichten.filter(m => m.t === 'drop').length, d0 = drops();
for (const e of Wb.vergaan.values()) e[3] = 0;
for (let i = 0; i < 20 && Wb.vergaan.size; i++) { Wb.bladTik(); for (const e of Wb.vergaan.values()) e[3] = 0; }
const weg = voor - natuur(), nogBoom = bladBoom.filter(([x, y, z]) => { const v = Wb.get(x, y, z); return v > 0 && BLAD(v & 255); }).length;
console.log('vergaan: ' + weg + ' bladeren; van deze boom zijn er nog ' + nogBoom + '; ' + (drops() - d0) + ' keer viel er iets uit');
if (nogBoom || losBoom !== bladBoom.length || weg !== bladBoom.length) mis('niet precies de bladeren van de omgehakte boom zijn vergaan (' + weg + ' van ' + bladBoom.length + ')');
if (drops() - d0 !== weg) mis('niet elk vergaan blad gaf een bericht om iets te laten vallen');
// wat valt er uit? (opbrengst zonder gereedschap, zoals de pagina en de server doen)
const uit = {}; let n = 0; for (const m of berichten.filter(m => m.t === 'drop')) for (let k = 0; k < 20; k++) for (const [id] of G.SPULLEN.opbrengst(m.v, null)) { const s = (G.IT[id] || {}).sleutel; uit[s] = (uit[s] || 0) + 1; n++; }
console.log('wat eruit valt (per 20 keer): ' + Object.entries(uit).map(([k, v]) => k + ' ' + v).join(', '));
if (!uit.stok && !Object.keys(uit).some(k => k.startsWith('stekje'))) mis('er valt nooit iets uit');
const g = Wb.get(...geplaatst); if ((g & 255) !== B.blad_eik) mis('het blad van de speler is vergaan');
console.log('het blad dat een speler neerzette: ' + ((g & 255) === B.blad_eik ? 'blijft' : 'weg'));
console.log(fout ? fout + ' FOUTEN' : 'bladeren vergaan: alles goed');
process.exit(fout ? 1 : 0);
