// ============================================================================
// Het weer: af en toe regen, en in koude streken (sneeuwvlakte, besneeuwde bergen, bevroren zee) sneeuw.
// Alleen voor de sfeer: een grijzere lucht, meer wolken, regen of sneeuw rond je, en het geluid van regen.
// Bij alleen spelen houdt de wereld zelf het weer bij (WD.weer: regent het, en wanneer wisselt het, in speltijd);
// bij samen spelen zegt de server wanneer het regent. Het commando /weer zet het meteen om.
// ============================================================================
const WEER = { mix: 0, kaart: new Uint8Array(32 * 32 * 2), x0: 0, z0: 0, versie: 0, kolom: 0, sneeuwHier: false, binnen: false };
const KOUD = new Set([G.BI.sneeuwvlakte, G.BI.sneeuwbergen, G.BI.bevroren_oceaan].filter(v => v !== undefined));
const weerKlok = () => (WD ? (WD.dag || 0) + (WD.tijd || 0) : 0);
// regen aan of uit; bij alleen spelen ook wanneer het weer omslaat (regen duurt 0,1 tot 0,25 dag, droog 0,3 tot 0,7 dag)
function zetWeer(regen) {
  if (!WD) return;
  if (!WD.weer || typeof WD.weer !== 'object') WD.weer = {};
  WD.weer.regen = !!regen;
  if (!WD.samen) WD.weer.wissel = weerKlok() + (regen ? 0.1 + Math.random() * 0.15 : 0.3 + Math.random() * 0.4);
}
// een kolom: hoe hoog is het eerste dak of de grond (blokken, bladeren of water), en sneeuwt het daar?
function weerKolom(x, z) {
  for (let y = HOOG - 1; y > 0; y--) {
    const v = blokOp(x, y, z); if (v < 0) return 255;
    if (!v) continue;
    const id = v & 255; if (G.VAST[id] || id === G.W || BL[id].sleutel.startsWith('blad_')) return y;
  }
  return 0;
}
function weerTik(dt) {
  if (!WD) return;
  if (!WD.weer || typeof WD.weer !== 'object') WD.weer = { regen: false };
  if (!WD.samen) {
    if (!(WD.weer.wissel > 0)) WD.weer.wissel = weerKlok() + 0.3 + Math.random() * 0.4;
    if (weerKlok() >= WD.weer.wissel) zetWeer(!WD.weer.regen);
  }
  WEER.mix += ((WD.weer.regen ? 1 : 0) - WEER.mix) * (1 - Math.exp(-dt * 0.4));
  if (WEER.mix < 0.002 && !WD.weer.regen) return;
  // de kaart van daken rond je: elk beeldje een deel opnieuw (in acht beeldjes helemaal), en opnieuw rond je als je verder liep
  const cx = Math.floor(sp.x) - 16, cz = Math.floor(sp.z) - 16;
  if (Math.abs(cx - WEER.x0) > 3 || Math.abs(cz - WEER.z0) > 3) {
    // schuiven: wat al bekend is, blijft (geen geflits), de rest komt de komende beeldjes
    const oud = WEER.kaart.slice(), dx = cx - WEER.x0, dz = cz - WEER.z0;
    for (let gz = 0; gz < 32; gz++) for (let gx = 0; gx < 32; gx++) { const ox = gx + dx, oz = gz + dz, i = (gz * 32 + gx) * 2; if (ox >= 0 && oz >= 0 && ox < 32 && oz < 32) { WEER.kaart[i] = oud[(oz * 32 + ox) * 2]; WEER.kaart[i + 1] = oud[(oz * 32 + ox) * 2 + 1]; } else { WEER.kaart[i] = 255; WEER.kaart[i + 1] = 0; } }
    WEER.x0 = cx; WEER.z0 = cz;
  }
  for (let n = 0; n < 128; n++) {
    const k = WEER.kolom; WEER.kolom = (k + 1) & 1023;
    const gx = k & 31, gz = k >> 5, x = WEER.x0 + gx, z = WEER.z0 + gz;
    WEER.kaart[k * 2] = weerKolom(x, z); WEER.kaart[k * 2 + 1] = KOUD.has(biomeOp(x, z)) ? 255 : 0;
  }
  WEER.versie++;
  const hier = WEER.kaart[(16 * 32 + 16) * 2];
  WEER.sneeuwHier = WEER.kaart[(16 * 32 + 16) * 2 + 1] > 0;
  WEER.binnen = hier !== 255 && hier > sp.y + 1.7;
}
// wat de tekenaar nodig heeft (of null als het droog is)
function weerTeken() {
  if (WEER.mix < 0.01) return null;
  return { sterkte: WEER.mix * (minderBeweging ? 0.6 : 1), kaart: WEER.kaart, x0: WEER.x0, z0: WEER.z0, versie: WEER.versie, per: telefoon ? 2 : 4 };
}
// de lucht bij regen: grijzer en donkerder, meer wolken, geen sterren, en minder ver zicht
function weerLucht(L) {
  const m = WEER.mix; if (m < 0.002 || L.onderWater) return L;
  const grijs = (k, donker) => { const g = (k[0] + k[1] + k[2]) / 3; return k.map(v => (v + (g - v) * 0.7 * m) * (1 - donker * m)); };
  L.zenit = grijs(L.zenit, 0.45); L.horizon = grijs(L.horizon, 0.35); L.zonKleur = L.zonKleur.map(v => v * (1 - 0.32 * m));
  L.zonGloed = L.zonGloed.map(v => v * (1 - 0.85 * m)); L.wolkDek += (0.97 - L.wolkDek) * m;
  L.wolkKleur = grijs(L.wolkKleur, 0.4); L.wolkSchaduw = grijs(L.wolkSchaduw, 0.35); L.sterren *= 1 - m;
  L.mist = [L.mist[0] * (1 - 0.4 * m), L.mist[1] * (1 - 0.2 * m)];
  return L;
}
