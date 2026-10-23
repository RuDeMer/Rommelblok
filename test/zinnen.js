const UIT = require('./uit');
// alle zinnen die vertaald moeten worden: t('...') in de code en data-t in de html
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', 'client', 'src', 'spel'), stijl = path.join(__dirname, '..', 'client', 'src', 'stijl');
const zinnen = new Set();
for (const f of fs.readdirSync(src).filter(f => /^p\d.*\.js$/.test(f))) {
  const s = fs.readFileSync(path.join(src, f), 'utf8');
  for (const m of s.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) zinnen.add(m[1].replace(/\\'/g, "'"));
  // vaste lijsten met teksten die later door t() gaan
  for (const m of s.matchAll(/\[\s*'[a-zA-Z]+'\s*,\s*'((?:[^'\\]|\\.)*)'\s*(?:,\s*'((?:[^'\\]|\\.)*)')?/g)) { if (/^[A-Z]/.test(m[1]) && m[1].includes(' ') || /^(Automatisch|Laag|Midden|Hoog|Tikken|Kruisje|Nederlands|English|Aan|Uit|Alles|Basis|Gereedschap|Bouwen|Licht|Handig|Eten|Kleur|Natuur|Planten|Bouwblokken)$/.test(m[1])) zinnen.add(m[1]); if (m[2]) zinnen.add(m[2]); }
}
const html = fs.readFileSync(path.join(stijl, 'lichaam.html'), 'utf8');
for (const m of html.matchAll(/data-t>([\s\S]*?)<\/(span|h2|p|button|b|small|a)>/g)) zinnen.add(m[1]);
for (const m of html.matchAll(/data-t-(?:label|titel|plek)="[^"]*"/g)) {}
for (const m of html.matchAll(/(?:aria-label|placeholder)="([^"]*)"\s+data-t-(?:label|plek)/g)) zinnen.add(m[1]);
for (const m of html.matchAll(/data-t-(?:label|plek)="([^"]*)"/g)) zinnen.add(m[1]);
fs.writeFileSync(path.join(UIT, 'zinnen.json'), JSON.stringify([...zinnen], null, 1));
console.log(zinnen.size, 'zinnen');
