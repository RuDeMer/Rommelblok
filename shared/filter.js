// Het filter voor vrij typen en eigen namen bij samen spelen (hoofdstuk 5 van multiplayer-plan.md).
// Gedeelde code: de pagina kijkt al na voordat ze iets verstuurt (dan zie je meteen waarom het niet mag),
// en de spelserver kijkt het altijd zelf nog eens na. Alleen wat de server goedkeurt, zien anderen.
//
// - geen scheldwoorden (Nederlands en Engels), ook niet met trucjes: hoofdletters, accenten, cijfers voor letters
//   (k4nk3r), spaties of tekens ertussen (k.a.n.k.e.r) en herhaalde letters (kaaanker)
// - geen links, e-mailadressen of telefoonnummers
// - een bericht hooguit 80 tekens (één regel), een naam 2 tot 16 tekens
// Een woord dat ten onrechte geweigerd wordt, kan uit de lijst; een woord dat ontbreekt, kan erbij (in kleine letters,
// zonder accenten). HEEL: ook binnen een langer woord; LOS: alleen als los woord (zodat 'hoera' en 'class' gewoon mogen).

const HEEL = [
  // ziektes als vloek
  'kanker', 'tyfus', 'kolere', 'pokke', 'pleuris', 'teringl', 'teringz', 'kankerlijer',
  // scheldwoorden
  'klootzak', 'kutwijf', 'hoerenzoon', 'hoerenjong', 'godver', 'godsamme', 'pedofiel',
  // Engels
  'fuck', 'shit', 'bitch', 'cunt', 'whore', 'bastard', 'asshole', 'wanker', 'faggot', 'nigger', 'nigga', 'retard', 'dickhead', 'motherf',
  'killyourself', 'porno', 'porn', 'dildo', 'penis', 'vagina', 'neuken', 'neukt', 'neuk',
];const LOS = [
  'kut', 'kutje', 'kutten', 'lul', 'lullen', 'hoer', 'hoeren', 'hoertje', 'slet', 'sletje', 'debiel', 'neger', 'negers', 'nikker', 'nikkers', 'flikker',
  'mongool', 'mongolen', 'mongo', 'tering', 'klere', 'pedo', 'tiet', 'tieten', 'piemel', 'seks', 'sex', 'sexy', 'seksi', 'naakt',
  'ass', 'dick', 'cock', 'pussy', 'slut', 'fag', 'rape', 'kys', 'tits', 'boobs', 'nude', 'nudes', 'wtf', 'stfu',
]
// letters die als cijfer of teken geschreven kunnen worden
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', '$': 's', '!': 'i', '|': 'i', '€': 'e' };
// kleine letters, zonder accenten, cijfers als letters
export function plat(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[0134578@$!|€]/g, c => LEET[c]);
}
// herhaalde letters: een rij van drie of meer als twee (kloooootzak -> klootzak), of elke rij als één (kaaanker -> kanker).
// Woorden met een dubbele letter vergelijken we alleen met de eerste vorm (anders leest 'zonnige raket' als een scheldwoord).
const twee = w => w.replace(/(.)\1{2,}/g, '$1$1'), een = w => w.replace(/(.)\1+/g, '$1');
const dubbel = w => /(.)\1/.test(w);
const lijkt = (tekst, w) => twee(tekst).includes(w) || (!dubbel(w) && een(tekst).includes(w));
const isWoord = (woord, lijst) => lijst.has(twee(woord)) || lijst.has(een(woord));
const LOS_S = new Set(LOS);
// staat er een woord uit de lijst in?
export function scheldwoord(tekst) {
  const p = plat(tekst), alles = p.replace(/[^a-z]/g, '');
  for (const w of HEEL) if (lijkt(alles, w)) return w;
  const woorden = p.split(/[^a-z]+/).filter(Boolean);
  for (const w of woorden) if (isWoord(w, LOS_S)) return w;
  // losse letters met spaties of puntjes ertussen (k u t), samen gelezen
  const losseLetters = p.replace(/[^a-z\s.\-_*]/g, '').split(/\s{2,}/).map(d => d.split(/[\s.\-_*]+/)).filter(d => d.length >= 3 && d.every(x => x.length === 1)).map(d => d.join(''));
  for (const w of losseLetters) if (isWoord(w, LOS_S)) return w;
  return null;
}
// links, e-mailadressen en telefoonnummers
const LINK = /(https?:|www\.|\b[a-z0-9-]{2,}\s*(\.|\(punt\)|\[punt\]|\spunt\s|\sdot\s)\s*(nl|com|org|net|be|eu|io|gg|tv|me|co|info|app|xyz|ru|de|uk|fr|ly|link|site|online|shop|tk|ml|gl)\b|discord\.?gg|t\.me\/)/i;
const MAIL = /[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\sat\s)\s*[a-z0-9-]+\s*(\.|\spunt\s|\sdot\s)\s*[a-z]{2,}/i;
const TELEFOON = /(?:\d[\s\-.()/]*){7,}/;
// een tekst netjes maken: geen onzichtbare of besturingstekens, één regel, spaties samengevoegd
// onzichtbare tekens en besturingstekens (ook zero-width en tekens die de leesrichting omdraaien) worden een spatie
const ONZICHTBAAR = new RegExp('[' + [[0x0, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff]].map(([a, b]) => '\\u' + a.toString(16).padStart(4, '0') + '-\\u' + b.toString(16).padStart(4, '0')).join('') + ']', 'g');
export function schoon(s) { return String(s == null ? '' : s).replace(ONZICHTBAAR, ' ').replace(/\s+/g, ' ').trim(); }
export const MAX_TEKST = 80;
// een bericht: { ok, tekst } of { ok: false, reden } (reden: leeg, lang, link, mail, telefoon, woord)
export function tekstKlopt(invoer) {
  const tekst = schoon(invoer);
  if (!tekst) return { ok: false, reden: 'leeg' };
  if (tekst.length > MAX_TEKST) return { ok: false, reden: 'lang' };
  if (MAIL.test(tekst)) return { ok: false, reden: 'mail' };
  if (LINK.test(tekst)) return { ok: false, reden: 'link' };
  if (TELEFOON.test(tekst)) return { ok: false, reden: 'telefoon' };
  if (scheldwoord(tekst)) return { ok: false, reden: 'woord' };
  return { ok: true, tekst };
}
// een eigen naam: 2 tot 16 tekens, letters (ook met accenten), cijfers, spatie, - en _; minstens twee letters,
// hooguit vier cijfers (geen telefoonnummer of geboortejaar als naam), en door hetzelfde filter
export function naamTekstKlopt(invoer) {
  const naam = schoon(invoer);
  if (naam.length < 2) return { ok: false, reden: 'kort' };
  if (naam.length > 16) return { ok: false, reden: 'lang' };
  if (!/^[\p{L}\p{N} _-]+$/u.test(naam)) return { ok: false, reden: 'tekens' };
  if ((naam.match(/\p{L}/gu) || []).length < 2) return { ok: false, reden: 'tekens' };
  if ((naam.match(/\d/g) || []).length > 4) return { ok: false, reden: 'cijfers' };
  if (scheldwoord(naam)) return { ok: false, reden: 'woord' };
  return { ok: true, naam };
}
// twee namen zijn dezelfde als ze plat en zonder spaties en tekens gelijk zijn ('Rode Vos' en 'rodevos')
export const naamSleutel = n => plat(n).replace(/[^a-z0-9]/g, '');
// de redenen in gewone taal (de pagina vertaalt ze)
export const REDEN = {
  leeg: 'Er staat nog niets.', lang: 'Dat is te lang.', kort: 'Een naam is minstens twee tekens.', link: 'Links mogen niet.', mail: 'E-mailadressen mogen niet.',
  telefoon: 'Telefoonnummers mogen niet.', woord: 'Dat woord mag hier niet.', tekens: 'Gebruik alleen letters, cijfers, spaties, - en _.', cijfers: 'Niet zoveel cijfers in een naam.',
  bezet: 'Die naam heeft iemand anders al in deze wereld.', uit: 'De eigenaar heeft dit uitgezet.', snel: 'Even wachten…',
};
