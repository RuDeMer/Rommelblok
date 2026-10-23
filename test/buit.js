// oude kisten: openen vult ze (vast per plek) en maakt er een gewone kist van; kapotmaken laat de buit vallen
const { open, wachtKlaar } = require('./pw');
(async () => {
  const { page, fouten, sluit } = await open({ q: 'test=1&zaad=4242&stand=overleven&tijd=0.45&straal=3' });
  await wachtKlaar(page); await page.waitForTimeout(1000);
  const kisten = await page.evaluate(() => {
    const R = window.__rommelblok, G = R.G, W = G.maakWereld(R.WD.zaad), uit = [];
    for (let ring = 0; ring < 6 && uit.length < 2; ring++) for (let gz = -ring; gz <= ring; gz++) for (let gx = -ring; gx <= ring; gx++) {
      if (Math.max(Math.abs(gx), Math.abs(gz)) !== ring) continue;
      const L = W.bouwVak(gx, gz).L;
      for (let i = 0; i < L.length; i += 5) if ((L[i + 3] & 255) === G.B.buitkist && !uit.some(k => ((k[3] >> 10) & 3) === ((L[i + 3] >> 10) & 3))) uit.push([L[i], L[i + 1], L[i + 2], L[i + 3]]);
    }
    return uit;
  });
  console.log('kisten', JSON.stringify(kisten));
  const uit = [];
  for (const [x, y, z, v] of kisten) {
    await page.evaluate(([x, y, z]) => { const R = window.__rommelblok; R.valVrij = 60; R.sp.vliegt = true; R.zet(x + 0.5, y + 20, z + 0.5); }, [x, y, z]);
    await page.waitForFunction(([x, y, z]) => window.__rommelblok.blokOp(x, y, z) > 0, [x, y, z], { timeout: 60000 }).catch(() => {});
    uit.push(await page.evaluate(async ([x, y, z, v]) => {
      const R = window.__rommelblok, G = R.G, wacht = ms => new Promise(ok => setTimeout(ok, ms)), naam = id => G.IT[id].sleutel;
      const echt = R.blokOp(x, y, z), soort = (v >> 10) & 3 ? 'mijn' : 'ruïne', r = { soort, blok: G.BL[echt & 255].sleutel };
      if ((echt & 255) !== G.B.buitkist) { r.fout = 'geen oude kist op die plek'; return r; }
      if (soort === 'ruïne') {
        R.openBlok('kist', { x, y, z, v: echt }); await wacht(200);
        const d = R.WD.dingen[x + ',' + y + ',' + z];
        r.na = G.BL[R.blokOp(x, y, z) & 255].sleutel; r.inhoud = d ? d.inhoud.filter(Boolean).map(s => naam(s.id) + ':' + s.n).join(' ') : null;
        r.scherm = document.getElementById('rb-rugzak-titel').textContent;
        // een tweede keer openen: dezelfde inhoud (niet opnieuw gevuld)
        R.toets && 0; document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true })); await wacht(200);
        const d2 = R.WD.dingen[x + ',' + y + ',' + z]; d2.inhoud[0] = d2.inhoud[0] || null;
        R.openBlok('kist', { x, y, z, v: R.blokOp(x, y, z) }); await wacht(100);
        r.zelfde = JSON.stringify(R.WD.dingen[x + ',' + y + ',' + z].inhoud) === JSON.stringify(d.inhoud);
      } else {
        const voor = R.losse.length;
        R.breek({ x, y, z, v: echt }, false); await wacht(200);
        r.na = G.BL[R.blokOp(x, y, z) & 255].sleutel; r.gevallen = R.losse.slice(voor).map(s => naam(s.id) + ':' + s.n).join(' ');
      }
      return r;
    }, [x, y, z, v]));
  }
  console.log(JSON.stringify(uit, null, 1));
  const mis = [];
  const ru = uit.find(u => u.soort === 'ruïne'), mi = uit.find(u => u.soort === 'mijn');
  if (!ru || ru.na !== 'kist' || !ru.inhoud || ru.scherm !== 'Kist' || !ru.zelfde) mis.push('ruïnekist openen');
  if (!mi || mi.na !== 'lucht' || !mi.gevallen || !mi.gevallen.includes('kist:1') || mi.gevallen.split(' ').length < 2) mis.push('mijnkist kapot');
  console.log(mis.length ? 'MIS: ' + mis.join(', ') : 'oude kisten: alles goed');
  console.log(fouten.join(' ') || 'geen fouten'); await sluit();
  process.exit(mis.length || fouten.length ? 1 : 0);
})();
