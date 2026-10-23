// Duurtest: ver reizen, onderweg blokken veranderen, terugkomen: veranderingen moeten er nog zijn, geheugen blijft binnen de perken
const L = require('./laad'); const G = L.gedeeld(); const RB_WERELD = L.laad('werker.js', 'RB_WERELD');
let berichten = 0; const Wb = RB_WERELD(G, { postMessage: () => { berichten++; } });
Wb.start(99); Wb.setSpeler(0, 0, 4);
const t0 = performance.now(); let max = 0, fouten = 0;
for (let i = 0; i < 60; i++) Wb.tik();
// een veranderd blok bij het begin
const y = (() => { for (let y = 120; y > 0; y--) { const v = Wb.get(5, y, 5); if (v > 0 && G.DICHT[v & 255]) return y + 1; } })();
Wb.zet(5, y, 5, G.B.goudblok); Wb.zet(6, y, 5, G.B.goudblok);
for (let x = 0; x <= 1600; x += 8) { Wb.setSpeler(x, x / 3, 4); for (let k = 0; k < 6; k++) Wb.tik(); max = Math.max(max, Wb.stukken.size); }
const ver = Wb.stukken.size;
const weg = !Wb.haal(0, 0);
// terug naar het begin
Wb.setSpeler(0, 0, 4); for (let k = 0; k < 200; k++) Wb.tik();
const terug = [Wb.get(5, y, 5) & 255, Wb.get(6, y, 5) & 255];
if (terug[0] !== G.B.goudblok || terug[1] !== G.B.goudblok) { console.log('FOUT: veranderd blok kwijt na terugkomen', terug); fouten++; }
if (!weg) { console.log('FOUT: het begin werd niet opgeruimd'); fouten++; }
if (max > 200) { console.log('FOUT: te veel stukken tegelijk', max); fouten++; }
console.log(`1600 blokken gereisd in ${((performance.now() - t0) / 1000).toFixed(1)} s, hooguit ${max} stukken tegelijk (ver weg: ${ver}), begin opgeruimd: ${weg}, goudblokken terug: ${terug.join(',') === [G.B.goudblok, G.B.goudblok].join(',')}, ${berichten} berichten`);
console.log(fouten ? fouten + ' FOUTEN' : 'duurtest goed');
process.exit(fouten ? 1 : 0);
