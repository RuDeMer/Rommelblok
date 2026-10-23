// ============================================================================
// De kaart. De wereldbaas maakt van elk stuk dat je hebt gezien een kaartje (bovenste blok en hoogte per kolom).
// Met een kaart in je hand zie je rechtsboven een kleine kaart; M (of tikken op de kleine kaart) opent de grote kaart
// met je markeringen. Het kompas wijst naar je bed, je startplek of een gekozen markering.
// Ruïnes, mijnen en sterrenkraters die je vindt, komen vanzelf op de kaart (en in je logboek).
// De kaartjes staan in IndexedDB onder 'kaart|<wereld>|<cx>|<cz>', los van de stukken.
// ============================================================================
const KAART = new Map(), kaartVies = new Set(), BOUWW = new Map();
const skTerug = k => [Math.floor(k / 65536) - 32768, (k % 65536) - 32768];
const kaartBereik = wid => IDBKeyRange.bound('kaart|' + wid + '|', 'kaart|' + wid + '|￿');
const MAX_MARKERINGEN = 24;
async function kaartLaden(wid) {
  KAART.clear(); kaartVies.clear(); tegelBeeld.clear(); BOUWW.clear(); ietsVoor = -1;
  await dbKlaar; if (!db) return;
  try {
    const st = db.transaction('stukken').objectStore('stukken'), bereik = kaartBereik(wid);
    const [sleutels, waarden] = await Promise.all([idb(st.getAllKeys(bereik)), idb(st.getAll(bereik))]);
    if (!WD || WD.id !== wid) return;
    for (let i = 0; i < sleutels.length; i++) {
      const [, , cx, cz] = String(sleutels[i]).split('|'), v = waarden[i], k = sk(+cx, +cz);
      // wat al binnen is van de wereldbaas, is nieuwer
      if (v instanceof Uint8Array && v.length === 768 && !KAART.has(k)) KAART.set(k, v);
    }
  } catch (e) {}
}
async function kaartBewaren() {
  if (!db || !WD || !kaartVies.size || /^test/.test(WD.id)) return;
  const wid = WD.id, lijst = [...kaartVies]; kaartVies.clear();
  try {
    const tx = db.transaction('stukken', 'readwrite'), st = tx.objectStore('stukken');
    for (const k of lijst) { const tg = KAART.get(k); if (!tg) continue; const [cx, cz] = skTerug(k); st.put(tg, 'kaart|' + wid + '|' + cx + '|' + cz); }
    await new Promise(ok => { tx.oncomplete = tx.onerror = tx.onabort = ok; });
  } catch (e) {}
}
async function kaartWeg(wid) { await dbKlaar; if (!db) return; try { const tx = db.transaction('stukken', 'readwrite'); tx.objectStore('stukken').delete(kaartBereik(wid)); await new Promise(ok => { tx.oncomplete = tx.onerror = tx.onabort = ok; }); } catch (e) {} }
function kaartBinnen(m) {
  const k = sk(m.cx, m.cz), nieuw = !KAART.has(k); KAART.set(k, m.tegel); kaartVies.add(k);
  REGIO_IETS.add(sk(m.cx >> 3, m.cz >> 3)); if (nieuw && ietsVoor === KAART.size - 1) ietsVoor = KAART.size;
  // de regio van dit stuk opnieuw tekenen, en die eronder als dit de bovenste rij is (de schaduw hangt af van het stuk erboven)
  regioVies(m.cx >> 3, m.cz >> 3); if ((m.cz & 7) === 7) regioVies(m.cx >> 3, (m.cz + 1) >> 3);
  kaartGetekend = 0;
}
function bouwwerkenBinnen(lijst) { for (const s of lijst) { BOUWW.set(s[0] + ',' + s[1] + ',' + s[3], s); if (s[0] === 'dorp' && s[5] && typeof dorpBinnen === 'function') dorpBinnen(s); } }

// ---------------- kleuren: het gemiddelde van de bovenkant van elk blok, met de kleur van gras, blad of water erover
const KKLEUR = [];
function blokKleur(id) {
  if (KKLEUR[id]) return KKLEUR[id];
  const b = BL[id]; let r = 0, g = 0, bl = 0, n = 0;
  if (b && TEX.data) { const D = TEX.data, o = b.tb * 1024; for (let i = 0; i < 256; i++) { if (D[o + i * 4 + 3] < 40) continue; r += D[o + i * 4]; g += D[o + i * 4 + 1]; bl += D[o + i * 4 + 2]; n++; } }
  return (KKLEUR[id] = n ? [r / n, g / n, bl / n] : [140, 140, 140]);
}
// ---------------- de kaart in regio's van 8 x 8 stukken (128 x 128 blokken). Elke regio is één plaatje, in drie
// grofheden (1, 2 of 4 blokken per pixel), en wordt alleen opnieuw getekend als er in die regio iets nieuws is gezien.
// Zo tekent de kaart hooguit een paar honderd plaatjes, ook als je heel veel hebt verkend.
const RS = 8, RBL = RS * 16, REGIO = [new Map(), new Map(), new Map()], REGIO_MAX = [160, 600, 2400];
// welke regio's hebben al een kaartje (zo hoeft een lege regio nooit bekeken te worden)
const REGIO_IETS = new Set(); let ietsVoor = -1;
function regioHeeftIets(rx, rz) {
  if (KAART.size !== ietsVoor) { REGIO_IETS.clear(); for (const k of KAART.keys()) { const [cx, cz] = skTerug(k); REGIO_IETS.add(sk(cx >> 3, cz >> 3)); } ietsVoor = KAART.size; }
  return REGIO_IETS.has(sk(rx, rz));
}
let regioKlok = 0;
const tegelBeeld = { clear() { for (const m of REGIO) m.clear(); REGIO_IETS.clear(); } }; // (naam van vroeger, voor het leegmaken bij een andere wereld)
function regioVies(rx, rz) { const k = sk(rx, rz); for (const m of REGIO) { const e = m.get(k); if (e) e.vies = true; } }
const kleurTmp = [0, 0, 0];
// de kleur van één kolom op de kaart, met een schaduwrandje waar het land omhoog of omlaag gaat
function kolomKleur(tg, i, noord) {
  const id = tg[i], h = tg[256 + i]; if (!id) return null;
  const k = blokKleur(id); let r = k[0], gg = k[1], b = k[2]; const tc = tg[512 + i];
  if (BL[id] && BL[id].tint && tc) { r *= (tc >> 5) / 7 * 1.25; gg *= ((tc >> 2) & 7) / 7 * 1.25; b *= (tc & 3) / 3 * 1.25; }
  let f = 1;
  if (id === G.W) f = Math.max(0.5, 1 - Math.max(0, G.ZEE - h) * 0.03);
  else { const hn = i >= 16 ? tg[256 + i - 16] : noord ? noord[256 + 240 + i] : h; f = h > hn ? 1.14 : h < hn ? 0.82 : 1; }
  kleurTmp[0] = r * f; kleurTmp[1] = gg * f; kleurTmp[2] = b * f; return kleurTmp;
}
function tekenRegio(niv, rx, rz) {
  const s = 1 << niv, n = RBL >> niv, m = REGIO[niv], key = sk(rx, rz);
  let e = m.get(key);
  if (!e) { const c = document.createElement('canvas'); c.width = c.height = n; e = { c, g: c.getContext('2d'), im: null, vies: true, leeg: true }; m.set(key, e); }
  if (!e.im) e.im = e.g.createImageData(n, n);
  const p = e.im.data; p.fill(0); let iets = false;
  const som = niv ? new Float32Array(n * n * 4) : null;
  for (let tz = 0; tz < RS; tz++) for (let tx = 0; tx < RS; tx++) {
    const cx = rx * RS + tx, cz = rz * RS + tz, tg = KAART.get(sk(cx, cz)); if (!tg) continue;
    iets = true; const noord = KAART.get(sk(cx, cz - 1));
    for (let i = 0; i < 256; i++) {
      const c = kolomKleur(tg, i, noord); if (!c) continue;
      const px = ((tx << 4) + (i & 15)) >> niv, pz = ((tz << 4) + (i >> 4)) >> niv, o = (pz * n + px) * 4;
      if (!niv) { p[o] = c[0] > 255 ? 255 : c[0]; p[o + 1] = c[1] > 255 ? 255 : c[1]; p[o + 2] = c[2] > 255 ? 255 : c[2]; p[o + 3] = 255; }
      else { som[o] += c[0]; som[o + 1] += c[1]; som[o + 2] += c[2]; som[o + 3]++; }
    }
  }
  if (niv) for (let o = 0; o < som.length; o += 4) { const q = som[o + 3]; if (!q) continue; p[o] = Math.min(255, som[o] / q); p[o + 1] = Math.min(255, som[o + 1] / q); p[o + 2] = Math.min(255, som[o + 2] / q); p[o + 3] = 255; }
  e.g.putImageData(e.im, 0, 0); e.vies = false; e.leeg = !iets; e.gebruikt = ++regioKlok;
  e.im = null; // het geheugen voor de pixels hoeft niet te blijven: het plaatje zelf is genoeg
  // te veel plaatjes: de langst niet gebruikte weg
  if (m.size > REGIO_MAX[niv]) { let oudste = null, t = Infinity; for (const [k2, e2] of m) if (e2.gebruikt < t && k2 !== key) { t = e2.gebruikt; oudste = k2; } if (oudste !== null) m.delete(oudste); }
  return e;
}
// ---------------- tekeningetjes op de kaart (zelf getekend, zodat ze overal hetzelfde zijn)
function kaartIcoon(g, soort, x, y, s, kleur) {
  g.save(); g.translate(x, y); g.lineWidth = Math.max(1.5, s * 0.14); g.strokeStyle = '#1F2333'; g.lineJoin = 'round';
  const pad = (f, k) => { g.beginPath(); f(); g.fillStyle = k; g.fill(); g.stroke(); };
  if (soort === 'thuis') pad(() => { g.moveTo(-s * 0.5, s * 0.45); g.lineTo(-s * 0.5, -s * 0.05); g.lineTo(0, -s * 0.5); g.lineTo(s * 0.5, -s * 0.05); g.lineTo(s * 0.5, s * 0.45); g.closePath(); }, '#E9B949');
  else if (soort === 'ruine') { pad(() => g.rect(-s * 0.5, s * 0.25, s, s * 0.22), '#C9C3B4'); for (const px of [-0.4, -0.05, 0.3]) pad(() => g.rect(s * px, -s * (px > 0 ? 0.25 : 0.45), s * 0.18, s * (px > 0 ? 0.5 : 0.7)), '#C9C3B4'); }
  else if (soort === 'mijn') { pad(() => { g.moveTo(-s * 0.5, s * 0.45); g.lineTo(-s * 0.5, -s * 0.05); g.arc(0, -s * 0.05, s * 0.5, Math.PI, 0); g.lineTo(s * 0.5, s * 0.45); g.closePath(); }, '#7A4E2D'); pad(() => { g.moveTo(-s * 0.22, s * 0.45); g.lineTo(-s * 0.22, 0); g.arc(0, 0, s * 0.22, Math.PI, 0); g.lineTo(s * 0.22, s * 0.45); g.closePath(); }, '#23252B'); }
  else if (soort === 'krater') { pad(() => g.arc(0, 0, s * 0.48, 0, Math.PI * 2), '#4A4640'); pad(() => { for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? s * 0.13 : s * 0.3; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); }, '#C9A2FF'); }
  else if (soort === 'dorp') { pad(() => { g.moveTo(-s * 0.42, s * 0.45); g.lineTo(-s * 0.42, -s * 0.02); g.lineTo(0, -s * 0.5); g.lineTo(s * 0.42, -s * 0.02); g.lineTo(s * 0.42, s * 0.45); g.closePath(); }, '#FBF6E9'); pad(() => { g.moveTo(-s * 0.56, s * 0.02); g.lineTo(0, -s * 0.56); g.lineTo(s * 0.56, s * 0.02); g.lineTo(s * 0.42, s * 0.1); g.lineTo(0, -s * 0.34); g.lineTo(-s * 0.42, s * 0.1); g.closePath(); }, '#C8323C'); pad(() => g.rect(-s * 0.1, s * 0.12, s * 0.2, s * 0.33), '#7A4E2D'); }
  else if (soort === 'rugzak') { pad(() => g.rect(-s * 0.38, -s * 0.3, s * 0.76, s * 0.75), '#A0683A'); pad(() => g.rect(-s * 0.22, -s * 0.5, s * 0.44, s * 0.22), '#A0683A'); }
  else if (soort === 'speler') { pad(() => { g.moveTo(0, -s * 0.6); g.lineTo(s * 0.42, s * 0.45); g.lineTo(0, s * 0.22); g.lineTo(-s * 0.42, s * 0.45); g.closePath(); }, '#FBF6E9'); }
  else pad(() => { g.arc(0, -s * 0.2, s * 0.34, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(0, s * 0.55); g.closePath(); }, kleur || '#C8323C'); // markering: een speld
  g.restore();
}
const MARK_KLEUR = ['#C8323C', '#2F7FD8', '#3BA55C', '#E9B949', '#9B59D0', '#E8833A'];
const BOUWNAAM = { ruine: 'Ruïne', mijn: 'Oude mijn', krater: 'Sterrenkrater', dorp: 'Dorpje' };
// alles wat je op de kaart ziet staan: thuis, rugzakken, gevonden bouwwerken en markeringen (met wat erbij hoort)
function kaartPunten() {
  const uit = [], s = WD.speler, thuis = s.bed || s.start;
  if (thuis) uit.push({ soort: 'thuis', x: thuis[0], y: thuis[1], z: thuis[2], naam: s.bed ? t('Je bed') : t('Je startplek'), doel: -1 });
  for (const r of WD.rugzakken || []) uit.push({ soort: 'rugzak', x: r.x, y: r.y, z: r.z, naam: t('Je rugzak') });
  for (const b of WD.gevonden || []) uit.push({ soort: b[0], x: b[1], y: b[2], z: b[3], naam: t(BOUWNAAM[b[0]] || 'Bouwwerk') });
  (WD.markers || []).forEach((m, i) => uit.push({ soort: 'markering', x: m.x, y: m.y, z: m.z, naam: m.naam, kleur: MARK_KLEUR[m.kleur % MARK_KLEUR.length], doel: i }));
  return uit;
}
function tekenKaart(g, w, h, mx, mz, schaal, klein) {
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#1B2033'; g.fillRect(0, 0, w, h);
  const x0 = mx - w / 2 / schaal, z0 = mz - h / 2 / schaal, x1 = mx + w / 2 / schaal, z1 = mz + h / 2 / schaal;
  // grofheid: zo dat één pixel van het plaatje ongeveer één pixel op het scherm is (met de schermdichtheid erbij)
  const dpr = Math.min(2, devicePixelRatio || 1), niv = schaal * dpr >= 1.5 ? 0 : schaal * dpr >= 0.75 ? 1 : 2;
  const rx0 = Math.floor(x0 / RBL), rx1 = Math.floor(x1 / RBL), rz0 = Math.floor(z0 / RBL), rz1 = Math.floor(z1 / RBL);
  // eerst wat klaar is; wat nog getekend moet worden, in volgorde van dichtbij het midden, zolang er tijd is
  const t0 = performance.now(), budget = klein ? 2 : 7, rij = [];
  const q = RBL * schaal;
  for (let rz = rz0; rz <= rz1; rz++) for (let rx = rx0; rx <= rx1; rx++) {
    const key = sk(rx, rz); let e = REGIO[niv].get(key);
    if (!e || e.vies) {
      // is er in deze regio iets gezien?
      if (!e && !regioHeeftIets(rx, rz)) continue;
      rij.push([rx, rz, (rx + 0.5) * RBL - mx, (rz + 0.5) * RBL - mz]);
      if (!e) { // intussen een grover of fijner plaatje als dat er al is
        for (const n2 of [niv + 1, niv - 1, niv + 2]) { const e2 = REGIO[n2] && REGIO[n2].get(key); if (e2 && !e2.leeg) { g.drawImage(e2.c, Math.floor((rx * RBL - x0) * schaal), Math.floor((rz * RBL - z0) * schaal), Math.ceil(q) + 1, Math.ceil(q) + 1); break; } }
        continue;
      }
    }
    if (e.leeg) continue;
    e.gebruikt = ++regioKlok;
    g.drawImage(e.c, Math.floor((rx * RBL - x0) * schaal), Math.floor((rz * RBL - z0) * schaal), Math.ceil(q) + 1, Math.ceil(q) + 1);
  }
  rij.sort((a, b) => a[2] * a[2] + a[3] * a[3] - b[2] * b[2] - b[3] * b[3]);
  let gedaan = 0;
  for (const [rx, rz] of rij) {
    if (gedaan && performance.now() - t0 > budget) break;
    const e = tekenRegio(niv, rx, rz); gedaan++;
    if (!e.leeg) g.drawImage(e.c, Math.floor((rx * RBL - x0) * schaal), Math.floor((rz * RBL - z0) * schaal), Math.ceil(q) + 1, Math.ceil(q) + 1);
  }
  laatsteOnaf = rij.length - gedaan;
  const naarScherm = (x, z) => [(x - x0) * schaal, (z - z0) * schaal];
  const is = klein ? 11 : 18, pts = kaartPunten();
  for (const p of pts) {
    let [px, pz] = naarScherm(p.x, p.z);
    if (klein) { if (px < -4 || pz < -4 || px > w + 4 || pz > h + 4) { px = Math.max(6, Math.min(w - 6, px)); pz = Math.max(6, Math.min(h - 6, pz)); if (p.soort !== 'thuis' && p.doel !== WD.kompasDoel) continue; } }
    kaartIcoon(g, p.soort, px, pz, is, p.kleur);
    if (!klein && p.soort === 'markering') { g.font = '700 13px system-ui, sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(31,35,51,.85)'; g.fillStyle = '#FBF6E9'; g.textAlign = 'center'; g.strokeText(p.naam, px, pz - is * 0.75); g.fillText(p.naam, px, pz - is * 0.75); }
    if (!klein && p.doel !== undefined && p.doel === (WD.kompasDoel ?? -1)) { g.strokeStyle = '#E9B949'; g.lineWidth = 2.5; g.beginPath(); g.arc(px, pz, is * 0.85, 0, Math.PI * 2); g.stroke(); }
  }
  // jijzelf, met de kant waar je heen kijkt
  const [sx, sz] = naarScherm(sp.x, sp.z);
  g.save(); g.translate(sx, sz); g.rotate(Math.atan2(-Math.cos(sp.yaw), -Math.sin(sp.yaw)) + Math.PI / 2); kaartIcoon(g, 'speler', 0, 0, is * 1.05); g.restore();
  return naarScherm;
}
// ---------------- heb je een kaart? (in de bouwstand altijd)
const heeftKaart = () => !!WD && (wereldStand() === 'bouwen' || WD.inv.some(s => s && s.id === I.kaart));
// ---------------- de kleine kaart (alleen met een kaart in je hand)
const mini = $('rb-minikaart'), miniG = mini.getContext('2d');
let kaartGetekend = 0;
function miniTik(nu) {
  const s = inHand(), toon = spelBezig && wereldKlaar && !schermOpen() && s && s.id === I.kaart;
  if (mini.hidden !== !toon) mini.hidden = !toon;
  if (!toon || nu - kaartGetekend < 200) return;
  kaartGetekend = nu;
  const css = mini.clientWidth || 128, dpr = Math.min(2, devicePixelRatio || 1), n = Math.round(css * dpr);
  if (mini.width !== n) { mini.width = mini.height = n; }
  miniG.setTransform(dpr, 0, 0, dpr, 0, 0);
  tekenKaart(miniG, css, css, sp.x, sp.z, css / 96, true);
  if (laatsteOnaf) kaartGetekend = 0; // nog niet af: zo snel mogelijk verder
}
mini.addEventListener('click', () => openKaart());

// ---------------- de grote kaart
const KM = { x: 0, z: 0, schaal: 2, wijzers: new Map(), sleep: null, gekozen: null, naarScherm: null };
const kdoek = $('rb-kaart-doek'), kg = kdoek.getContext('2d');
function openKaart() {
  if (!WD || !wereldKlaar) return;
  if (!heeftKaart()) { melding(t('Je hebt een kaart nodig. Maak er een van papier en kolen.'), true); return; }
  KM.x = sp.x; KM.z = sp.z; KM.gekozen = null;
  openScherm('kaart'); kaartInfo(); kaartLegenda();
  requestAnimationFrame(tekenGroot);
}
function tekenGroot() {
  if (huidigScherm() !== 'kaart') return;
  const r = kdoek.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.max(50, Math.round(r.width)), h = Math.max(50, Math.round(r.height));
  if (kdoek.width !== Math.round(w * dpr) || kdoek.height !== Math.round(h * dpr)) { kdoek.width = Math.round(w * dpr); kdoek.height = Math.round(h * dpr); }
  kg.setTransform(dpr, 0, 0, dpr, 0, 0);
  KM.naarScherm = tekenKaart(kg, w, h, KM.x, KM.z, KM.schaal, false);
  KM.w = w; KM.h = h; KM.onaf = laatsteOnaf;
  // nog niet alles getekend (heel veel nieuw verkend): het volgende beeldje verder
  if (KM.onaf) vraagTeken();
}
let laatsteOnaf = 0, tekenGevraagd = false;
function vraagTeken() { if (tekenGevraagd) return; tekenGevraagd = true; requestAnimationFrame(() => { tekenGevraagd = false; tekenGroot(); }); }
function zoom(f, px, pz) {
  const oud = KM.schaal, nieuw = klem(oud * f, 0.25, 8); if (nieuw === oud) return;
  // het punt onder de vinger of muis blijft staan
  if (px !== undefined) { const wx = KM.x + (px - KM.w / 2) / oud, wz = KM.z + (pz - KM.h / 2) / oud; KM.x = wx - (px - KM.w / 2) / nieuw; KM.z = wz - (pz - KM.h / 2) / nieuw; }
  KM.schaal = nieuw; tekenGroot();
}
$('rb-kaart-in').addEventListener('click', () => zoom(1.5));
$('rb-kaart-uit').addEventListener('click', () => zoom(1 / 1.5));
$('rb-kaart-mij').addEventListener('click', () => { KM.x = sp.x; KM.z = sp.z; tekenGroot(); });
$('rb-kaart-hier').addEventListener('click', () => nieuweMarkering(sp.x, sp.y, sp.z));
kdoek.addEventListener('wheel', e => { e.preventDefault(); const r = kdoek.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
kdoek.addEventListener('pointerdown', e => {
  kdoek.setPointerCapture(e.pointerId); KM.wijzers.set(e.pointerId, [e.clientX, e.clientY]);
  KM.sleep = { x: e.clientX, y: e.clientY, kx: KM.x, kz: KM.z, bewogen: false, afstand: 0, schaal: KM.schaal };
  if (KM.wijzers.size === 2) { const [a, b] = [...KM.wijzers.values()]; KM.sleep.afstand = Math.hypot(a[0] - b[0], a[1] - b[1]); KM.sleep.bewogen = true; }
});
kdoek.addEventListener('pointermove', e => {
  if (!KM.wijzers.has(e.pointerId) || !KM.sleep) return;
  KM.wijzers.set(e.pointerId, [e.clientX, e.clientY]);
  const s = KM.sleep;
  if (KM.wijzers.size === 2 && s.afstand) {
    // knijpen om te zoomen
    const [a, b] = [...KM.wijzers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = kdoek.getBoundingClientRect();
    zoom(s.schaal * d / s.afstand / KM.schaal, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); return;
  }
  const dx = e.clientX - s.x, dy = e.clientY - s.y;
  if (Math.hypot(dx, dy) > 5) s.bewogen = true;
  if (s.bewogen) { KM.x = s.kx - dx / KM.schaal; KM.z = s.kz - dy / KM.schaal; vraagTeken(); }
});
const kaartLos = e => {
  if (!KM.wijzers.has(e.pointerId)) return;
  KM.wijzers.delete(e.pointerId);
  const s = KM.sleep; if (KM.wijzers.size) { if (s) { const [a] = [...KM.wijzers.values()]; s.x = a[0]; s.y = a[1]; s.kx = KM.x; s.kz = KM.z; s.afstand = 0; } return; }
  KM.sleep = null;
  if (!s || s.bewogen || e.type === 'pointercancel' || !KM.naarScherm) return;
  // een tik: iets kiezen dat er staat, of een plek voor een nieuwe markering
  const r = kdoek.getBoundingClientRect(), px = e.clientX - r.left, pz = e.clientY - r.top;
  let best = null, bd = 22;
  // bij gelijke afstand wint wat later in de lijst staat: je eigen markeringen
  for (const p of kaartPunten()) { const [qx, qz] = KM.naarScherm(p.x, p.z), d = Math.hypot(qx - px, qz - pz); if (d <= bd) { bd = d; best = p; } }
  KM.gekozen = best || { soort: 'plek', x: KM.x + (px - KM.w / 2) / KM.schaal, z: KM.z + (pz - KM.h / 2) / KM.schaal };
  kaartInfo();
};
kdoek.addEventListener('pointerup', kaartLos); kdoek.addEventListener('pointercancel', kaartLos);
// de regel onder de kaart: wat je hebt gekozen en wat je ermee kunt
function kaartInfo() {
  const vak = $('rb-kaart-info'), p = KM.gekozen; vak.innerHTML = '';
  const knop = (tekst, doe, rood) => { const b = el('button', 'rb-knop klein' + (rood ? ' rood' : '')); b.type = 'button'; b.textContent = tekst; b.onclick = doe; vak.appendChild(b); };
  const regel = tekst => { const s = el('span', 'rb-kaart-tekst'); s.textContent = tekst; vak.appendChild(s); };
  if (!p) { regel(t('Sleep om rond te kijken. Tik op de kaart om een markering te zetten.')); return; }
  const af = Math.round(Math.hypot(p.x - sp.x, p.z - sp.z));
  if (p.soort === 'plek') { regel(t('Hier is niets. {0} m van je af.', af)); knop(t('Zet hier een markering'), () => nieuweMarkering(p.x, null, p.z), true); return; }
  regel(p.naam + ' · ' + t('{0} m', af));
  if (p.doel !== undefined) {
    const nu = (WD.kompasDoel ?? -1) === p.doel;
    knop(nu ? t('Het kompas wijst hierheen') : t('Laat het kompas hierheen wijzen'), () => { WD.kompasDoel = p.doel; kaartInfo(); tekenGroot(); klank('klik'); }, !nu);
  }
  if (p.soort === 'markering') {
    knop(t('Andere naam'), async () => { const n = await vraag(t('Markering'), t('Hoe heet deze plek?'), { invoer: p.naam, ja: t('Bewaar') }); if (n) { WD.markers[p.doel].naam = n.slice(0, 24); p.naam = n.slice(0, 24); } kaartInfo(); tekenGroot(); });
    knop(t('Weghalen'), () => { WD.markers.splice(p.doel, 1); if (WD.kompasDoel === p.doel) WD.kompasDoel = -1; else if (WD.kompasDoel > p.doel) WD.kompasDoel--; KM.gekozen = null; kaartInfo(); tekenGroot(); klank('klik'); });
  }
}
async function nieuweMarkering(x, y, z) {
  WD.markers = WD.markers || [];
  if (WD.markers.length >= MAX_MARKERINGEN) { melding(t('Je hebt al {0} markeringen. Haal er eerst een weg.', MAX_MARKERINGEN), true); return; }
  const n = await vraag(t('Nieuwe markering'), t('Hoe heet deze plek?'), { invoer: t('Plek {0}', WD.markers.length + 1), ja: t('Zet markering') });
  if (!n) { if (huidigScherm() === 'kaart') tekenGroot(); return; }
  // zonder hoogte (getikt op de kaart): de hoogte van het kaartje
  if (y == null) { const tg = KAART.get(sk(Math.floor(x) >> 4, Math.floor(z) >> 4)); y = tg ? tg[256 + ((Math.floor(z) & 15) << 4) + (Math.floor(x) & 15)] + 1 : sp.y; }
  WD.markers.push({ x: Math.round(x * 10) / 10, y: Math.round(y), z: Math.round(z * 10) / 10, naam: n.slice(0, 24), kleur: WD.markers.length % MARK_KLEUR.length });
  WD.kompasDoel = WD.markers.length - 1;
  KM.gekozen = null; klank('nieuw');
  if (huidigScherm() === 'kaart') { kaartInfo(); tekenGroot(); }
  melding(t('Markering gezet. Het kompas wijst er nu heen.'), true);
}
function kaartLegenda() {
  const vak = $('rb-kaart-legenda'); vak.innerHTML = '';
  for (const [s, n] of [['speler', 'Jij'], ['thuis', 'Thuis'], ['markering', 'Markering'], ['ruine', 'Ruïne'], ['mijn', 'Oude mijn'], ['krater', 'Sterrenkrater']]) {
    const sp2 = el('span', 'rb-leg'), c = el('canvas'); c.width = c.height = 36; c.style.width = c.style.height = '18px';
    const g = c.getContext('2d'); g.scale(2, 2); kaartIcoon(g, s, 9, 9, 14); sp2.appendChild(c); sp2.appendChild(document.createTextNode(t(n))); vak.appendChild(sp2);
  }
}
addEventListener('resize', () => { if (huidigScherm() === 'kaart') tekenGroot(); kaartGetekend = 0; });

// ---------------- het kompas wijst naar thuis of naar je gekozen markering
function kompasDoel() {
  const s = WD.speler, m = WD.markers && WD.markers[WD.kompasDoel ?? -1];
  if (m) return { p: [m.x, m.y, m.z], naam: m.naam };
  const p = s.bed || s.start; return p ? { p, naam: s.bed ? t('Je bed') : t('Je startplek') } : null;
}
// ---------------- bouwwerken vinden: dichtbij genoeg en op de goede hoogte
let vindKlok = 0;
function vindTik(nu) {
  if (nu - vindKlok < 500 || !WD || !wereldKlaar || !BOUWW.size) return;
  vindKlok = nu; WD.gevonden = WD.gevonden || [];
  for (const [k, s] of BOUWW) {
    const [soort, x, y, z] = s, dx = sp.x - x, dz = sp.z - z, dy = sp.y - y, af = Math.hypot(dx, dz);
    const raak = soort === 'mijn' ? af < 30 && Math.abs(dy) < 6 : soort === 'krater' ? af < 18 && Math.abs(dy) < 14 : soort === 'dorp' ? af < 26 && Math.abs(dy) < 14 : af < 12 && Math.abs(dy) < 8;
    if (!raak) continue;
    BOUWW.delete(k);
    if (WD.gevonden.some(g => g[0] === soort && g[1] === x && g[3] === z) || WD.gevonden.length >= 300) continue;
    WD.gevonden.push([soort, x, y, z]);
    if (typeof logboek === 'function') logboek(soort);
    melding(soort === 'dorp' ? t('Je hebt een dorpje gevonden! Het staat nu op je kaart. Praat eens met de bewoners.') : soort === 'mijn' ? t('Je hebt een oude mijn gevonden! Hij staat nu op je kaart.') : soort === 'krater' ? t('Een sterrenkrater! Hier is een ster neergestort. Hij staat nu op je kaart.') : t('Je hebt een ruïne gevonden! Hij staat nu op je kaart.'), true);
    klank('nieuw');
  }
}
