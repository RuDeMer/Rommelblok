// natuurkunde en overleven, gesimuleerd met vaste stapjes (onafhankelijk van hoe snel er getekend wordt)
const { open, wachtKlaar } = require('./pw');
(async () => {
  const { page, fouten, sluit } = await open({ q: 'test=1&zaad=777&stand=overleven&tijd=0.45&straal=3&x=60&z=-40' });
  await wachtKlaar(page); await page.waitForTimeout(2000);
  const r = await page.evaluate(async () => {
    const R = window.__rommelblok, sp = R.sp, s = R.WD.speler, G = R.G, uit = {};
    const wacht = ms => new Promise(ok => setTimeout(ok, ms));
    // een open plek: gras met 30 blokken lucht erboven, en vlak eromheen
    let plek = null;
    for (let r = 0; r < 30 && !plek; r++) for (let dz = -r; dz <= r && !plek; dz++) for (let dx = -r; dx <= r && !plek; dx++) {
      const X = Math.floor(sp.x) + dx, Z = Math.floor(sp.z) + dz;
      for (let y = 110; y > 40; y--) { const v = R.blokOp(X, y, Z); if (v > 0 && G.VAST[v & 255]) { if ((v & 255) === G.B.gras && y < 80) { let vrij = true; for (let k = -2; k <= 2; k++) for (let j = -2; j <= 2; j++) { if (R.blokOp(X + k, y, Z + j) !== v && (R.blokOp(X + k, y, Z + j) & 255) !== G.B.gras) vrij = false; if (R.blokOp(X + k, y + 1, Z + j) && G.VAST[R.blokOp(X + k, y + 1, Z + j) & 255]) vrij = false; } if (vrij) plek = [X + 0.5, y + 1, Z + 0.5]; } break; } }
    }
    uit.plek = plek;
    R.zet(...plek); R.sim(30, 1 / 60, {});
    const p0 = [sp.x, sp.y, sp.z];
    const afstand = (dir, i) => { R.zet(...plek); R.sim(10, 1 / 60, {}); R.kijk(dir, 0); const a = [sp.x, sp.z]; R.sim(60, 1 / 60, i); return Math.hypot(sp.x - a[0], sp.z - a[1]); };
    uit.lopen1s = +Math.max(...[0, 1.57, 3.14, 4.71].map(d => afstand(d, { voor: 1 }))).toFixed(2);
    uit.rennen1s = +Math.max(...[0, 1.57, 3.14, 4.71].map(d => afstand(d, { voor: 1, rent: true }))).toFixed(2);
    uit.sluipen1s = +Math.max(...[0, 1.57, 3.14, 4.71].map(d => afstand(d, { voor: 1, sluip: true }))).toFixed(2);
    R.zet(...plek); R.sim(10, 1 / 60, {});
    const y0 = sp.y; let maxY = y0; R.sim(1, 1 / 60, { spring: true }); for (let i = 0; i < 40; i++) { R.sim(1, 1 / 60, {}); maxY = Math.max(maxY, sp.y); } uit.sprongHoogte = +(maxY - y0).toFixed(2);
    // vallen van 12 blokken: verwacht 8 schade (12 - 3,2, naar beneden afgerond)
    R.geef('planken_eik', 10); R.geef('stok', 3);
    // vlak na het laden: geen valschade (een nieuwe grot onder je plek)
    R.valVrij = 5; R.zet(plek[0], plek[1] + 12, plek[2]); R.sim(1, 1 / 60, {}); let hp0 = s.hp; for (let i = 0; i < 300 && !sp.opGrond; i++) R.sim(1, 1 / 60, {});
    uit.valNaLaden = hp0 - s.hp;
    R.valVrij = 0; R.zet(plek[0], plek[1] + 12, plek[2]); R.sim(1, 1 / 60, {}); hp0 = s.hp; for (let i = 0; i < 300 && !sp.opGrond; i++) R.sim(1, 1 / 60, {});
    uit.valSchade12 = hp0 - s.hp;
    // van 40 blokken: flauwvallen, rugzak blijft achter
    R.zet(plek[0], plek[1] + 40, plek[2]); R.sim(1, 1 / 60, {}); for (let i = 0; i < 400 && !sp.opGrond; i++) R.sim(1, 1 / 60, {});
    uit.naGroteVal = { hp: s.hp, rugzakken: R.WD.rugzakken.length, invLeeg: R.WD.inv.every(v => !v), scherm: [...document.querySelectorAll('.rb-scherm:not([hidden])')].map(e => e.id) };
    document.getElementById('rb-wakker').click(); await wacht(100);
    uit.wakker = { hp: s.hp, honger: s.honger, aanStart: Math.hypot(sp.x - s.start[0], sp.z - s.start[2]) < 1 };
    for (let i = 0; i < 100 && !R.klaar; i++) await wacht(100);
    const d = R.losse.find(d => d.rugzak); R.zet(d.x, d.y + 0.3, d.z);
    for (let i = 0; i < 100 && !R.klaar; i++) await wacht(100);
    // de rugzak wacht 3 seconden voordat je hem kunt oppakken
    R.sim(420, 1 / 60, {});
    uit.terug = { rugzakken: R.WD.rugzakken.length, inv: R.WD.inv.filter(Boolean).map(v => G.IT[v.id].sleutel + ':' + v.n) };
    // verdrinken: 15 seconden adem, daarna schade
    let water = null;
    for (let r = 0; r < 60 && !water; r++) for (let dz = -r; dz <= r && !water; dz++) for (let dx = -r; dx <= r && !water; dx++) { const X = Math.floor(sp.x) + dx, Z = Math.floor(sp.z) + dz; for (let y = 56; y > 45; y--) if ((R.blokOp(X, y, Z) & 255) === G.W && (R.blokOp(X, y - 2, Z) & 255) === G.W) { water = [X + 0.5, y - 2, Z + 0.5]; break; } }
    uit.water = water;
    return uit;
  });
  console.log(JSON.stringify(r)); console.log(fouten.join('\n') || 'geen fouten'); await sluit();
  const mis = [];
  if (!(r.lopen1s > 3.8 && r.lopen1s < 4.4)) mis.push('lopen'); if (r.valNaLaden !== 0) mis.push('valschade vlak na laden'); if (r.valSchade12 !== 8) mis.push('valschade 12');
  if (r.naGroteVal.rugzakken !== 1 || !r.naGroteVal.invLeeg) mis.push('achtergelaten rugzak'); if (r.terug.rugzakken !== 0) mis.push('rugzak terug');
  if (mis.length || fouten.length) { console.log('MIS: ' + mis.join(', ')); process.exit(1); }
})();
