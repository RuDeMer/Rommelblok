// test van geluid.js in Chromium: live (alle functies, sfeer) en offline (signaal niet stil, geen vervorming, zinnige lengte)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const fs = require('fs'), path = require('path');
const bron = require('./bron')('geluid.js');
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const fouten = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') fouten.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => fouten.push('pageerror: ' + e.message));
  await page.setContent('<!doctype html><html><body><script>' + bron + '</script></body></html>');
  // 1. live
  const live = await page.evaluate(async () => {
    const g = RB_GELUID(); g.ontgrendel(); g.volume(0.6); g.muziek(true);
    const wacht = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 30 && g.context.state !== 'running'; i++) await wacht(50);
    const MAT = ['gras', 'aarde', 'steen', 'zand', 'grind', 'hout', 'blad', 'sneeuw', 'glas', 'metaal', 'stof', 'water', 'modder', 'onbekend'];
    let maxStem = 0;
    for (const m of MAT) { g.stap(m); g.hak(m); g.breek(m); g.plaats(m); maxStem = Math.max(maxStem, g.klinkend); await wacht(60); }
    for (const f of ['spring', 'land', 'plons', 'zwem', 'au', 'eet', 'slik', 'oppak', 'klik', 'deur', 'kist', 'oven', 'stuk', 'nieuw', 'vult', 'giet', 'ontdek', 'dood', 'slaap']) { g[f](); g[f](true); maxStem = Math.max(maxStem, g.klinkend); await wacht(40); }
    // veel tegelijk: het maximum moet gelden
    for (let i = 0; i < 80; i++) g.breek('glas'); maxStem = Math.max(maxStem, g.klinkend);
    const toestanden = [{ buiten: 1, hoogte: 100, nacht: 0 }, { buiten: 1, hoogte: 70, nacht: 1 }, { buiten: 0, hoogte: 20, grot: 1 }, { buiten: 0.5, onderWater: true, waterBij: 1 }, { buiten: 1, waterBij: 1 }, { pauze: true }];
    for (const o of toestanden) for (let i = 0; i < 25; i++) { g.omgeving(o); await wacht(40); }
    g.aan(false); g.breek('steen'); const uitStil = g.klinkend; g.aan(true);
    await wacht(3000);
    return { staat: g.context.state, maxStem, naAfloop: g.klinkend, uitStil };
  });
  // 2. offline: elk geluid apart renderen en meten
  const metingen = await page.evaluate(async () => {
    const proef = {
      'stap gras': g => g.stap('gras'), 'stap steen': g => g.stap('steen'), 'stap zand': g => g.stap('zand'), 'hak hout': g => g.hak('hout'),
      'breek glas': g => g.breek('glas'), 'breek steen': g => g.breek('steen'), 'breek grind': g => g.breek('grind'), 'plaats aarde': g => g.plaats('aarde'),
      'metaal': g => g.breek('metaal'), 'modder': g => g.stap('modder'), 'land hard': g => g.land(1), 'plons groot': g => g.plons(true), 'au': g => g.au(),
      'eet': g => g.eet(), 'oppak': g => g.oppak(), 'klik': g => g.klik(), 'deur open': g => g.deur(true), 'kist dicht': g => g.kist(false), 'oven': g => g.oven(),
      'stuk': g => g.stuk(), 'nieuw': g => g.nieuw(), 'vult': g => g.vult(), 'giet': g => g.giet(), 'ontdek': g => g.ontdek(), 'dood': g => g.dood(), 'slaap': g => g.slaap(),
      'tien tegelijk': g => { for (let i = 0; i < 10; i++) { g.breek('steen'); g.land(1); } },
    };
    const uit = {};
    for (const [naam, f] of Object.entries(proef)) {
      const sr = 44100, ctx = new OfflineAudioContext(2, sr * 4, sr);
      const g = RB_GELUID({ ctx }); g.volume(1); f(g);
      const buf = await ctx.startRendering();
      let piek = 0, som = 0, eind = 0;
      for (let k = 0; k < 2; k++) { const d = buf.getChannelData(k); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > piek) piek = a; som += d[i] * d[i]; if (a > 0.001 && i > eind) eind = i; } }
      uit[naam] = { piek: +piek.toFixed(3), rms: +Math.sqrt(som / (buf.length * 2)).toFixed(4), lengte: +(eind / sr).toFixed(2) };
    }
    return uit;
  });
  console.log('live:', JSON.stringify(live));
  let fout = 0;
  for (const [n, m] of Object.entries(metingen)) {
    const ok = m.piek > 0.005 && m.piek < 1.0 && m.lengte > 0.02 && m.lengte < 3.9;
    if (!ok) fout++;
    console.log((ok ? 'ok   ' : 'FOUT ') + n.padEnd(14), JSON.stringify(m));
  }
  if (live.maxStem > 24) { fout++; console.log('FOUT: meer dan 24 tegelijk:', live.maxStem); }
  if (live.uitStil !== 0 && live.uitStil > live.naAfloop) { fout++; console.log('FOUT: geluid uit maar toch klank'); }
  console.log(fouten.length ? fouten.join('\n') : 'console: geen fouten');
  console.log(fout || fouten.length ? 'NIET GOED' : 'alles goed');
  await browser.close();
  process.exit(fout || fouten.length ? 1 : 0);
})();
