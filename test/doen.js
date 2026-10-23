const UIT = require('./uit');
const { open, wachtKlaar } = require('./pw');
(async () => {
  const { page, fouten, sluit } = await open({ q: 'test=1&zaad=777&stand=overleven&tijd=0.45&straal=4&x=60&z=-40' });
  await wachtKlaar(page); await page.waitForTimeout(2500);
  const r = await page.evaluate(async () => {
    const R = window.__rommelblok, uit = {};
    R.kijk(R.sp.yaw, -0.75); await new Promise(ok => setTimeout(ok, 200));
    const d = R.doel; uit.doel = d && { x: d.x, y: d.y, z: d.z, id: d.v & 255, n: d.n };
    if (!d) return uit;
    uit.hakTijdHand = R.hakTijd(d.v, null);
    R.hakBegin(); for (let i = 0; i < 40 && !(R.hak.voortgang > 0); i++) await new Promise(ok => setTimeout(ok, 100)); uit.barst = R.hak.voortgang; R.hakStop();
    R.breek(d, false);
    await new Promise(ok => setTimeout(ok, 400));
    uit.naBreek = R.blokOp(d.x, d.y, d.z);
    uit.wb = (await R.wb({ t: 'lees', a: [d.x, d.y, d.z] })).a[0];
    uit.losse = R.losse.length;
    R.geef('planken_eik', 5); R.kies(0);
    await new Promise(ok => setTimeout(ok, 200));
    const d2 = R.doel; uit.doel2 = d2 && { x: d2.x, y: d2.y, z: d2.z, n: d2.n };
    R.gebruik(); await new Promise(ok => setTimeout(ok, 300));
    if (d2) { uit.geplaatst = R.blokOp(d2.x + d2.n[0], d2.y + d2.n[1], d2.z + d2.n[2]) & 255; uit.wb2 = (await R.wb({ t: 'lees', a: [d2.x + d2.n[0], d2.y + d2.n[1], d2.z + d2.n[2]] })).a[0] & 255; }
    uit.planken = R.G.B.planken_eik; uit.inv0 = R.WD.inv[0];
    return uit;
  });
  console.log(JSON.stringify(r));
  await page.evaluate(() => { const R = window.__rommelblok; R.hakBegin(); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: UIT + '/doen.png' });
  console.log(fouten.join('\n') || 'geen fouten');
  await sluit();
})();
