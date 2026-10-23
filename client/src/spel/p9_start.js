// ============================================================================
// De hoofdlus en het opstarten
// ============================================================================
let vorige = performance.now(), fpsN = 0, fpsT = 0, fps = 60, frameMs = 16;
const meet = { ms: [], traagSinds: 0, snelSinds: 0 };
function lus(nu) {
  requestAnimationFrame(lus);
  let dt = (nu - vorige) / 1000; vorige = nu;
  // beelden per seconde met de echte klok tellen (de stap voor de natuurkunde wordt wel begrensd)
  fpsN++; fpsT += Math.max(0, dt); if (fpsT >= 0.5) { fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
  if (dt > 0.1) dt = 0.1; if (dt <= 0) dt = 0.001;
  if (!R) return;
  const t0 = performance.now();
  if (spelBezig && WD) {
    sinds += dt;
    if (!wereldKlaar) { const n = R.stukken.size, doel = Math.min(25, (2 * huidigeStraal + 1) ** 2 * 0.3); const b = $('rb-laden-balk'); if (b) b.style.width = Math.min(100, 5 + n / doel * 95).toFixed(0) + '%'; }
    if (!wereldKlaar && grondKlaar() && R.stukken.size >= Math.min(9, (2 * huidigeStraal + 1) ** 2 * 0.2)) {
      wereldKlaar = true;
      // veilig neerzetten: omhoog tot er ruimte is
      for (let i = 0; i < 200 && raakt(sp.x, sp.y, sp.z, 1.8); i++) sp.y += 1;
      if (typeof naGeladen === 'function') naGeladen();
    }
    if (wereldKlaar && spelActief()) { leesToetsen(); if (typeof leesAanraak === 'function') leesAanraak(); beweeg(dt, inv); }
    else if (wereldKlaar) { inv.voor = inv.opzij = 0; inv.spring = inv.sluip = false; beweeg(dt, inv); }
    if (typeof spelTik === 'function') spelTik(dt, nu);
    WD.tijd = (WD.tijd + dt / DAGLENGTE) % 1; if (WD.tijd < dt / DAGLENGTE) WD.dag = (WD.dag || 0) + 1;
    vertelPlek(nu);
    if (Math.random() < 0.02) kopieOpruimen();
  }
  if (!spelBezig) menuTik(dt, nu);
  verwerkMeshes(spelBezig ? 3.5 : 6, sp.x, sp.z);
  const LW = WD || menuWereld;
  const L = lucht(LW ? LW.tijd : 0.42, LW ? LW.dag || 0 : 0, sp.hoofdOnder, huidigeStraal, nu / 1000);
  // onder de grond wordt de verte donker in plaats van luchtblauw
  const zl = (lichtOp(Math.floor(sp.x), Math.floor(sp.y + sp.oog), Math.floor(sp.z)) >> 4) / 15;
  mistDonker += (Math.max(0.04, Math.pow(zl, 1.5)) - mistDonker) * (1 - Math.exp(-dt * 1.5)); L.mistDonker = mistDonker;
  const [bobX, bobY] = hoofdSchommel();
  // de camera: door je ogen, van achteren of van voren (p6d_poppetje.js); in het kiesscherm van je poppetje een eigen plek
  let C = maakCamera(bobX, bobY), LT = L;
  camVorige = C;
  let extra = typeof tekenExtra === 'function' ? tekenExtra(dt, C) : null;
  if (huidigScherm() === 'pop') ({ C, L: LT, extra } = popStudio(dt, C));
  // met de grote kaart open hoeft de wereld erachter niet getekend te worden (scheelt veel op een telefoon).
  // Achter een ander (glazen) scherm tekent een telefoon de wereld maar elk derde beeldje: het glas maakt hem toch wazig.
  const achterGlas = telefoon && schermOpen() && huidigScherm() !== 'pop' && (glasTel++ % 3) !== 0;
  if (!tekenUit && huidigScherm() !== 'kaart' && !achterGlas) R.teken(C, LT, extra); else R.kijkMatrix(C);
  if (spelBezig && wereldKlaar && WD && (!WD.plaatje || plaatjeVragen) && sinds > 2 && !schermOpen()) { maakPlaatje(); plaatjeVragen = false; }
  if (typeof hudTik === 'function') hudTik(dt, L);
  if (samen) samenTik(dt, camVorige);
  frameMs = performance.now() - t0;
  bijsturen(dt);
}
let camVorige = null, dynSchaal = KW.schaal || 1, mistDonker = 1, glasTel = 0;
// automatisch bijsturen als het te traag gaat: eerst de beeldscherpte, dan de kijkafstand
let testVast = false, tekenUit = false;
function bijsturen(dt) {
  // (niet bijsturen als er een scherm open is: dan zegt het aantal beeldjes niets over het spel)
  if (!spelBezig || !wereldKlaar || document.hidden || testVast || schermOpen()) return;
  const doel = telefoon ? 30 : 55;
  if (fps < doel - 4) { meet.traagSinds += dt; meet.snelSinds = 0; } else if (fps > doel + 12) { meet.snelSinds += dt; meet.traagSinds = 0; } else { meet.traagSinds = Math.max(0, meet.traagSinds - dt); }
  if (meet.traagSinds > 3) {
    meet.traagSinds = 0;
    if (dynSchaal > 0.6) dynSchaal = Math.max(0.6, dynSchaal - 0.1);
    else if (!inst.kijk && huidigeStraal > 3) { huidigeStraal--; vertelPlek(performance.now(), true); }
  } else if (meet.snelSinds > 8) {
    meet.snelSinds = 0;
    if (!inst.kijk && huidigeStraal < straalNu()) { huidigeStraal++; vertelPlek(performance.now(), true); }
    else if (dynSchaal < (KW.schaal || 1)) dynSchaal = Math.min(KW.schaal || 1, dynSchaal + 0.1);
  }
}
// ---------------- opstarten
function opstarten() {
  vertaalPagina();
  if (!R) { const f = $('rb-geen-gl'); if (f) f.hidden = false; return; }
  const q = new URLSearchParams(location.search);
  if (q.has('test')) testWereld(q); else beginScherm();
  requestAnimationFrame(lus);
}
// alleen voor tests: meteen een wereld op een plek naar keuze (wordt niet in de lijst bewaard)
function testWereld(q) {
  const w = nieuweWereldGegevens('Test', q.get('zaad') || '12345', q.get('stand') || 'bouwen');
  w.id = 'test'; w.tijd = +(q.get('tijd') || 0.42); w.dag = 2; w.welkom = true;
  const W = G.maakWereld(w.zaad);
  if (q.has('x')) { const x = +q.get('x'), z = +q.get('z'), k = W.kolom(x, z, {}); w.speler.pos = [x + 0.5, q.has('y') ? +q.get('y') : Math.max(G.ZEE, Math.floor(k.h)) + 1.05, z + 0.5]; }
  if (q.has('hoog')) w.speler.pos[1] += 30;
  w.speler.kijk = [+(q.get('yaw') || 0.6), +(q.get('pitch') || -0.25)]; w.speler.vliegt = w.stand === 'bouwen' && q.has('hoog');
  if (q.has('straal')) { inst.kijk = +q.get('straal'); testVast = true; }
  if (q.has('grond')) w.geland = false, w.id = 'test-grond';
  speelWereld(w);
}
// testhaak
window.__rommelblok = {
  G, get WD() { return WD; }, sp, R, blokOp, lichtOp, kopie, inst, get fps() { return fps; }, get frameMs() { return frameMs; },
  get straal() { return huidigeStraal; }, set straal(v) { huidigeStraal = v; vertelPlek(performance.now(), true); }, get schaal() { return dynSchaal; },
  wbWorker: wb, wb: m => vraagWb(m), startWereld: g => startWereld(g), get klaar() { return wereldKlaar; }, speelWereld, nieuweWereldGegevens, naarWerelden, bewaarWereld, alleWerelden, importeer, exporteer, verwijder,
  geef: (id, n) => geef(typeof id === 'string' ? (I[id] !== undefined ? I[id] : B[id]) : id, n || 1), get doel() { return doel; }, richt, breek, gebruik, plaats, kies, hakBegin, hakStop, schade, losse, get hak() { return hak; },
  openRugzak, openBlok, ovenTik, RZ, invoer: inv, toets, beweeg, raakt, lichtKleur, opbrengst, hakTijd, overleefTik, spelTik, flauwvallen, wakkerWorden, landen, uitput, pakOp,
  // simuleer n stapjes van dt seconden met deze invoer (zonder te tekenen), voor tests
  sim: (n, dt, i) => { const o = Object.assign({ voor: 0, opzij: 0, spring: false, sluip: false, rent: false, omhoog: false, omlaag: false }, i || {}); for (let k = 0; k < n; k++) { beweeg(dt, o); spelTik(dt, performance.now()); } return [sp.x, sp.y, sp.z]; },
  kijk: (yaw, pitch) => { sp.yaw = yaw; sp.pitch = pitch; }, set houd(v) { houdGebruik = !!v; },
  zet: (x, y, z) => { sp.x = x; sp.y = y; sp.z = z; sp.vx = sp.vy = sp.vz = 0; camVorige = null; vertelPlek(performance.now(), true); },
  tijd: v => { if (WD) WD.tijd = v; }, set tekenUit(v) { tekenUit = !!v; },
  zetBlok: (x, y, z, v) => { zetBlok(x, y, z, v); stuurZetten(); },
  set handProef(v) { handProef = v; },
  set valVrij(sec) { valVrijTot = performance.now() + sec * 1000; },
  get doelBewoner() { return doelBewoner; }, RUIL, BEROEP, NAMEN, NAMEN_OUD, bewonerNamenOmzetten, dorpBinnen, bewonersTik, bewonersTeken, openRuilen, ruil, zoekRoute, staanOp, bwRust, DORPINFO, bwFase, tel,
  get rijdtIn() { return rijdtIn; }, get doelKar() { return doelKar; }, KAR, karNieuw, karWeg, instappen, uitstappen, karTik, spoorBaan, spoorLeg, karrenUitStuk, karData,
  acties, ACTIES, KAART, BOUWW, tekenRegio, REGIO, openKaart, openLogboek, logboek, kaartLaden, kaartBewaren, kompasDoel, KM, LOGBOEK, aantalMijlpalen,
  // je poppetje en de camera
  POP, get opslag() { return opslag; }, openPop, popZetVeld, verrasPop, popStudio, STUDIO: ST, popModel, popDelen, popHouding, popArm,
  // dieren en griezels
  WZ, get griezels() { return griezels; }, get actief() { return actief; }, get doelWezen() { return doelWezen; }, wezenOpStraal, slaWezen, wezenGebruik, wezensTik, wezensLaden, griezelErbij, wzKolom, stukGeweest, dierData, schoonDier, wzW, WZ_MAX,
  // samen spelen
  get samen() { return samen; }, samenAdres, samenNamen, samenTik, gooiWeg, openSamen, samenGaNaar, samenZeg, openZinnen, openSpelers, samenStop, samenStuur, samenOpScherm, samenSpelerData, spelerGeheim, mijnNaam,
  wisselCamera, camModus, camBeeld, maakCamera, camAchterVoor, get camPlek() { return camPlek; }, get oogVorige() { return oogVorige; }, get camSchouder() { return camSchouder && [sp.x + camSchouder[0], sp.y + sp.oog + camSchouder[1], sp.z + camSchouder[2]]; }, kijkVector, BEREIK, oogPos, get camVorige() { return camVorige; },
};
opstarten();
