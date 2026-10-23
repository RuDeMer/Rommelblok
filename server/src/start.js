// De spelserver van Rommelblok starten: node src/start.js (de instellingen komen uit omgevingsvariabelen, zie .env.voorbeeld)
import { leesInstellingen } from './instellingen.js';
import { maakServer } from './server.js';

let inst;
try { inst = leesInstellingen(); } catch (e) { console.error('Instellingen kloppen niet:', e.message); process.exit(1); }
const server = maakServer(inst);
const adres = await server.luister();
console.log(`Rommelblok-spelserver luistert op ${adres.address}:${adres.port}${inst.pad} (herkomst: ${inst.herkomst.join(', ')})${inst.beheer ? '' : ' - zonder beheer (BEHEER is niet ingesteld)'}`);
// netjes stoppen (Docker stuurt SIGTERM): alle werelden bewaren
let stopt = false;
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => {
  if (stopt) return; stopt = true;
  console.log('Stoppen: alles wordt bewaard...');
  await server.sluit();
  process.exit(0);
});
