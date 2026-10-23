// Bewijs: alle schermen zien er in de nieuwe pagina precies zo uit als in de huidige van de site.
// Maakt met test/interface.js dezelfde reeks schermafbeeldingen (computer en telefoon, overleven en bouwen) van
// de referentie en van de nieuwe pagina, zonder het 3D-beeld erachter (dat vergelijkt test/identiek_pagina.js),
// en vergelijkt ze pixel voor pixel.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { PNG } = require('pngjs');
const UIT = require('./uit');
const REF = process.env.RB_REFERENTIE || path.join(__dirname, 'referentie', 'rommelblok-ronde3.html');
fs.copyFileSync(REF, path.join(UIT, 'referentie.html'));
const draai = (bestand, voor) => execFileSync('node', [path.join(__dirname, 'interface.js')], { env: Object.assign({}, process.env, { RB_BESTAND: bestand, RB_VOOR: voor, RB_ZONDER_WERELD: '1' }), encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
console.log('referentie:', draai('referentie.html', 'ref').trim().split('\n').pop());
console.log('nieuw:', draai('rommelblok.html', 'nieuw').trim().split('\n').pop());
let n = 0, anders = 0;
for (const f of fs.readdirSync(UIT).filter(f => /^ref_.*\.png$/.test(f)).sort()) {
  const g = f.replace(/^ref_/, 'nieuw_'), a = fs.readFileSync(path.join(UIT, f)), b = fs.existsSync(path.join(UIT, g)) ? fs.readFileSync(path.join(UIT, g)) : null;
  n++;
  if (!b) { console.log('ontbreekt:', g); anders++; continue; }
  if (a.equals(b)) continue;
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  let px = 0; if (A.width !== B.width || A.height !== B.height) px = -1; else for (let i = 0; i < A.data.length; i += 4) if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > 0) px++;
  if (px) { anders++; console.log('anders:', f.slice(4), px < 0 ? 'andere maat' : px + ' pixels'); }
}
fs.unlinkSync(path.join(UIT, 'referentie.html'));
console.log(anders ? 'MISLUKT: ' + anders + ' van ' + n + ' schermen anders' : 'alle ' + n + ' schermen pixel voor pixel gelijk aan de huidige versie');
process.exit(anders || !n ? 1 : 0);
