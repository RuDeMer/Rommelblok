// voetstappen per ondergrond: offline opnemen en meten (hoe hard, hoe lang, hoe hoog: de 'helderheid'),
// en vergelijken met het breekgeluid. Metaal mag niet schel zijn, en stappen zijn zachter dan hakken en breken.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const fs = require('fs'), path = require('path');
const bron = require('./bron')('geluid.js');
const MAT = ['steen', 'hout', 'gras', 'aarde', 'zand', 'grind', 'sneeuw', 'glas', 'metaal', 'blad', 'stof', 'water', 'modder'];
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body><script>' + bron + '</script></body></html>');
  const m = await page.evaluate(async MAT => {
    const meet = async f => {
      const sr = 44100, ctx = new OfflineAudioContext(1, sr, sr), g = RB_GELUID({ ctx }); g.volume(1); f(g);
      const d = (await ctx.startRendering()).getChannelData(0);
      let piek = 0, e = 0, eind = 0, dE = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); piek = Math.max(piek, a); e += d[i] * d[i]; if (a > 0.002) eind = i; if (i) dE += (d[i] - d[i - 1]) ** 2; }
      // helderheid: de gemiddelde frequentie, geschat uit de energie van de afgeleide (sqrt(E') / E / 2pi)
      const hz = Math.sqrt(dE / Math.max(e, 1e-12)) * sr / (2 * Math.PI);
      return { piek: +piek.toFixed(3), energie: +e.toFixed(2), ms: Math.round(eind / sr * 1000), hz: Math.round(hz) };
    };
    const uit = {};
    for (const k of MAT) {
      const st = []; for (let i = 0; i < 4; i++) st.push(await meet(g => g.stap(k)));
      // breken klinkt elke keer iets anders (ruis): net als bij de stappen het gemiddelde van vier keer
      const br = []; for (let i = 0; i < 4; i++) br.push(await meet(g => g.breek(k)));
      uit[k] = { stap: st, breek: { piek: +(br.reduce((a, x) => a + x.piek, 0) / br.length).toFixed(3) } };
    }
    return uit;
  }, MAT);
  const mis = [];
  for (const k of MAT) {
    const s = m[k].stap, b = m[k].breek, gem = f => s.reduce((a, x) => a + x[f], 0) / s.length;
    const varianten = new Set(s.map(x => x.piek + ':' + x.hz)).size;
    console.log(k.padEnd(7), 'stap: piek', gem('piek').toFixed(3), 'lengte', Math.round(gem('ms')) + ' ms', 'helderheid', Math.round(gem('hz')) + ' Hz', '| breken: piek', b.piek, '| varianten', varianten);
    if (!(gem('piek') > 0.015)) mis.push(k + ' te zacht');
    if (gem('piek') > 0.6 * b.piek + 0.02) mis.push(k + ' harder dan breken');
    if (gem('ms') > 260) mis.push(k + ' te lang');
    if (varianten < 3) mis.push(k + ' te weinig variatie');
  }
  if (m.metaal.stap.some(x => x.hz > 2200)) mis.push('metaal is schel');
  if (m.metaal.stap.some(x => x.ms > 200)) mis.push('metaal galmt te lang');
  console.log(mis.length ? 'MIS: ' + mis.join(', ') : 'voetstappen: alles goed');
  await browser.close(); process.exit(mis.length ? 1 : 0);
})();
