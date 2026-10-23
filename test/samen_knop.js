// De knop Samen spelen: zonder --samen staat hij uit (de server draait pas vanaf stap 7), met --samen gaat hij naar dat adres.
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const UIT = require('./uit');
let fouten = 0; const goed = (b, t) => { console.log((b ? 'goed ' : 'FOUT ') + t); if (!b) fouten++; };
const html = fs.readFileSync(path.join(UIT, 'rommelblok.html'), 'utf8');
goed(html.split("const SAMEN_SERVER = '';").length === 2, 'de gewone pagina heeft geen adres van een spelserver (de knop staat uit)');
const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-knop-'));
const maak = (...a) => { try { return execFileSync(process.execPath, [path.join(__dirname, '..', 'site', 'maak-pagina.js'), '--uit', map, ...a], { encoding: 'utf8', env: Object.assign({}, process.env, { RB_UIT: map }), stdio: 'pipe' }); } catch (e) { return 'FOUT ' + (e.stderr || e.message); } };
maak('--samen', 'wss://blok.rubensrommelhoekje.nl/samen');
const met = fs.readFileSync(path.join(map, 'rommelblok.html'), 'utf8');
goed(met.includes('const SAMEN_SERVER = "wss://blok.rubensrommelhoekje.nl/samen";'), 'met --samen gaat de knop naar wss://blok.rubensrommelhoekje.nl/samen');
goed(/moet een wss/.test(maak('--samen', 'http://ergens.example/samen')), 'een adres zonder wss:// wordt geweigerd');
process.exit(fouten ? 1 : 0);
