// Je eigen poppetje: welke keuzes er zijn, en het nakijken ervan.
// Gedeelde code: draait op de pagina en op de server (die controleert het poppetje van andere spelers).
//
// Een poppetje is een rijtje kleine getallen (zo blijft het in rommelblok-v3 klein, en gaat het mee met koppelen):
//   [versie, huid, haar, haarKleur, ogen, mond, extra, boven, bovenKleur, onder, onderKleur, schoenKleur, acc, accKleur]
import { PALET, dtex } from './blokken.js';

export const POP_VERSIE = 1;
export const POP_VELDEN = ['huid', 'haar', 'haarKleur', 'ogen', 'mond', 'extra', 'boven', 'bovenKleur', 'onder', 'onderKleur', 'schoenKleur', 'acc', 'accKleur'];
// de eerste zes huidskleuren zijn die van de oude instelling 'huid' (in dezelfde volgorde); daarna een heel lichte en een heel donkere
export const POP_HUID = ['#F1D3BC', '#E3B591', '#C68C62', '#A36A45', '#7B4B2E', '#4F3020', '#FBE7D8', '#3A2418'];
export const POP_HUID_VOLGORDE = [6, 0, 1, 2, 3, 4, 5, 7]; // van licht naar donker, voor het kiesscherm
export const POP_HAARKLEUR = ['#1E1A1A', '#3B2518', '#6B4226', '#8A3E1E', '#B5432A', '#D9B464', '#EFD99A', '#A6A29A', '#3E6FB0', '#E58FB4'];
export const POP_KLEUR = PALET.map(p => p[4]); // de 12 kleuren van het rommelhoekje, voor kleren en spullen
// [sleutel, nl, en]
export const POP_KEUZES = {
  haar: [['kort', 'Kort', 'Short'], ['krullen', 'Krullen', 'Curls'], ['staart', 'Paardenstaart', 'Ponytail'], ['knot', 'Knot', 'Bun'], ['lang', 'Lang', 'Long'],
    ['stekels', 'Stekels', 'Spikes'], ['vlechtjes', 'Vlechtjes', 'Braids'], ['kuif', 'Opgeschoren', 'Undercut'], ['kaal', 'Kaal', 'Bald']],
  ogen: [['rond', 'Rond', 'Round'], ['groot', 'Groot', 'Big'], ['blij', 'Blij', 'Happy'], ['knipoog', 'Knipoog', 'Wink'], ['slaperig', 'Slaperig', 'Sleepy'], ['wimpers', 'Wimpers', 'Lashes']],
  mond: [['lach', 'Lach', 'Smile'], ['grijns', 'Grote lach', 'Big grin'], ['oh', 'Oh!', 'Oh!'], ['tandjes', 'Tandjes', 'Teeth'], ['rustig', 'Rustig', 'Calm']],
  extra: [['geen', 'Niets', 'Nothing'], ['sproetjes', 'Sproetjes', 'Freckles'], ['blosjes', 'Blosjes', 'Rosy cheeks'], ['bril', 'Brilletje', 'Glasses']],
  boven: [['tshirt', 'T-shirt', 'T-shirt'], ['trui', 'Trui', 'Sweater'], ['hoodie', 'Hoodie', 'Hoodie'], ['overall', 'Overall', 'Dungarees'], ['jasje', 'Jasje', 'Jacket'], ['jurk', 'Jurk', 'Dress']],
  onder: [['broek', 'Broek', 'Trousers'], ['kort', 'Korte broek', 'Shorts'], ['rok', 'Rok', 'Skirt'], ['jogging', 'Joggingbroek', 'Joggers']],
  acc: [['geen', 'Niets', 'Nothing'], ['pet', 'Pet', 'Cap'], ['muts', 'Muts', 'Beanie'], ['strik', 'Strik', 'Bow'], ['koptelefoon', 'Koptelefoon', 'Headphones'],
    ['sjaal', 'Sjaal', 'Scarf'], ['rugzakje', 'Rugzakje', 'Little backpack'], ['bloem', 'Bloem in je haar', 'Flower in your hair'], ['hoed', 'Hoed', 'Hat'], ['kroontje', 'Kroontje', 'Little crown']],
};
export const POP_AANTAL = {
  huid: POP_HUID.length, haar: POP_KEUZES.haar.length, haarKleur: POP_HAARKLEUR.length, ogen: POP_KEUZES.ogen.length, mond: POP_KEUZES.mond.length,
  extra: POP_KEUZES.extra.length, boven: POP_KEUZES.boven.length, bovenKleur: POP_KLEUR.length, onder: POP_KEUZES.onder.length, onderKleur: POP_KLEUR.length,
  schoenKleur: POP_KLEUR.length, acc: POP_KEUZES.acc.length, accKleur: POP_KLEUR.length,
};
// lange mouwen (dan is de arm in beeld van stof; anders zie je je blote arm met een korte mouw)
export const POP_LANGE_MOUW = new Set(['trui', 'hoodie', 'jasje']);

// het standaardpoppetje, met de huidskleur van de oude instelling: een trui in bordblauw (zoals de oude arm), een bruine broek
export function standaardPop(huid) {
  return [POP_VERSIE, Number.isInteger(huid) && huid >= 0 && huid < 6 ? huid : 1, 0, 1, 0, 0, 0, 1, 7, 0, 10, 11, 0, 2];
}
// nakijken: alles wat niet klopt, wordt het standaardpoppetje (zo kan een kapotte of vreemde waarde nooit iets breken)
export function schoonPop(p, huid) {
  if (!Array.isArray(p) || p.length !== POP_VELDEN.length + 1 || p[0] !== POP_VERSIE) return standaardPop(huid);
  const uit = [POP_VERSIE];
  for (let i = 0; i < POP_VELDEN.length; i++) {
    const v = p[i + 1], n = POP_AANTAL[POP_VELDEN[i]];
    if (!Number.isInteger(v) || v < 0 || v >= n) return standaardPop(huid);
    uit.push(v);
  }
  return uit;
}
export const popWaarde = (p, veld) => p[POP_VELDEN.indexOf(veld) + 1];
export function popZet(p, veld, v) { const q = p.slice(); q[POP_VELDEN.indexOf(veld) + 1] = v; return schoonPop(q); }

// Verras me: willekeurig, maar met kleuren die bij elkaar passen. r() geeft een getal van 0 tot 1.
// Kleren: een kleurige bovenkant, een rustige onderkant (bordblauw, inkt, bruin, manilla of groen) en schoenen die daarbij passen.
const RUSTIG = [7, 11, 10, 1, 9], SCHOEN = [11, 10, 0, 4, 7];
// wat mooi bij een kleur staat (indexen in POP_KLEUR): een kleur en zijn buren op het kleurenwiel, plus wit en inkt
const PAST = { 0: [7, 4, 9, 2], 1: [10, 7, 9, 11], 2: [7, 11, 9, 10], 3: [7, 11, 10, 8], 4: [11, 7, 0, 1], 5: [6, 7, 0, 11], 6: [5, 0, 2, 11], 7: [2, 0, 1, 4], 8: [7, 0, 3, 11], 9: [10, 1, 2, 0], 10: [1, 9, 2, 0], 11: [2, 4, 0, 8] };
export function verrasMe(r) {
  const kies = a => a[Math.floor(r() * a.length) % a.length], tot = n => Math.floor(r() * n) % n;
  const huid = tot(POP_HUID.length);
  // haar: meestal een gewone kleur, soms blauw of roze
  const haarKleur = r() < 0.85 ? tot(8) : 8 + tot(2);
  const bovenKleur = tot(POP_KLEUR.length), onderKleur = kies(RUSTIG.filter(k => k !== bovenKleur));
  const boven = tot(POP_KEUZES.boven.length), acc = r() < 0.45 ? 0 : 1 + tot(POP_KEUZES.acc.length - 1);
  return schoonPop([POP_VERSIE, huid, tot(POP_KEUZES.haar.length), haarKleur, tot(POP_KEUZES.ogen.length), tot(POP_KEUZES.mond.length),
    r() < 0.5 ? 0 : tot(POP_KEUZES.extra.length), boven, bovenKleur, tot(POP_KEUZES.onder.length), onderKleur, kies(SCHOEN), acc, kies(PAST[bovenKleur])]);
}

// de plaatjes voor het gezicht (losse laagjes op het hoofd) en de stof van de arm in beeld; ze komen achteraan in de stapel
for (const [k] of POP_KEUZES.ogen) dtex('pop_ogen_' + k);
for (const [k] of POP_KEUZES.mond) dtex('pop_mond_' + k);
for (const k of ['sproetjes', 'blosjes']) dtex('pop_' + k); // (het brilletje is van staafjes, zie popDelen)
dtex('arm_stof');
