// ruilen: elke ruil bestaat, is iets minder waard voor jou dan wat je geeft (zodat er geen voordeel in rondjes ruilen zit),
// maar ook niet absurd duur, en nooit met robijnen, sterrensplinters of iets waar die in zitten
const fs = require('fs'), path = require('path');
const { gedeeld } = require('./laad.js'); const G = gedeeld(), waarde = require('./waarde.js')(G);
const bron = require('./bron')('p6c_bewoners.js');
const RUIL = eval('(' + bron.slice(bron.indexOf('const RUIL = ') + 13, bron.indexOf('const NAMEN')).trim().replace(/;$/, '') + ')');
const id = s => (G.I[s] !== undefined ? G.I[s] : G.B[s]);
const VERBODEN = new Set(['robijn', 'sterrensplinter', 'sterrensteen', 'robijnblok', 'kompas']);
let fouten = 0; const fout = t => { console.log('FOUT ' + t); fouten++; };
const rijen = [];
for (const [beroep, lijst] of Object.entries(RUIL)) {
  if (lijst.length < 4) fout(`${beroep}: maar ${lijst.length} ruilen`);
  for (const a of lijst) {
    const alles = [...a.geef.map(g => g[0]), a.krijg[0]];
    for (const s of alles) { if (id(s) === undefined) fout(`${beroep}: onbekend voorwerp ${s}`); if (VERBODEN.has(s) || /robijn|_ster$/.test(s)) fout(`${beroep}: ${s} hoort niet in een ruil`); }
    if (!(a.max >= 1 && a.max <= 16)) fout(`${beroep}: max ${a.max}`);
    const geef = a.geef.reduce((t, [s, n]) => t + waarde(id(s)) * n, 0), krijg = waarde(id(a.krijg[0])) * a.krijg[1], q = geef / krijg;
    rijen.push(`${beroep.padEnd(15)} ${a.geef.map(([s, n]) => n + ' ' + s).join(' + ').padEnd(28)} -> ${(a.krijg[1] + ' ' + a.krijg[0]).padEnd(18)} waarde ${geef.toFixed(1).padStart(5)} voor ${krijg.toFixed(1).padStart(5)}  (${q.toFixed(2)}x)`);
    if (!isFinite(q)) fout(`${beroep}: geen waarde voor ${alles.join(', ')}`);
    else if (q < 1.02) fout(`${beroep}: ${a.krijg[0]} is te goedkoop (${q.toFixed(2)})`);
    else if (q > 1.8) fout(`${beroep}: ${a.krijg[0]} is te duur (${q.toFixed(2)})`);
  }
}
console.log(rijen.join('\n'));
console.log(fouten ? fouten + ' FOUTEN' : `ruilen: alles goed (${rijen.length} ruilen, elke ruil kost 1,02 tot 1,8 keer wat je krijgt)`);
process.exit(fouten ? 1 : 0);
