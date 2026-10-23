// Water in vaste opstellingen op een vlakke testvloer
const L = require('./laad'); const G = L.gedeeld(); const RB_WERELD = L.laad('werker.js', 'RB_WERELD');
const { B, W } = G;
let fouten = 0; const ok = (b, t) => { console.log((b ? 'goed ' : 'FOUT ') + t); if (!b) fouten++; };
function vlakkeWereld(vloer = 10) {
  const Wb = RB_WERELD(G, { postMessage: () => {} }); Wb.start(1); Wb.setSpeler(0, 0, 2);
  for (let cz = -3; cz <= 3; cz++) for (let cx = -3; cx <= 3; cx++) {
    const d = new Uint16Array(G.VOL); for (let y = 0; y <= vloer; y++) for (let i = 0; i < 256; i++) d[(y << 8) | i] = y === 0 ? B.bodemsteen : B.steen;
    const s = { k: (cx + 32768) * 65536 + (cz + 32768), cx, cz, d, l: null, b: new Uint8Array(256), kl: new Uint16Array(768), fase: 1, vies: 0, gewijzigd: false, cache: null };
    Wb.stukken.set(s.k, s); Wb.zonVul(s);
  }
  for (const s of Wb.stukken.values()) { Wb.belicht(s); s.fase = 3; }
  return Wb;
}
const lv = v => ((v & 255) === W ? ((v >> 8) & 8 ? 'v' : String((v >> 8) & 7)) : v === 0 ? '.' : '#');
const tik = (Wb, n) => { for (let i = 0; i < n; i++) Wb.waterTik(); };
// 1. een bron op een vlakke vloer stroomt 7 blokken ver
{
  const Wb = vlakkeWereld(); Wb.zet(0, 11, 0, W); tik(Wb, 20);
  const rij = []; for (let x = 0; x <= 9; x++) rij.push(lv(Wb.get(x, 11, 0)));
  ok(rij.join('') === '01234567..', 'bron stroomt uit in niveaus 1 tot 7: ' + rij.join(''));
  ok(lv(Wb.get(3, 11, 2)) === '5', 'schuin: niveau = afstand (3+2=5): ' + lv(Wb.get(3, 11, 2)));
  // 2. bron weg: al het water trekt zich terug
  Wb.zet(0, 11, 0, 0); tik(Wb, 20);
  let over = 0; for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) if ((Wb.get(x, 11, z) & 255) === W) over++;
  ok(over === 0, 'bron weg: water verdwijnt (' + over + ' over)');
}
// 3. twee bronnen met één gat ertussen: het gat wordt een nieuwe bron
{
  const Wb = vlakkeWereld();
  for (let x = -2; x <= 2; x++) for (let z = -1; z <= 1; z++) if (z !== 0 || Math.abs(x) === 2) Wb.zet(x, 11, z, B.steen); // een gootje
  Wb.zet(-1, 11, 0, W); Wb.zet(1, 11, 0, W); tik(Wb, 6);
  ok(Wb.get(0, 11, 0) === W, 'tussen twee bronnen ontstaat een bron: ' + lv(Wb.get(0, 11, 0)));
  Wb.zet(-1, 11, 0, 0); tik(Wb, 6);
  ok(Wb.get(0, 11, 0) === W, 'die nieuwe bron blijft als je er één weghaalt: ' + lv(Wb.get(0, 11, 0)));
}
// 4. een waterval: van een richel naar beneden, en beneden weer uitstromen
{
  const Wb = vlakkeWereld(10);
  for (let x = -6; x <= 0; x++) for (let z = -3; z <= 3; z++) for (let y = 11; y <= 14; y++) Wb.zet(x, y, z, B.steen); // een richel tot hoogte 14
  Wb.zet(0, 15, 0, W); tik(Wb, 30);
  const kolom = []; for (let y = 15; y >= 11; y--) kolom.push(lv(Wb.get(1, y, 0)));
  ok(kolom.join('') === '1vvvv', 'water valt over de rand naar beneden: ' + kolom.join(''));
  const onder = []; for (let x = 1; x <= 9; x++) onder.push(lv(Wb.get(x, 11, 0)));
  ok(onder.join('') === 'v1234567.', 'en stroomt beneden weer uit: ' + onder.join(''));
}
// 5. stroomt naar het dichtstbijzijnde gat
{
  const Wb = vlakkeWereld(10);
  Wb.zet(3, 10, 0, 0); // een gat 3 naar rechts
  Wb.zet(0, 11, 0, W); tik(Wb, 12);
  ok(lv(Wb.get(-1, 11, 0)) === '.' && lv(Wb.get(1, 11, 0)) === '1', 'alleen richting het gat: links ' + lv(Wb.get(-1, 11, 0)) + ', rechts ' + lv(Wb.get(1, 11, 0)));
  ok((Wb.get(3, 10, 0) & 255) === W, 'het gat loopt vol: ' + lv(Wb.get(3, 10, 0)));
}
// 6. planten en fakkels spoelen weg
{
  const Wb = vlakkeWereld(10); Wb.zet(2, 11, 0, B.fakkel); Wb.zet(0, 11, 1, B.hooggras);
  Wb.zet(0, 11, 0, W); tik(Wb, 6);
  ok((Wb.get(2, 11, 0) & 255) === W && (Wb.get(0, 11, 1) & 255) === W, 'fakkel en gras weggespoeld');
}
// 7. veel water tegelijk: een groot bassin dat leegloopt in een lager gebied
{
  const Wb = vlakkeWereld(10);
  for (let x = -20; x <= 20; x++) for (let z = -20; z <= 20; z++) Wb.zet(x, 10, z, 0); // vloer weg: een gebied op hoogte 9
  for (let x = -20; x <= 20; x++) for (let z = -20; z <= 20; z++) for (let y = 9; y >= 5; y--) Wb.zet(x, y, z, 0);
  for (let x = -40; x <= -21; x++) for (let z = -20; z <= 20; z++) for (let y = 11; y <= 14; y++) Wb.zet(x, y, z, W); // 20 x 41 x 4 bronnen, vrij aan de rand
  const t0 = performance.now(); let n = 0, max = 0;
  for (let i = 0; i < 120; i++) { const t1 = performance.now(); Wb.waterTik(); const d = performance.now() - t1; max = Math.max(max, d); n += Wb.waterTeller(); }
  const tijd = performance.now() - t0;
  ok(max < 120, `groot bassin: 120 tikken in ${tijd.toFixed(0)} ms, langste tik ${max.toFixed(0)} ms, ${n} waterstappen`);
  let nat = 0; for (let x = -20; x <= 20; x++) for (let z = -20; z <= 20; z++) if ((Wb.get(x, 5, z) & 255) === W) nat++;
  ok(nat > 200, 'het lage gebied loopt onder water (' + nat + ' vakjes op de bodem)');
}
console.log(fouten ? fouten + ' FOUTEN' : 'alle watertests goed');
process.exit(fouten ? 1 : 0);
