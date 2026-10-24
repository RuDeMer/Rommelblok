// Maakt de ene rommelblok.html voor rubensrommelhoekje.nl:
//   node site/maak-pagina.js [--gedeeld <rommelblok.html van de site>] [--uit <map>] [--samen <wss://adres van de spelserver>]
// De pagina bestaat uit:
//   1. de <head> (site/kop.html, met het veiligheidsbeleid) en de stijl (client/src/stijl/stijl.css);
//   2. de HTML van de schermen (client/src/stijl/lichaam.html);
//   3. het gedeelde scorebord-script (site/gedeeld/scorebord.html), letterlijk zoals op de site;
//   4. het spel: één <script> met alle code (gebundeld met rollup, niet verkleind);
//   5. de gedeelde grapjes (site/gedeeld/grapjes.html), letterlijk zoals op de site.
// Met --gedeeld haalt hij de twee gedeelde blokken eerst opnieuw uit de nieuwste rommelblok.html van de site,
// zodat de pagina nooit een verouderde kopie krijgt als de beherende Claude ze intussen overal heeft bijgewerkt.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import rommelblok, { maakHtml } from '../client/rommelblok-plugin.js';

const HIER = path.dirname(fileURLToPath(import.meta.url)), WORTEL = path.join(HIER, '..');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const lees = p => fs.readFileSync(p, 'utf8');

// ---------- de gedeelde blokken van de site
export function gedeeldeBlokken(html) {
  const blok = merk => {
    const i = html.indexOf(merk); if (i < 0) throw new Error('niet gevonden: ' + merk);
    if (html.indexOf(merk, i + 1) >= 0) throw new Error('twee keer: ' + merk);
    const a = html.lastIndexOf('<script>', i), b = html.indexOf('</script>', i) + '</script>'.length;
    return html.slice(a, b);
  };
  return { scorebord: blok('const SLEUTELS'), grapjes: blok('GRAPJES: verborgen grapjes') };
}
const bron = arg('--gedeeld');
if (bron) {
  const g = gedeeldeBlokken(lees(bron));
  for (const [n, t] of Object.entries(g)) {
    const p = path.join(HIER, 'gedeeld', n + '.html'), was = fs.existsSync(p) ? lees(p) : '';
    if (was !== t) { fs.writeFileSync(p, t); console.log('gedeeld blok bijgewerkt uit de site:', n); }
  }
}

// ---------- het spel bundelen
const t0 = Date.now();
const bundel = await rollup({ input: path.join(WORTEL, 'client', 'src', 'main.js'), plugins: [rommelblok()], treeshake: false, onwarn: w => { throw new Error('bundelen: ' + w.message); } });
const { output } = await bundel.generate({ format: 'iife', indent: false });
await bundel.close();
const code = output[0].code.trim();

// ---------- het adres van de spelserver (zonder --samen staat de knop Samen spelen uit; zie stap 7)
let spel = code;
const samen = arg('--samen');
if (samen) {
  if (!/^wss:\/\/[a-z0-9.-]+(:\d+)?\/[a-z]*$/i.test(samen)) throw new Error('--samen moet een wss://-adres zijn, bijvoorbeeld wss://blok.rubensrommelhoekje.nl/samen');
  const leeg = "const SAMEN_SERVER = '';";
  if (spel.split(leeg).length !== 2) throw new Error('SAMEN_SERVER niet (precies één keer) gevonden');
  spel = spel.replace(leeg, () => 'const SAMEN_SERVER = ' + JSON.stringify(samen) + ';');
  console.log('spelserver:', samen);
}

// ---------- de pagina in elkaar zetten
const html = maakHtml(spel);
// geen scripts van buiten, en de gedeelde blokken precies één keer
if (/<script[^>]+src=/i.test(html)) throw new Error('een script van buiten in de pagina');
const g = gedeeldeBlokken(html);
if (g.scorebord !== lees(path.join(HIER, 'gedeeld', 'scorebord.html')) || g.grapjes !== lees(path.join(HIER, 'gedeeld', 'grapjes.html'))) throw new Error('gedeelde blokken niet letterlijk overgenomen');

const UIT = arg('--uit') || path.join(WORTEL, 'dist');
fs.mkdirSync(UIT, { recursive: true });
fs.writeFileSync(path.join(UIT, 'rommelblok.html'), html);
// de opnames (CC0, zie client/geluiden/BRONNEN.md) staan in een eigen bestand naast de pagina; de pagina haalt het
// pas op als het spel loopt. Op de site komt het in dezelfde map als rommelblok.html.
const GELUIDEN = path.join(WORTEL, 'client', 'geluiden', 'rommelblok-geluiden.bin');
fs.copyFileSync(GELUIDEN, path.join(UIT, 'rommelblok-geluiden.bin'));
// de tests draaien de pagina uit RB_UIT (of een tijdelijke map)
const TEST = process.env.RB_UIT || path.join(os.tmpdir(), 'rommelblok-uit');
fs.mkdirSync(TEST, { recursive: true });
if (path.resolve(TEST) !== path.resolve(UIT)) { fs.writeFileSync(path.join(TEST, 'rommelblok.html'), html); fs.copyFileSync(GELUIDEN, path.join(TEST, 'rommelblok-geluiden.bin')); }
console.log('gebouwd:', path.join(UIT, 'rommelblok.html'), (html.length / 1024).toFixed(0), 'kB,', html.split('\n').length, 'regels, in', Date.now() - t0, 'ms; geluiden', (fs.statSync(GELUIDEN).size / 1024).toFixed(0), 'kB');
