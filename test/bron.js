// de tekst van een bronbestand, om in een testpagina te zetten: bron('geluid.js'), bron('p6c_bewoners.js')
// (bij de motor en de rekenhulpjes zonder het woord export, zodat het als gewoon script werkt)
const fs = require('fs'), path = require('path');
const MAPPEN = ['client/src/spel', 'client/src/motor', 'client/src/werkers'].map(m => path.join(__dirname, '..', m));
function bron(naam) {
  for (const m of MAPPEN) { const p = path.join(m, naam); if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').replace(/^export function /gm, 'function '); }
  throw new Error('geen bron: ' + naam);
}
module.exports = bron;
