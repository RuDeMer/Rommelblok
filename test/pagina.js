// De gebouwde pagina voor de site (dist/rommelblok.html, of RB_UIT/rommelblok.html):
//   node test/pagina.js [pagina]
// - het veiligheidsbeleid is gelijk aan dat van de huidige site-pagina (alleen in connect-src mag de spelserver erbij komen)
// - het scorebord-script en de grapjes staan er letterlijk in, zoals op de site (site/gedeeld/ en de referentie)
// - op dezelfde plek: na de schermen het scorebord-script, dan het spel, en de grapjes vlak voor </body>
// - geen scripts van buiten, en alles in één bestand
const fs = require('fs'), path = require('path');
const UIT = require('./uit');
const PAD = process.argv[2] || path.join(UIT, 'rommelblok.html');
const REF = process.env.RB_REFERENTIE || path.join(__dirname, 'referentie', 'rommelblok-ronde3.html');
const html = fs.readFileSync(PAD, 'utf8'), ref = fs.readFileSync(REF, 'utf8');
let fouten = 0; const fout = (...a) => { fouten++; console.log('MIS:', ...a); };
const csp = h => (h.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1];
const delen = c => Object.fromEntries(c.split(';').map(s => s.trim()).filter(Boolean).map(s => { const [k, ...v] = s.split(/\s+/); return [k, v]; }));
const a = delen(csp(ref)), b = delen(csp(html));
const SPELSERVER = /^wss:\/\/blok\.rubensrommelhoekje\.nl$/;
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
  const x = a[k] || [], y = b[k] || [];
  const erbij = y.filter(v => !x.includes(v)), eraf = x.filter(v => !y.includes(v));
  if (eraf.length) fout('veiligheidsbeleid:', k, 'mist', eraf.join(' '));
  if (erbij.length && !(k === 'connect-src' && erbij.every(v => SPELSERVER.test(v)))) fout('veiligheidsbeleid:', k, 'heeft er', erbij.join(' '), 'bij');
}
const extra = (b['connect-src'] || []).filter(v => !(a['connect-src'] || []).includes(v));
console.log('veiligheidsbeleid:', fouten ? 'anders' : 'gelijk aan de site' + (extra.length ? ', met de spelserver erbij (' + extra.join(' ') + ')' : ''));
const blok = (h, merk) => { const i = h.indexOf(merk); if (i < 0) return null; if (h.indexOf(merk, i + 1) >= 0) return { dubbel: true }; const s = h.lastIndexOf('<script>', i), e = h.indexOf('</script>', i) + 9; return { t: h.slice(s, e), s, e }; };
const bn = { scorebord: blok(html, 'const SLEUTELS'), grapjes: blok(html, 'GRAPJES: verborgen grapjes'), spel: blok(html, 'function RB_GEDEELD()') };
const br = { scorebord: blok(ref, 'const SLEUTELS'), grapjes: blok(ref, 'GRAPJES: verborgen grapjes') };
for (const k of ['scorebord', 'grapjes']) {
  const site = fs.readFileSync(path.join(__dirname, '..', 'site', 'gedeeld', k + '.html'), 'utf8');
  if (!bn[k] || bn[k].dubbel) fout('gedeeld blok', k, bn[k] ? 'staat er twee keer in' : 'ontbreekt');
  else if (bn[k].t !== site) fout('gedeeld blok', k, 'niet letterlijk gelijk aan site/gedeeld/' + k + '.html');
  else if (bn[k].t !== br[k].t) console.log('gedeeld blok ' + k + ': gelijk aan site/gedeeld/, maar anders dan de referentie (bijgewerkt op de site?)');
  else console.log('gedeeld blok ' + k + ': letterlijk gelijk aan de site');
}
if (bn.scorebord && bn.spel && bn.grapjes && !(bn.scorebord.e <= bn.spel.s && bn.spel.e <= bn.grapjes.s && html.slice(bn.grapjes.e).trim().startsWith('</body>'))) fout('de gedeelde blokken staan niet op hun plek');
else console.log('plek: schermen, scorebord-script, spel, grapjes, </body>');
if (/<script[^>]+src=/i.test(html)) fout('er staat een script van buiten in de pagina');
if (/<link[^>]+rel="stylesheet"[^>]+href="(?!https:\/\/fonts\.googleapis\.com)/i.test(html)) fout('een stylesheet van buiten (behalve Google Fonts)');
console.log('grootte:', (html.length / 1024).toFixed(0), 'kB');
console.log(fouten ? 'MISLUKT' : 'pagina: in orde');
process.exit(fouten ? 1 : 0);
