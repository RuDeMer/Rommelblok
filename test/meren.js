// ondergrondse meren mogen niet weglopen: na laden en belichten mag het water daar niet gaan stromen
const L = require('./laad'); const G = L.gedeeld(); const RB_WERELD = L.laad('werker.js', 'RB_WERELD');
const zaadTekst = process.argv[2] || '777', zaad = G.zaadVan(zaadTekst);
const W = G.maakWereld(zaad);
// meren zoeken
const meren = [];
for (let gz = -8; gz < 8; gz++) for (let gx = -8; gx < 8; gx++) { const m = W.gebied(gx, gz).meren; for (let i = 0; i < m.length; i += 7) meren.push([m[i], m[i + 1], m[i + 2], m[i + 6]]); }
console.log('meren gevonden:', meren.length);
let fout = 0, getest = 0;
for (const [x, y, z, Lv] of meren.slice(0, 6)) {
  const berichten = []; const Wb = RB_WERELD(G, { postMessage: m => berichten.push(m) });
  Wb.start(zaad); Wb.setSpeler(x, z, 3); for (let i = 0; i < 500; i++) Wb.tik();
  // water rond het meer tellen, dan een tijd water laten stromen
  const tel = () => { let n = 0, bron = 0; for (let Y = Math.floor(y - 12); Y <= Lv; Y++) for (let Z = Math.floor(z - 14); Z <= z + 14; Z++) for (let X = Math.floor(x - 14); X <= x + 14; X++) { const v = Wb.get(X, Y, Z); if ((v & 255) === G.W) { n++; if (!(v >> 8)) bron++; } } return [n, bron]; };
  const voor = tel();
  let stappen = 0; for (let i = 0; i < 80; i++) { Wb.waterTik(); stappen += Wb.waterTeller(); }
  const na = tel();
  getest++;
  const ok = voor[0] === na[0] && voor[0] > 0;
  if (!ok) fout++;
  console.log(`meer bij ${x | 0},${y | 0},${z | 0} (waterlijn ${Lv}): water ${voor[0]} -> ${na[0]}, waterstappen ${stappen} ${ok ? 'goed' : 'LEKT'}`);
}
console.log(fout ? `${fout} van ${getest} meren lekken` : `alle ${getest} meren blijven staan`);
process.exit(fout ? 1 : 0);
