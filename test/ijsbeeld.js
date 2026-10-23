// ijs naast water, naast glas en van onderen: schermafbeeldingen om de weergave te controleren
const UIT = require('./uit');
const { open, wachtKlaar } = require('./pw');
const wacht = ms => new Promise(ok => setTimeout(ok, ms));
(async () => {
  const { page, fouten, sluit } = await open({ q: 'test=1&zaad=12345&stand=bouwen&straal=3', ctx: { viewport: { width: 900, height: 560 } } });
  await wachtKlaar(page); await wacht(1500);
  const plek = await page.evaluate(() => {
    const R = window.__rommelblok, B = R.G.B, sp = R.sp, X = Math.floor(sp.x) + 4, Z = Math.floor(sp.z) - 6, Y = Math.floor(sp.y) + 6;
    const a = [];
    // een bak met water, half bedekt met ijs; ijs naast glas; een zwevende ijsplaat
    for (let x = -1; x <= 6; x++) for (let z = -1; z <= 6; z++) { a.push(X + x, Y - 1, Z + z, B.steen); for (let y = 0; y < 3; y++) a.push(X + x, Y + y, Z + z, (x < 0 || x > 5 || z < 0 || z > 5) ? B.steen : y < 2 ? R.G.W : (x < 3 ? B.ijs : 0)); }
    for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) { a.push(X + x, Y + 3 + y, Z - 1, x < 2 ? B.ijs : B.glas); a.push(X + x, Y + 3 + y, Z - 2, x % 2 ? B.glas : B.ijs); }
    for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) a.push(X + x + 8, Y + 5, Z + z, B.ijs);
    R.wbWorker.postMessage({ t: 'zet', a });
    return { X, Y, Z };
  });
  await wacht(2500);
  const foto = async (naam, x, y, z, yaw, pitch) => { await page.evaluate(([x, y, z, yaw, pitch]) => { const R = window.__rommelblok; R.sp.vliegt = true; R.zet(x, y, z); R.kijk(yaw, pitch); }, [x, y, z, yaw, pitch]); await wacht(1200); await page.screenshot({ path: UIT + '/ijs_' + naam + '.png' }); };
  const { X, Y, Z } = plek;
  await foto('boven', X + 2.5, Y + 4, Z + 9, 0, -0.55);
  await foto('glas', X + 2, Y + 3, Z + 4, 0, 0.15);
  await foto('onder', X + 10.5, Y + 1, Z + 2.5, 0.3, 1.1);
  await foto('onderwater', X + 4.5, Y + 0.2, Z + 4.5, 0.8, 0.5);
  await foto('schuin', X + 12, Y + 7, Z + 9, 0.6, -0.35);
  console.log(fouten.join('\n') || 'geen fouten');
  await sluit();
})();
