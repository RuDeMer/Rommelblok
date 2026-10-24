// ============================================================================
// Commando's: de tijd, het weer, de stand, naar een plek of speler gaan, en een voorwerp geven.
// - Alleen spelen: alleen als je bij het maken van de wereld 'Commando's toestaan' koos (WD.commandosMag).
// - Samen spelen: alleen de eigenaar; de server kijkt dat na en voert het commando zelf uit.
// Na het eerste commando telt de wereld niet meer voor het logboek (WD.commandos), zodat overleven zijn uitdaging houdt.
// Openen: de toets / (of Commando's in het pauzemenu). Nederlands en Engels door elkaar mag (/tijd of /time).
// ============================================================================
const CMD_TIJD = { ochtend: 0.27, morgen: 0.27, dag: 0.5, middag: 0.5, avond: 0.74, nacht: 0.85, middernacht: 0, morning: 0.27, day: 0.5, noon: 0.5, evening: 0.74, night: 0.85, midnight: 0 };
const CMD_SOORT = { tijd: 'tijd', time: 'tijd', weer: 'weer', weather: 'weer', stand: 'stand', mode: 'stand', gamemode: 'stand', ga: 'ga', tp: 'ga', goto: 'ga', geef: 'geef', give: 'geef', hulp: 'hulp', help: 'hulp' };
const CMD_VOORBEELD = ['/tijd dag', '/tijd nacht', '/tijd 18', '/weer regen', '/weer helder', '/stand bouwen', '/stand overleven', '/ga thuis', '/ga 0 80 0', '/geef fakkel 16'];
const CMD_VOORBEELD_EN = ['/time day', '/time night', '/time 18', '/weather rain', '/weather clear', '/mode build', '/mode survival', '/goto home', '/goto 0 80 0', '/give torch 16'];
function cmdMag() { if (!WD || !spelBezig) return false; if (WD.samen) return !!(samen && samen.eigenaar); return !!WD.commandosMag; }
// een voorwerp bij naam (sleutel, Nederlandse of Engelse naam; hoofdletters en spaties maken niet uit)
function cmdVoorwerp(tekst) {
  const plat = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '');
  const z = plat(tekst); if (!z) return -1;
  for (let id = 0; id < IT.length; id++) { const it = IT[id]; if (it && (plat(it.sleutel) === z || plat(it.nl) === z || plat(it.en) === z)) return id; }
  for (let id = 0; id < IT.length; id++) { const it = IT[id]; if (it && (plat(it.nl).startsWith(z) || plat(it.en).startsWith(z))) return id; }
  return -1;
}
// een andere speler bij naam (bij samen spelen)
function cmdSpeler(tekst) {
  if (!samen) return null; const z = tekst.toLowerCase().replace(/\s+/g, '');
  for (const o of samen.spelers.values()) if (smNaam(o.naam).toLowerCase().replace(/\s+/g, '') === z) return o;
  for (const o of samen.spelers.values()) if (smNaam(o.naam).toLowerCase().replace(/\s+/g, '').startsWith(z)) return o;
  return null;
}
// staat het woord in een rijtje (Nederlandse en Engelse woorden door elkaar)
const cmdIs = (w, rij) => !!w && rij.split(' ').includes(w);
// de tekst van een commando lezen: { wat, ... } of { fout }
function cmdLees(tekst) {
  const delen = String(tekst || '').trim().replace(/^\//, '').split(/\s+/).filter(Boolean);
  if (!delen.length) return { fout: t('Typ een commando, bijvoorbeeld /tijd dag.') };
  const wat = CMD_SOORT[delen[0].toLowerCase()]; if (!wat) return { fout: t('Onbekend commando. Kies tijd, weer, stand, ga of geef.') };
  const a = delen.slice(1), w0 = (a[0] || '').toLowerCase();
  if (wat === 'hulp') return { wat };
  if (wat === 'tijd') {
    if (CMD_TIJD[w0] !== undefined) return { wat, tijd: CMD_TIJD[w0] };
    const uur = Number(w0.replace(',', '.').replace(/u(ur)?$/, '')); if (w0 && isFinite(uur) && uur >= 0 && uur <= 24) return { wat, tijd: (uur % 24) / 24 };
    return { fout: t('Kies een tijd: ochtend, dag, avond, nacht, of een uur van 0 tot 24.') };
  }
  if (wat === 'weer') {
    if (cmdIs(w0, 'regen rain sneeuw snow nat')) return { wat, regen: true };
    if (cmdIs(w0, 'helder clear droog zon sun mooi')) return { wat, regen: false };
    return { fout: t('Kies helder of regen.') };
  }
  if (wat === 'stand') {
    if (cmdIs(w0, 'bouwen build creative b')) return { wat, stand: 'bouwen' };
    if (cmdIs(w0, 'overleven survival o s')) return { wat, stand: 'overleven' };
    return { fout: t('Kies bouwen of overleven.') };
  }
  if (wat === 'ga') {
    if (cmdIs(w0, 'thuis home bed')) { const p = WD.speler.bed || WD.speler.start; return p ? { wat, x: p[0], y: p[1], z: p[2] } : { fout: t('Je hebt nog geen thuis.') }; }
    if (cmdIs(w0, 'start spawn begin')) { const p = WD.speler.start; return p ? { wat, x: p[0], y: p[1], z: p[2] } : { fout: t('Onbekende plek.') }; }
    if (a.length >= 3) {
      const c = [sp.x, sp.y, sp.z], p = a.slice(0, 3).map((s, i) => s.startsWith('~') ? c[i] + (Number(s.slice(1)) || 0) : Number(s));
      if (p.every(v => isFinite(v)) && Math.abs(p[0]) < 3e7 && Math.abs(p[2]) < 3e7 && p[1] >= 1 && p[1] < 400) return { wat, x: Math.floor(p[0]) + 0.5, y: p[1], z: Math.floor(p[2]) + 0.5 };
      return { fout: t('Een plek is drie getallen: x, y (hoogte) en z.') };
    }
    if (WD.samen && a.length) { const o = cmdSpeler(a.join(' ')); return o ? { wat, wie: o.sid } : { fout: t('Die speler ken ik niet.') }; }
    return { fout: WD.samen ? t('Waarheen? /ga thuis, /ga start, /ga x y z of /ga en een naam.') : t('Waarheen? /ga thuis, /ga start of /ga x y z.') };
  }
  if (wat === 'geef') {
    // /geef <voorwerp> [aantal] [speler]: het aantal is het eerste getal; wat ervoor staat is het voorwerp
    const i = a.findIndex(s => /^\d+$/.test(s)), naamDeel = i >= 0 ? a.slice(0, i) : a, n = i >= 0 ? Number(a[i]) : 1, rest = i >= 0 ? a.slice(i + 1) : [];
    const id = cmdVoorwerp(naamDeel.join(' ')); if (id < 0) return { fout: t('Dat voorwerp ken ik niet.') };
    const max = stapelVan(id); if (!(n >= 1 && n <= max)) return { fout: t('Hooguit {0} tegelijk.', max) };
    const uit = { wat, id, n };
    if (rest.length) { if (!WD.samen) return { fout: t('Geven aan een ander kan alleen bij samen spelen.') }; const o = cmdSpeler(rest.join(' ')); if (!o) return { fout: t('Die speler ken ik niet.') }; uit.wie = o.sid; }
    return uit;
  }
  return { fout: t('Onbekend commando.') };
}
// na een /ga: wachten tot de stukken daar er zijn, en dan omhoog tot er ruimte is (de hoofdlus doet dat bij wereldKlaar)
function cmdLanden() { wereldKlaar = false; valVrijTot = performance.now() + 8000; sp.vliegt = sp.vliegt && wereldStand() === 'bouwen'; }
function zetStand(stand) {
  if (!WD) return;
  WD.stand = stand;
  if (stand !== 'bouwen') sp.vliegt = false;
  lichaamKlassen(); rugzakVeranderd();
  melding(stand === 'bouwen' ? t('Stand: bouwen. Alles is onbeperkt.') : t('Stand: overleven.'), true);
}
// een commando uitvoeren: bij samen spelen doet de server het, anders hier
function cmdDoe(tekst) {
  if (!cmdMag()) { cmdInfo(WD && WD.samen ? t('Alleen de eigenaar mag commando\'s geven.') : t('In deze wereld staan commando\'s uit. Dat kies je bij het maken van een wereld.'), true); return false; }
  const c = cmdLees(tekst); if (c.fout) { cmdInfo(c.fout, true); return false; }
  if (c.wat === 'hulp') { cmdInfo(t('Commando\'s: /tijd, /weer, /stand, /ga en /geef. Tik op een voorbeeld.')); return false; }
  if (WD.samen) { samenStuur(Object.assign({ t: 'cmd' }, c)); cmdKlaar(c); return true; }
  if (c.wat === 'tijd') WD.tijd = c.tijd;
  else if (c.wat === 'weer') zetWeer(c.regen);
  else if (c.wat === 'stand') zetStand(c.stand);
  else if (c.wat === 'ga') { sp.x = c.x; sp.y = c.y; sp.z = c.z; sp.vx = sp.vy = sp.vz = 0; sp.valStart = null; vertelPlek(performance.now(), true); cmdLanden(); }
  else if (c.wat === 'geef') { geefOfLaatVallen(c.id, c.n); rugzakVeranderd(); }
  cmdKlaar(c);
  return true;
}
function cmdKlaar(c) {
  const wat = { tijd: t('De tijd is veranderd.'), weer: c.regen ? t('Het gaat regenen.') : t('Het wordt droog.'), stand: '', ga: t('Daar ben je.'), geef: t('Je kreeg {0} × {1}.', c.n, naam(c.id)) }[c.wat];
  if (wat) melding(wat, true);
  if (!WD.commandos) { WD.commandos = true; melding(t('Er is een commando gebruikt: deze wereld telt niet meer voor het logboek.')); }
}
function cmdInfo(tekst, fout) { const e = $('rb-cmd-info'); if (e) { e.textContent = tekst; e.classList.toggle('fout', !!fout); } if (huidigScherm() !== 'cmd' && tekst) melding(tekst, true); }
function openCmd(begin) {
  if (!cmdMag()) { cmdInfo(WD && WD.samen ? t('Alleen de eigenaar mag commando\'s geven.') : t('In deze wereld staan commando\'s uit. Dat kies je bij het maken van een wereld.'), true); return; }
  const h = $('rb-cmd-hulp'); h.innerHTML = '';
  for (const v of TAAL === 'en' ? CMD_VOORBEELD_EN : CMD_VOORBEELD) { const b = document.createElement('button'); b.type = 'button'; b.className = 'rb-knop klein'; b.textContent = v; b.onclick = () => { $('rb-cmd-tekst').value = v + ' '; $('rb-cmd-tekst').focus(); }; h.appendChild(b); }
  $('rb-cmd-tekst').value = begin || '/';
  openScherm('cmd');
  cmdInfo(WD.commandos ? '' : t('Let op: na een commando telt deze wereld niet meer voor het logboek.'));
  setTimeout(() => { const i = $('rb-cmd-tekst'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 30);
}
$('rb-cmd-vorm').addEventListener('submit', e => { e.preventDefault(); if (cmdDoe($('rb-cmd-tekst').value)) sluitScherm(); });
// Tab vult het commando aan
$('rb-cmd-tekst').addEventListener('keydown', e => {
  if (e.key !== 'Tab') return; e.preventDefault();
  const v = e.target.value.replace(/^\//, ''); if (/\s/.test(v)) return;
  const k = Object.keys(CMD_SOORT).find(n => n.startsWith(v.toLowerCase())); if (k) e.target.value = '/' + k + ' ';
});
addEventListener('keydown', e => {
  if (!spelBezig || !WD || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) return;
  if ((e.key === '/' || e.code === 'Slash' || e.code === 'NumpadDivide') && huidigScherm() === null && cmdMag()) { e.preventDefault(); openCmd('/'); }
});
