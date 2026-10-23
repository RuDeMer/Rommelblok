// De instellingen van de spelserver komen uit omgevingsvariabelen (zie .env.voorbeeld). Er staan geen geheimen in de code.
import { GRENS } from '../../shared/samen.js';

const STANDAARD_HERKOMST = [
  'https://rubensrommelhoekje.nl', 'https://www.rubensrommelhoekje.nl',
  // de desktop-app (Tauri): op Mac en Linux tauri://localhost, op Windows http(s)://tauri.localhost
  'tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost',
];

// welke grens bij welke omgevingsvariabele hoort
const GRENS_ENV = {
  berichtGrootte: 'MAX_BERICHT', perSeconde: 'MAX_PER_SECONDE', piek: 'MAX_PIEK', actiesPerSeconde: 'MAX_ACTIES', zinElke: 'ZIN_ELKE',
  perAdres: 'MAX_PER_ADRES', spelersPerWereld: 'MAX_SPELERS', wereldenPerDag: 'MAX_NIEUW_PER_DAG', wereldenTotaal: 'MAX_WERELDEN',
  stil: 'STIL_SECONDEN', levensteken: 'LEVENSTEKEN_SECONDEN', fouteCodes: 'MAX_FOUTE_CODES',
};

export function leesInstellingen(env = process.env) {
  const getal = (naam, std, min, max) => {
    const v = env[naam]; if (v === undefined || v === '') return std;
    const x = Number(v);
    if (!Number.isFinite(x) || x < min || x > max) throw new Error(`${naam} moet een getal van ${min} tot ${max} zijn (nu: ${v})`);
    return x;
  };
  const grens = {};
  for (const [k, n] of Object.entries(GRENS_ENV)) grens[k] = getal(n, GRENS[k], k === 'zinElke' ? 0 : 1, 1e7);
  const I = {
    poort: getal('PORT', 8090, 0, 65535), // 0: een vrije poort (voor tests)
    // alleen op de computer zelf luisteren: nginx zet https ervoor (zie de uitleg voor de VPS)
    host: env.HOST || '127.0.0.1',
    dbPad: env.DB_PAD || './data/rommelblok.db',
    herkomst: (env.ORIGINS ? env.ORIGINS.split(',') : STANDAARD_HERKOMST).map(s => s.trim().replace(/\/+$/, '')).filter(Boolean),
    pad: env.PAD || '/samen',
    beheer: env.BEHEER || '',
    // alleen om te testen: een map met rommelblok.html, die de server dan ook laat zien (zelfde adres, dus de CSP laat ws toe)
    statisch: env.STATISCH || '',
    // hoe ver de server rond elke speler de wereld bijhoudt (in stukken van 16 blokken; water en groei)
    serverStraal: getal('SERVER_STRAAL', 4, 2, 8),
    // hoeveel gedeelde werelden er tegelijk open mogen zijn, en hoeveel verbindingen er in totaal mogen zijn
    maxActief: getal('MAX_ACTIEF', 20, 1, 500),
    maxVerbindingen: getal('MAX_VERBINDINGEN', 200, 1, 100000),
    // foute uitnodigingscodes van alle adressen samen, per 10 minuten (tegen raden vanaf heel veel adressen tegelijk)
    maxFouteCodesTotaal: getal('MAX_FOUTE_CODES_TOTAAL', 200, 1, 1e6),
    grens,
  };
  if (I.beheer && I.beheer.length < 12) throw new Error('BEHEER (het beheerwachtwoord) moet minstens 12 tekens zijn');
  if (!I.herkomst.length) throw new Error('ORIGINS is leeg');
  return I;
}
