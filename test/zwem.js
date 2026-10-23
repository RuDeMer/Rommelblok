const { open, wachtKlaar } = require('./pw');
(async () => {
  const { page, fouten, sluit } = await open({ q: 'test=1&zaad=12345&stand=overleven&x=177&z=-74&y=50.5&tijd=0.45&straal=3' });
  await wachtKlaar(page); await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const R = window.__rommelblok, sp = R.sp, s = R.WD.speler, G = R.G, uit = {};
    const wacht = ms => new Promise(ok => setTimeout(ok, ms));
    uit.inWater = sp.inWater; uit.hoofdOnder = sp.hoofdOnder;
    // zinken zonder iets te doen: langzaam
    const y0 = sp.y; R.sim(60, 1 / 60, {}); uit.zakt1s = +(y0 - sp.y).toFixed(2);
    // zwemmen omhoog
    const y1 = sp.y; R.sim(60, 1 / 60, { spring: true }); uit.zwemOp1s = +(sp.y - y1).toFixed(2);
    // verdrinken: onder water blijven tot de adem op is
    R.zet(sp.x, 46.5, sp.z); const hp0 = s.hp; let tAdemOp = 0;
    for (let i = 0; i < 60 * 20; i++) { R.sim(1, 1 / 60, { sluip: true }); if (s.adem <= 0 && !tAdemOp) tAdemOp = i / 60; }
    uit.ademOpNa = +tAdemOp.toFixed(1); uit.schadeNa20s = hp0 - s.hp;
    // emmer: water opscheppen en weer neerzetten
    R.zet(sp.x, 58, sp.z); R.sim(5, 1 / 60, {}); R.kijk(0, -1.5);
    R.WD.inv[0] = { id: G.I.emmer, n: 1 }; R.kies(0); await wacht(300); R.sim(1, 1 / 60, {});
    const d = R.doel; uit.doelWater = d && (d.v & 255) === G.W;
    R.gebruik(); await wacht(200); uit.naScheppen = G.IT[R.WD.inv[0].id].sleutel;
    return uit;
  });
  console.log(JSON.stringify(r)); console.log(fouten.join('\n') || 'geen fouten'); await sluit();
})();
