// De bouwsteen die Vite (om te werken) en site/maak-pagina.js (de pagina voor de site) allebei gebruiken.
//
// virtual:gedeeld  RB_GEDEELD(): de hele gedeelde code (shared/) als één functie. De pagina roept hem aan, en geeft
//                  zijn tekst (RB_GEDEELD.toString()) mee aan de rekenhulpjes. Zo staat de gedeelde code maar één keer
//                  in de pagina, en kunnen de rekenhulpjes uit een Blob starten (worker-src blob:), zonder eval.
// virtual:spel     de spelcode in client/src/spel/, in volgorde van de bestandsnamen samen in één module, zoals vroeger
//                  in één script. De delen delen hun gegevens (WD, sp, inst, R, ...), daarom horen ze in één geheel.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';

const HIER = path.dirname(fileURLToPath(import.meta.url));
export const MAPPEN = {
  shared: path.join(HIER, '..', 'shared'),
  spel: path.join(HIER, 'src', 'spel'),
  motor: path.join(HIER, 'src', 'motor'),
  werkers: path.join(HIER, 'src', 'werkers'),
  stijl: path.join(HIER, 'src', 'stijl'),
};

// de gedeelde code als tekst van één functie
export async function gedeeldBron() {
  const b = await rollup({ input: path.join(MAPPEN.shared, 'index.js'), treeshake: false, onwarn: w => { throw new Error('gedeelde code: ' + w.message); } });
  const { output } = await b.generate({ format: 'iife', name: 'RB_GEDEELD_UIT', exports: 'named', indent: '  ' });
  await b.close();
  const code = output[0].code.trim();
  const begin = 'var RB_GEDEELD_UIT = ';
  if (!code.startsWith(begin) || !code.endsWith(';')) throw new Error('onverwachte vorm van de gedeelde code');
  return 'export function RB_GEDEELD() {\n  return ' + code.slice(begin.length, -1) + '.G;\n}\n';
}

// de spelbestanden, in volgorde
export const spelDelen = () => fs.readdirSync(MAPPEN.spel).filter(f => /^p\d.*\.js$/.test(f)).sort();
export function spelBron() {
  const kop = [
    "import { RB_GEDEELD } from 'virtual:gedeeld';",
    `import { RB_MAKER, RB_WERELD } from ${JSON.stringify(path.join(MAPPEN.werkers, 'werker.js'))};`,
    `import { RB_TEXTUREN, RB_ICONEN } from ${JSON.stringify(path.join(MAPPEN.motor, 'texturen.js'))};`,
    `import { RB_GELUID } from ${JSON.stringify(path.join(MAPPEN.motor, 'geluid.js'))};`,
    `import { RB_TEKENAAR } from ${JSON.stringify(path.join(MAPPEN.motor, 'tekenaar.js'))};`,
  ].join('\n');
  return kop + '\n\n' + spelDelen().map(f => '// ---- ' + f + '\n' + fs.readFileSync(path.join(MAPPEN.spel, f), 'utf8')).join('\n');
}

// de pagina in elkaar zetten uit site/pagina.html. code: het script van het spel; zonder code (tijdens het werken)
// komt er een module-script naar /src/main.js in de plaats
export const SITE = path.join(HIER, '..', 'site');
const lees = p => fs.readFileSync(p, 'utf8');
export function maakHtml(code) {
  let html = lees(path.join(SITE, 'pagina.html'));
  const vul = (k, v) => { if (html.split(k).length !== 2) throw new Error(k + ' moet precies één keer in pagina.html staan'); html = html.replace(k, () => v); };
  vul('{{KOP}}', lees(path.join(SITE, 'kop.html')).trim());
  vul('{{CSS}}', lees(path.join(MAPPEN.stijl, 'stijl.css')).trim());
  vul('{{HTML}}', lees(path.join(MAPPEN.stijl, 'lichaam.html')).trim());
  vul('{{SCOREBORD}}', lees(path.join(SITE, 'gedeeld', 'scorebord.html')));
  vul('{{GRAPJES}}', lees(path.join(SITE, 'gedeeld', 'grapjes.html')));
  if (code === undefined) { const k = '<script>\n{{CODE}}\n</script>'; if (!html.includes(k)) throw new Error('geen plek voor het spel'); html = html.replace(k, '<script type="module" src="/src/main.js"></script>'); }
  else vul('{{CODE}}', code);
  return html;
}

export default function rommelblok() {
  return {
    name: 'rommelblok',
    resolveId(id) { if (id === 'virtual:gedeeld' || id === 'virtual:spel') return '\0' + id; return null; },
    async load(id) {
      if (id === '\0virtual:gedeeld') { for (const f of alleBestanden(MAPPEN.shared)) this.addWatchFile(f); return gedeeldBron(); }
      if (id === '\0virtual:spel') { for (const f of spelDelen()) this.addWatchFile(path.join(MAPPEN.spel, f)); return spelBron(); }
      return null;
    },
    // tijdens het werken: index.html wordt dezelfde pagina als op de site, met het spel als module
    transformIndexHtml: { order: 'pre', handler: () => maakHtml() },
    // tijdens het werken: bij elke verandering de hele pagina opnieuw laden (de spelcode is één geheel)
    handleHotUpdate({ file, server }) {
      if (file.startsWith(MAPPEN.shared) || file.startsWith(MAPPEN.spel)) {
        for (const id of ['\0virtual:gedeeld', '\0virtual:spel']) { const m = server.moduleGraph.getModuleById(id); if (m) server.moduleGraph.invalidateModule(m); }
        server.ws.send({ type: 'full-reload' }); return [];
      }
      return undefined;
    },
  };
}
export function alleBestanden(map) {
  const uit = [];
  for (const e of fs.readdirSync(map, { withFileTypes: true })) { const p = path.join(map, e.name); if (e.isDirectory()) uit.push(...alleBestanden(p)); else if (p.endsWith('.js')) uit.push(p); }
  return uit;
}
