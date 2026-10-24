// ============================================================================
// Het logboek (alleen bij overleven): mijlpalen die je onderweg haalt, en een rang die meegroeit.
// Per mijlpaal: id, titel, hoe je hem haalt, en de groep. Een mijlpaal met een voorwerp haal je zodra je het hebt.
// ============================================================================
const LOGBOEK = [
  ['hout', 'Je eerste hout', 'Hak een boomstam.', 'begin'],
  ['werkbank', 'Een eigen werkbank', 'Maak een werkbank van planken.', 'begin'],
  ['houweel', 'Eerste gereedschap', 'Maak een houten houweel.', 'begin'],
  ['steen', 'Steen gehakt', 'Hak steen tot keien.', 'begin'],
  ['oven', 'Het vuur aan', 'Maak een oven van keien.', 'begin'],
  ['fakkel', 'Licht in het donker', 'Maak een fakkel van kolen en een stok.', 'begin'],
  ['nacht', 'De nacht doorstaan', 'Kom een hele nacht door.', 'begin'],
  ['eten', 'Smakelijk eten', 'Eet iets op.', 'leven'],
  ['slapen', 'Lekker geslapen', 'Slaap een nacht in een bed.', 'leven'],
  ['akker', 'Een eigen akker', 'Maak een akker met een schoffel.', 'leven'],
  ['oogst', 'De eerste oogst', 'Oogst een rijp gewas.', 'leven'],
  ['brood', 'Vers brood', 'Bak brood van tarwe.', 'leven'],
  ['ruil', 'Eerlijk geruild', 'Ruil iets met een bewoner van een dorpje.', 'leven'],
  ['hutspot', 'Echte hutspot', 'Maak hutspot met aardappels en wortels.', 'leven'],
  ['taart', 'Een hele taart', 'Bak een taart.', 'leven'],
  ['emmer', 'Water in een emmer', 'Schep water met een emmer.', 'leven'],
  ['melk', 'Verse melk', 'Melk een koe met een emmer.', 'leven'],
  ['wol', 'Zachte wol', 'Scheer een schaap met een schaar.', 'leven'],
  ['pannenkoek', 'Pannenkoeken!', 'Bak een pannenkoek van tarwe, een ei en suiker.', 'leven'],
  ['grot', 'Onder de grond', 'Ga een grot in.', 'verkennen'],
  ['diep', 'Heel diep', 'Kom lager dan 16 blokken boven de bodem van de wereld.', 'verkennen'],
  ['berg', 'Op de top', 'Klim hoger dan 108 blokken.', 'verkennen'],
  ['ver', 'Een verre reis', 'Ga 1000 meter van je startplek.', 'verkennen'],
  ['kaart', 'Een eigen kaart', 'Maak of vind een kaart.', 'verkennen'],
  ['ruine', 'Oude stenen', 'Vind een ruïne.', 'verkennen'],
  ['mijn', 'Een verlaten mijn', 'Vind een oude mijn onder de grond.', 'verkennen'],
  ['krater', 'Een gevallen ster', 'Vind een sterrenkrater.', 'verkennen'],
  ['buit', 'Een schat gevonden', 'Open een oude kist.', 'verkennen'],
  ['dorp', 'Een dorpje', 'Vind een dorpje met bewoners.', 'verkennen'],
  ['karretje', 'Instappen!', 'Rijd in een karretje over het spoor.', 'verkennen'],
  ['griezel', 'Niet bang!', 'Versla een griezel in het donker.', 'verkennen'],
  ['koper', 'Koper gevonden', 'Hak kopererts.', 'mijnbouw'],
  ['ijzer', 'IJzer gesmolten', 'Smelt ijzer in een oven.', 'mijnbouw'],
  ['goud', 'Goud gevonden', 'Hak gouderts.', 'mijnbouw'],
  ['robijn', 'Een echte robijn', 'Vind een robijn, diep onder de grond.', 'mijnbouw'],
  ['ijzerhouweel', 'Een ijzeren houweel', 'Maak een houweel van ijzer.', 'mijnbouw'],
  ['robijnhouweel', 'Een robijnen houweel', 'Maak een houweel van robijn.', 'mijnbouw'],
  ['splinter', 'Een stukje ster', 'Vind een sterrensplinter.', 'mijnbouw'],
  ['sterrenglans', 'Sterrenglans', 'Verbeter gereedschap met een sterrensplinter in de smidse.', 'mijnbouw'],
  ['deur', 'Een eigen deur', 'Zet een deur neer.', 'bouwen'],
  ['bouwer', 'Echte bouwer', 'Zet 500 blokken neer.', 'bouwen'],
  ['kleur', 'Kleur erbij', 'Maak iets in een kleur met verf.', 'bouwen'],
  ['smidse', 'Een eigen smidse', 'Maak een smidse.', 'bouwen'],
  ['herstel', 'Zo goed als nieuw', 'Herstel gereedschap in de smidse.', 'bouwen'],
];
const LB = {}; LOGBOEK.forEach(m => { LB[m[0]] = m; });
const LB_GROEPEN = [['begin', 'Het begin'], ['leven', 'Overleven'], ['verkennen', 'Verkennen'], ['mijnbouw', 'Mijnbouw'], ['bouwen', 'Bouwen en maken']];
// rangen: vanaf hoeveel mijlpalen
const RANGEN = [[0, 'Kleine rommelaar'], [4, 'Echte houthakker'], [10, 'Dappere verkenner'], [17, 'Grote avonturier'], [25, 'Meester van de rommel'], [33, 'Legende van Rommelblok']];
// welke voorwerpen welke mijlpaal geven
const LB_DING = {
  hout: G.TAG['#stam'], werkbank: [B.werkbank], houweel: [I.houweel_hout], steen: [B.kei], oven: [B.oven], fakkel: [B.fakkel],
  brood: [I.brood], hutspot: [I.hutspot], taart: [B.bessentaart, B.kersentaart, B.appeltaart], emmer: [I.emmer_water], kaart: [I.kaart],
  koper: [I.koperbrok], ijzer: [I.ijzerstaaf], goud: [I.goudbrok], robijn: [I.robijn], ijzerhouweel: [I.houweel_ijzer, I.houweel_ijzer_ster], robijnhouweel: [I.houweel_robijn, I.houweel_robijn_ster],
  splinter: [I.sterrensplinter], smidse: [B.smidse], pannenkoek: [I.pannenkoek],
};
const LB_VAN = new Map();
for (const [m, ids] of Object.entries(LB_DING)) for (const id of ids || []) if (id !== undefined) LB_VAN.set(id, m);
// alles wat je met verf maakt (gekleurde blokken)
IT.forEach((it, id) => { if (it && it.kleur !== undefined) LB_VAN.set(id, 'kleur'); });
const rangVan = n => { let r = RANGEN[0]; for (const x of RANGEN) if (n >= x[0]) r = x; return r; };
const aantalMijlpalen = () => (WD && WD.logboek ? Object.keys(WD.logboek).filter(k => LB[k]).length : 0);
// (een wereld waarin commando's gebruikt zijn, telt niet meer: WD.commandos)
function logboek(id, stil) {
  if (!WD || wereldStand() === 'bouwen' || WD.commandos || !LB[id]) return false;
  WD.logboek = WD.logboek || {};
  if (WD.logboek[id]) return false;
  const voor = rangVan(aantalMijlpalen());
  WD.logboek[id] = (WD.dag || 0) + 1;
  if (stil) return true;
  const na = rangVan(aantalMijlpalen());
  if (na !== voor) { melding(t('Nieuwe rang: {0}!', t(na[1])) + ' ' + t('Logboek: {0}', t(LB[id][1]))); klank('nieuw'); }
  else { melding(t('Logboek: {0}', t(LB[id][1])), true); klank('nieuw'); }
  return true;
}
// elke halve seconde: wat je bij je hebt, waar je bent, en of er een nacht voorbij is
let lbKlok = 0, lbKan = -1, lbDag = -1;
function logboekTik(nu) {
  if (nu - lbKlok < 500 || !WD || !wereldKlaar || wereldStand() === 'bouwen' || WD.commandos) return;
  lbKlok = nu;
  // de eerste keer in een wereld (ook een oude): stil bijwerken en één melding
  const eerste = !WD.logboek;
  if (kanTeller !== lbKan) {
    lbKan = kanTeller; let n = 0;
    for (const s of WD.inv) if (s && LB_VAN.has(s.id) && logboek(LB_VAN.get(s.id), eerste)) n++;
    if (eerste) { WD.logboek = WD.logboek || {}; if (n) melding(t('Je logboek is bijgewerkt: {0} mijlpalen. Kijk in het menu.', n)); }
  }
  const s = WD.speler, l = lichtOp(Math.floor(sp.x), Math.floor(sp.y + 1), Math.floor(sp.z));
  if (sp.y < 52 && l >= 0 && (l >> 4) < 3) logboek('grot');
  if (sp.y < 16) logboek('diep');
  if (sp.y > 108) logboek('berg');
  if (s.start && Math.hypot(sp.x - s.start[0], sp.z - s.start[2]) >= 1000) logboek('ver');
  // een nacht doorstaan: de ochtend na een nacht in deze wereld
  const nacht = WD.tijd > 0.8 || WD.tijd < 0.2;
  if (lbDag < 0) lbDag = nacht ? 1 : 0;
  else if (nacht) lbDag = 1;
  else if (lbDag === 1 && WD.tijd > 0.25 && WD.tijd < 0.5) { lbDag = 0; logboek('nacht'); }
}
function telGeplaatst() {
  if (!WD || wereldStand() === 'bouwen') return;
  WD.stats = WD.stats || {}; WD.stats.geplaatst = (WD.stats.geplaatst || 0) + 1;
  if (WD.stats.geplaatst >= 500) logboek('bouwer');
}
// ---------------- het scherm
function openLogboek() {
  if (!WD || wereldStand() === 'bouwen') return;
  WD.logboek = WD.logboek || {};
  const n = aantalMijlpalen(), r = rangVan(n), i = RANGEN.indexOf(r), volgende = RANGEN[i + 1];
  const kop = $('rb-logboek-rang');
  kop.innerHTML = `<p class="rb-rang"><span class="rb-rang-naam"></span><span class="rb-klein"></span></p><div class="rb-voortgang" role="progressbar" aria-valuemin="0" aria-valuemax="${LOGBOEK.length}" aria-valuenow="${n}"><div></div></div><p class="rb-klein rb-rang-volgende"></p>`;
  kop.querySelector('.rb-rang-naam').textContent = t(r[1]);
  kop.querySelector('.rb-rang .rb-klein').textContent = WD.commandos ? t('In deze wereld zijn commando\'s gebruikt: nieuwe mijlpalen tellen niet meer.') : t('{0} van {1} mijlpalen', n, LOGBOEK.length);
  kop.querySelector('.rb-voortgang div').style.width = (n / LOGBOEK.length * 100).toFixed(1) + '%';
  kop.querySelector('.rb-rang-volgende').textContent = volgende ? t('Nog {0} voor de rang {1}.', volgende[0] - n, t(volgende[1])) : t('Je hebt de hoogste rang!');
  const lijst = $('rb-logboek-lijst'); lijst.innerHTML = '';
  for (const [g, gn] of LB_GROEPEN) {
    const h = el('h3', ''); h.textContent = t(gn); lijst.appendChild(h);
    const ul = el('ul', 'rb-mijlpalen');
    for (const m of LOGBOEK) {
      if (m[3] !== g) continue;
      const dag = WD.logboek[m[0]], li = el('li', dag ? 'gehaald' : '');
      li.innerHTML = `<span class="vinkje" aria-hidden="true">${dag ? '✔' : ''}</span><span><b></b><small></small></span>`;
      li.querySelector('b').textContent = t(m[1]);
      li.querySelector('small').textContent = dag ? t('Gehaald op dag {0}', dag) : t(m[2]);
      li.setAttribute('aria-label', t(m[1]) + ': ' + (dag ? t('gehaald') : t('nog niet gehaald')) + '. ' + t(m[2]));
      ul.appendChild(li);
    }
    lijst.appendChild(ul);
  }
  openScherm('logboek');
}
