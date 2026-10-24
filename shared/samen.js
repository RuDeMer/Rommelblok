// Samen spelen (stap 5): wat de pagina en de spelserver allebei weten.
// Gedeelde code: draait op de pagina en op de server, zonder DOM.
// - de versie van de afspraken (een oude pagina krijgt dan "Ververs de pagina")
// - namen van twee woorden (over de lijn gaan alleen twee nummers; iedereen ziet de naam in zijn eigen taal)
// - de vaste zinnetjes en plaatjes om te praten (ook alleen een nummer)
// - uitnodigingscodes, en de regels die de server nakijkt (bereik, tempo, hakken, bewegen)
import { BL } from './blokken.js';
import { naamTekstKlopt } from './filter.js';
// het filter voor vrij typen en eigen namen (zie filter.js): ook via G.SAMEN te gebruiken
export { tekstKlopt, naamTekstKlopt, naamSleutel, scheldwoord, REDEN as FILTER_REDEN, MAX_TEKST } from './filter.js';

// 2 (oktober 2026): bladeren van bomen hebben het merkje van de natuur, nieuwe werelden meer steenkool (erts 2), eigen namen,
// vrij typen, commando's en weer. Een pagina met een ander nummer hoort: ververs de pagina.
export const PROTOCOL = 2;

// ---------------- namen: [bijvoeglijk naamwoord, ding]; alleen de-woorden, dan klopt 'Snelle Egel' altijd
export const NAAM_A = [
  ['Snelle', 'Quick'], ['Blauwe', 'Blue'], ['Rode', 'Red'], ['Groene', 'Green'], ['Gele', 'Yellow'], ['Paarse', 'Purple'], ['Vrolijke', 'Happy'],
  ['Dappere', 'Brave'], ['Slimme', 'Clever'], ['Stille', 'Quiet'], ['Grappige', 'Funny'], ['Kleine', 'Little'], ['Grote', 'Big'], ['Zonnige', 'Sunny'],
  ['Sterke', 'Strong'], ['Zachte', 'Soft'], ['Gouden', 'Golden'], ['Zilveren', 'Silver'], ['Vliegende', 'Flying'], ['Dansende', 'Dancing'],
  ['Springende', 'Jumping'], ['Slaperige', 'Sleepy'], ['Lieve', 'Kind'], ['Rustige', 'Calm'], ['Gekke', 'Silly'], ['Oranje', 'Orange'],
];
export const NAAM_B = [
  ['Egel', 'Hedgehog'], ['Lantaarn', 'Lantern'], ['Uil', 'Owl'], ['Vos', 'Fox'], ['Kikker', 'Frog'], ['Draak', 'Dragon'], ['Ster', 'Star'],
  ['Raket', 'Rocket'], ['Wolk', 'Cloud'], ['Vlinder', 'Butterfly'], ['Bij', 'Bee'], ['Eekhoorn', 'Squirrel'], ['Pinguïn', 'Penguin'], ['Kat', 'Cat'],
  ['Mol', 'Mole'], ['Muis', 'Mouse'], ['Panda', 'Panda'], ['Otter', 'Otter'], ['Komeet', 'Comet'], ['Toren', 'Tower'], ['Boot', 'Boat'],
  ['Fiets', 'Bike'], ['Trein', 'Train'], ['Peer', 'Pear'], ['Taart', 'Tart'], ['Wafel', 'Waffle'], ['Knikker', 'Marble'], ['Ballon', 'Balloon'],
  ['Robot', 'Robot'], ['Ridder', 'Knight'], ['Piraat', 'Pirate'], ['Walvis', 'Whale'], ['Schildpad', 'Turtle'], ['Zeehond', 'Seal'], ['Kabouter', 'Gnome'],
];
export const naamKlopt = n => Array.isArray(n) && n.length === 2 && Number.isInteger(n[0]) && Number.isInteger(n[1]) && n[0] >= 0 && n[0] < NAAM_A.length && n[1] >= 0 && n[1] < NAAM_B.length;
// een naam is twee woorden ([nummer, nummer]), of een eigen naam (tekst) als de eigenaar dat aanzette
export const naamVan = (n, taal) => (naamKlopt(n) ? NAAM_A[n[0]][taal === 'en' ? 1 : 0] + ' ' + NAAM_B[n[1]][taal === 'en' ? 1 : 0] : typeof n === 'string' && naamTekstKlopt(n).ok ? n : '?');
export const naamWillekeurig = r => [Math.floor(r() * NAAM_A.length) % NAAM_A.length, Math.floor(r() * NAAM_B.length) % NAAM_B.length];

// ---------------- praten: alleen vaste zinnetjes en plaatjes
export const ZINNEN = [
  ['Hoi!', 'Hi!'], ['Kom eens kijken!', 'Come and look!'], ['Help!', 'Help!'], ['Dank je!', 'Thanks!'], ['Goed gedaan!', 'Well done!'],
  ['Volg mij!', 'Follow me!'], ['Wacht even!', 'Wait a moment!'], ['Ja!', 'Yes!'], ['Nee', 'No'], ['Mooi!', 'Nice!'], ['Pas op!', 'Watch out!'],
  ['Ik ben hier', 'I am here'], ['Zullen we samen bouwen?', 'Shall we build together?'], ['Sorry!', 'Sorry!'], ['Ik ga even eten', 'Going to eat'],
  ['Tot morgen!', 'See you tomorrow!'], ['👍', '👍'], ['❤️', '❤️'], ['❓', '❓'], ['😄', '😄'], ['😮', '😮'], ['🎉', '🎉'],
];
export const zinKlopt = n => Number.isInteger(n) && n >= 0 && n < ZINNEN.length;

// ---------------- uitnodigingscodes: woord-woord-woord-getal, bijvoorbeeld blauwe-lantaarn-egel-42
// (31 miljoen mogelijkheden; de server laat per adres maar een paar foute pogingen toe en bewaart alleen een hash)
const CODE_A = NAAM_A.map(a => a[0].toLowerCase()), CODE_B = NAAM_B.map(b => b[0].toLowerCase().replace('ï', 'i'));
export function maakCode(r) {
  const k = a => a[Math.floor(r() * a.length) % a.length];
  return k(CODE_A) + '-' + k(CODE_B) + '-' + k(CODE_B) + '-' + (10 + Math.floor(r() * 990) % 990);
}
// wat iemand intypt netjes maken (hoofdletters, spaties, streepjes); null als het geen code kan zijn
export function schoonCode(s) {
  const c = String(s == null ? '' : s).toLowerCase().trim().replace(/ï/g, 'i').replace(/[\s_.]+/g, '-').replace(/-+/g, '-');
  return /^[a-z]{2,12}-[a-z]{2,12}-[a-z]{2,12}-\d{2,3}$/.test(c) ? c : null;
}

// ---------------- grenzen (de server kan ze met omgevingsvariabelen veranderen)
export const GRENS = {
  berichtGrootte: 16384, perSeconde: 40, piek: 80, actiesPerSeconde: 10, zinElke: 2, perAdres: 4, spelersPerWereld: 8,
  wereldenPerDag: 3, wereldenTotaal: 200, stil: 60, levensteken: 15, fouteCodes: 8,
};

// ---------------- wat de server nakijkt
export const BEREIK = 6.5;           // hoe ver je mag hakken of bouwen (vanaf je ogen, met wat speling)
// hoe snel je hooguit kunt gaan (blokken per seconde, met speling): lopen 4,3, rennen 5,8, een karretje 11, vliegen 21,
// omhoog stuiteren tot 22; met een voorraad (blokken) voor een haperende verbinding, waarin berichten soms tegelijk aankomen
export const SNEL = { grond: 9, kar: 14, vliegen: 24, omhoog: 24, omlaag: 80, voorraad: 24, voorraadOmhoog: 32 };
// hoe lang hakken op zijn snelst duurt (in seconden; zonder de straffen voor in de lucht of onder water, dus de kortste tijd)
export function hakMin(v, it) {
  const b = BL[v & 255]; if (!b || b.hard < 0) return -1;
  if (b.hard === 0) return 0;
  const g = it && it.gereed ? it : null, juist = !!(g && b.gereed && g.gereed === b.gereed);
  const oogst = !b.klasse || (juist && g.klasse >= b.klasse);
  return oogst ? (b.hard * 1.5) / (juist ? g.snel : 1) : b.hard * 5;
}
