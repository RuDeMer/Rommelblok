// meet hoe snel de grote kaart tekent bij een flink verkende wereld (22.500 stukken: 150 x 150, zo'n 2,4 bij 2,4 km)
// node test/kaartmeting.js [bestand=rommelblok.html]  (met bestand=vorige.html kun je een vorige versie meten, die moet dan in RB_UIT staan)
const { open, wachtKlaar } = require('./pw');
const bestand = (process.argv.find(a => a.startsWith('bestand=')) || 'bestand=rommelblok.html').slice(8);
const N = +(process.argv.find(a => a.startsWith('n=')) || 'n=150').slice(2);
(async () => {
  const { page, fouten, sluit } = await open({ bestand, q: 'test=1&zaad=12345&stand=bouwen&straal=2', ctx: { viewport: { width: 1280, height: 800 } } });
  await wachtKlaar(page); await page.waitForTimeout(2500);
  const r = await page.evaluate(async N => {
    const R = window.__rommelblok, K = R.KAART, wacht = ms => new Promise(ok => setTimeout(ok, ms));
    const echt = [...K.values()]; if (!echt.length) return { fout: 'geen kaartjes' };
    const cx0 = Math.floor(R.sp.x) >> 4, cz0 = Math.floor(R.sp.z) >> 4, sk = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
    let n = 0; for (let dz = -N / 2; dz < N / 2; dz++) for (let dx = -N / 2; dx < N / 2; dx++) { const k = sk(cx0 + dx, cz0 + dz); if (!K.has(k)) { K.set(k, echt[(n++) % echt.length]); } }
    const tijd = async (f, keer) => { const t = []; for (let i = 0; i < keer; i++) { const t0 = performance.now(); f(); t.push(performance.now() - t0); await new Promise(ok => requestAnimationFrame(ok)); } t.sort((a, b) => a - b); return +t[Math.floor(t.length / 2)].toFixed(1); };
    const klaar = async () => { const t0 = performance.now(); while (R.KM.onaf && performance.now() - t0 < 30000) await new Promise(ok => requestAnimationFrame(ok)); return +(performance.now() - t0).toFixed(0); };
    const herteken = () => dispatchEvent(new Event('resize'));
    const uit = { stukken: K.size };
    const beeldjes = async () => { let n = 0; const t1 = performance.now(); while (performance.now() - t1 < 1500) { await new Promise(ok => requestAnimationFrame(ok)); n++; } return +((performance.now() - t1) / n).toFixed(1); };
    uit.msPerBeeldDicht = await beeldjes();
    const t0 = performance.now(); R.openKaart(); uit.openen = +(performance.now() - t0).toFixed(1); uit.helemaalKlaar = await klaar();
    for (const s of [2, 1, 0.5, 0.25]) {
      R.KM.schaal = s; herteken(); uit['klaar_' + s] = await klaar();
      uit['schuif_' + s] = await tijd(() => { R.KM.x += 37 / s; herteken(); }, 12);
    }
    // één regio tekenen (8 x 8 stukken), per grofheid
    for (const niv of [0, 1, 2]) { const t1 = performance.now(); for (let i = 0; i < 10; i++) R.tekenRegio(niv, (cx0 >> 3) + i - 5, (cz0 >> 3) + 3); uit['regio_' + niv] = +((performance.now() - t1) / 10).toFixed(2); }
    uit.plaatjes = R.REGIO.map(m => m.size); uit.msPerBeeldOpen = await beeldjes();
    return uit;
  }, N);
  console.log(JSON.stringify(r));
  const mis = [];
  if (r.fout) mis.push(r.fout);
  else if (bestand === 'rommelblok.html') {
    for (const s of [2, 1, 0.5, 0.25]) { if (r['schuif_' + s] > 20) mis.push('schuiven traag bij zoom ' + s); if (r['klaar_' + s] > 4000) mis.push('niet op tijd af bij zoom ' + s); }
    if (r.msPerBeeldOpen > 60) mis.push('de wereld wordt nog getekend achter de kaart');
  }
  console.log(mis.length ? 'MIS: ' + mis.join(', ') : 'kaart: snel genoeg');
  process.exitCode = mis.length || fouten.length ? 1 : 0;
  console.log(fouten.join('\n') || 'geen fouten');
  await sluit();
})();
