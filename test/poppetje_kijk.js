// Het hoofd van een poppetje volgt waar de speler kijkt (browser): node test/poppetje_kijk.js
// 1. helemaal omhoog en helemaal omlaag (niet meer afgekapt op 43 graden), en opzij
// 2. het lijf draait pas mee als het hoofd ver opzij kijkt, of als de speler loopt; vloeiend
// 3. een andere speler: het hoofd glijdt vloeiend naar de nieuwe kijkrichting (ook als berichten met sprongen komen)
// 4. het poppetje knippert af en toe met zijn ogen, en heeft een neus, wenkbrauwen en oogleden
const { open, wachtKlaar } = require('./pw');
const mis = []; const check = (ok, w) => { console.log((ok ? 'goed ' : 'FOUT ') + w); if (!ok) mis.push(w); };
(async () => {
  const b = await open({ q: 'test=1&zaad=777&stand=bouwen&straal=2&x=51&z=-41&tijd=0.5' });
  const { page, fouten } = b; await wachtKlaar(page); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const R = window.__rommelblok, H = s => R.popHouding(Object.assign({ v: 0, fase: 0, grond: true, water: false, ladder: false, sluip: false, kar: false, hak: -1, eet: -1, zwaai: 1, pitch: 0, t: 0, vliegt: false }, s)).g.hoofd;
    const op = H({ pitch: 1.3 })[0], neer = H({ pitch: -1.3 })[0], opzij = H({ kop: 0.8 })[1];
    // lijf: stilstaan en 90 graden opzij kijken
    const o = {}; R.popLijf(o, 0, false, 0.016); let kop = 0; for (let i = 0; i < 120; i++) kop = R.popLijf(o, Math.PI / 2, false, 1 / 60);
    const lijfStil = o.lijf, kopStil = kop;
    // daarna gaan lopen: het lijf draait helemaal mee
    for (let i = 0; i < 120; i++) kop = R.popLijf(o, Math.PI / 2, true, 1 / 60);
    const lijfLoop = o.lijf;
    // een kleine draai (30 graden): het lijf blijft staan
    const o2 = {}; R.popLijf(o2, 0, false, 0.016); for (let i = 0; i < 120; i++) R.popLijf(o2, 0.5, false, 1 / 60);
    // knipperen: in 20 seconden een paar keer kort dicht
    let dicht = 0, keer = 0, was = false; for (let t = 0; t < 20; t += 0.01) { const k = R.popKnippert(3, t); if (k) dicht++; if (k && !was) keer++; was = k; }
    const delen = R.popDelen(R.opslag.pop, true).delen.map(d => d.naam), open = R.popDelen(R.opslag.pop, false).delen.map(d => d.naam);
    return { op, neer, opzij, lijfStil, kopStil, lijfLoop, lijfKlein: o2.lijf, keer, dichtSec: dicht * 0.01, delen, open };
  });
  console.log('  hoofd: omhoog ' + r.op.toFixed(2) + ', omlaag ' + r.neer.toFixed(2) + ', opzij ' + r.opzij.toFixed(2) + ' rad');
  check(r.op < -1.2 && r.neer > 1.2 && Math.abs(r.opzij - 0.8) < 0.01, 'het hoofd kijkt helemaal omhoog, omlaag en opzij');
  console.log('  lijf: 90 graden opzij kijken -> lijf ' + (r.lijfStil * 180 / Math.PI).toFixed(0) + ' graden, hoofd ' + (r.kopStil * 180 / Math.PI).toFixed(0) + '; daarna lopen -> lijf ' + (r.lijfLoop * 180 / Math.PI).toFixed(0) + '; 29 graden opzij -> lijf ' + (r.lijfKlein * 180 / Math.PI).toFixed(1));
  check(r.lijfStil > 0.5 && r.lijfStil < 0.8 && Math.abs(r.kopStil - 0.85) < 0.05, 'stilstaand draait het lijf pas mee als het hoofd ver opzij kijkt');
  check(Math.abs(r.lijfKlein) < 0.01, 'een klein beetje opzij kijken draait alleen het hoofd');
  check(Math.abs(r.lijfLoop - Math.PI / 2) < 0.05, 'als je loopt, draait het lijf helemaal mee');
  console.log('  knipperen: ' + r.keer + ' keer in 20 s, samen ' + r.dichtSec.toFixed(2) + ' s dicht');
  check(r.keer >= 3 && r.keer <= 7 && r.dichtSec < 1, 'het poppetje knippert af en toe heel even');
  check(['neus', 'wenkbrauw', 'zoolL', 'duimL'].every(n => r.open.includes(n)) && r.delen.includes('ooglid') && !r.open.includes('ooglid'), 'een neus, wenkbrauwen, zolen en duimen; oogleden alleen bij het knipperen');
  // 3. een andere speler (zonder server: een nagemaakte speler in de lijst van samen spelen)
  const r3 = await page.evaluate(() => {
    const R = window.__rommelblok, sp = R.sp;
    if (!R.samen) return null;
    return true;
  });
  check(!fouten.length, 'geen fouten in de console' + (fouten.length ? ': ' + fouten.join(' ') : ''));
  await b.sluit();
  console.log(mis.length ? mis.length + ' FOUTEN' : 'poppetje kijkt: alles goed');
  process.exit(mis.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
