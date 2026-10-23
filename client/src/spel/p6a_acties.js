// ============================================================================
// Acties: elke verandering aan de wereld gaat door één punt, zodat samen spelen later kan (zie multiplayer-plan.md).
// Wat de speler doet is één actie ({ t: 'breek' | 'plaats' | 'gebruik' | 'kist' | 'los', ... }) met een lijst 'gevolg':
//   ['b', x, y, z, v]           een blok verandert (alles via zetBlok)
//   ['k', x, y, z, vak, inhoud] een vak van een kist of oven verandert (vak: 0-26 bij een kist, 'in' | 'brand' | 'uit' bij een oven)
//   ['w', x, y, z]              de inhoud van een kist of oven is weg (het blok is kapot)
//   ['v', x, y, z, v]           een oude kist vult zich met buit (vast per wereld en plek, dus iedereen rekent hetzelfde uit)
//   ['l', x, y, z, id, n, dur]  er valt iets op de grond
//   ['e', 'kar', id, gegevens]  een karretje komt erbij of verandert (gegevens null: het is weg)
//   ['e', 'bewoner', id, gegevens]  een bewoner komt erbij of verandert (bijvoorbeeld na een ruil)
// Nu speel je alleen en voert deze pagina alles zelf uit. Een netwerkdeel kan met acties.luister(f) meeluisteren
// en acties van anderen met acties.ontvang(a) uitvoeren (dan worden ze niet opnieuw gemeld).
// Water, groeien en de oven doen de wereldbaas en de oven zelf: dat is geen actie van een speler.
// ============================================================================
const ACTIES = { nr: 0, log: [], luisteraars: [], huidig: null, vanBuiten: false, MAX: 400 };
function actie(soort, gegevens, doe) {
  // binnen een andere actie (een fakkel die meevalt met het blok eronder, een kist die je opent): hoort bij die actie
  if (ACTIES.huidig || ACTIES.vanBuiten) return doe();
  const a = Object.assign({ t: soort, nr: ++ACTIES.nr, tijd: Date.now() }, gegevens, { gevolg: [] });
  ACTIES.huidig = a; let uit;
  try { uit = doe(); } finally { ACTIES.huidig = null; }
  if (a.gevolg.length) meldActie(a);
  return uit;
}
function meldActie(a) {
  ACTIES.log.push(a); if (ACTIES.log.length > ACTIES.MAX) ACTIES.log.splice(0, ACTIES.log.length - ACTIES.MAX);
  for (const f of ACTIES.luisteraars) { try { f(a); } catch (e) { console.warn(e); } }
}
// elke verandering hoort bij de actie die bezig is; zonder actie wordt het een losse actie
function actieGevolg(g) {
  if (ACTIES.vanBuiten) return;
  if (ACTIES.huidig) ACTIES.huidig.gevolg.push(g);
  else meldActie({ t: 'los', nr: ++ACTIES.nr, tijd: Date.now(), gevolg: [g] });
}
const kopieVak = s => (s ? Object.assign({ id: s.id, n: s.n }, s.dur != null ? { dur: s.dur } : {}) : null);
function voerGevolgUit(g) {
  switch (g[0]) {
    case 'b': zetBlok(g[1], g[2], g[3], g[4]); break;
    case 'k': { const kist = typeof g[4] === 'number', d = ding(g[1], g[2], g[3], kist ? 'kist' : 'oven'); if (kist) d.inhoud[g[4]] = kopieVak(g[5]); else d[g[4]] = kopieVak(g[5]); break; }
    case 'w': delete WD.dingen[sleutelPlek(g[1], g[2], g[3])]; break;
    case 'v': buitVullen(g[1], g[2], g[3], g[4]); break;
    case 'l': laatVallen(g[1], g[2], g[3], g[4], g[5], g[6] || undefined); break;
    case 'e': if (g[1] === 'kar') karOntvang(g[2], g[3]); else if (g[1] === 'bewoner') bewonerOntvang(g[2], g[3]); break;
  }
}
const acties = {
  luister(f) { ACTIES.luisteraars.push(f); return () => { const i = ACTIES.luisteraars.indexOf(f); if (i >= 0) ACTIES.luisteraars.splice(i, 1); }; },
  // een actie van iemand anders (of van de server): alleen de gevolgen uitvoeren, zonder ze opnieuw te melden
  ontvang(a) {
    if (!a || !Array.isArray(a.gevolg)) return;
    ACTIES.vanBuiten = true;
    try { for (const g of a.gevolg) voerGevolgUit(g); stuurZetten(); } finally { ACTIES.vanBuiten = false; }
    if (huidigScherm() === 'rugzak') rugzakVeranderd();
  },
  get log() { return ACTIES.log; },
};
// ---------------- kisten en ovens: na elke verandering de vakken vergelijken met hoe ze waren
let bak = null; // { x, y, z, soort, vakken: { vak: tekst } }
const bakVakken = d => (d.soort === 'kist' ? d.inhoud.map((s, i) => [i, s]) : [['in', d.in], ['brand', d.brand], ['uit', d.uit]]);
function bakBegin(soort, p) {
  bak = null; if (!p || (soort !== 'kist' && soort !== 'oven')) return;
  const d = ding(p[0], p[1], p[2], soort), vakken = {};
  for (const [k, s] of bakVakken(d)) vakken[k] = JSON.stringify(kopieVak(s));
  bak = { x: p[0], y: p[1], z: p[2], soort, vakken };
}
function bakVergelijk() {
  if (!bak || ACTIES.vanBuiten) return;
  const d = WD.dingen[sleutelPlek(bak.x, bak.y, bak.z)]; if (!d || d.soort !== bak.soort) { bak = null; return; }
  const nieuw = [];
  for (const [k, s] of bakVakken(d)) { const tk = JSON.stringify(kopieVak(s)); if (tk !== bak.vakken[k]) { bak.vakken[k] = tk; nieuw.push(['k', bak.x, bak.y, bak.z, k, kopieVak(s)]); } }
  if (nieuw.length) actie(bak.soort, { x: bak.x, y: bak.y, z: bak.z }, () => { for (const g of nieuw) actieGevolg(g); });
}
