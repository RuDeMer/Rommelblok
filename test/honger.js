// Honger bij rennen en springen (browser): node test/honger.js [oude-pagina.html]
// Een minuut rennend rondjes springen op een vlakke vloer, en een minuut wandelen. Vergeleken met de vorige versie
// (test/referentie of het bestand dat je meegeeft) kost rennen en springen nu veel minder honger, en wandelen niets.
const { open, wachtKlaar } = require('./pw');
const fs = require('fs'), path = require('path');
const mis = []; const check = (ok, w) => { console.log((ok ? 'goed ' : 'FOUT ') + w); if (!ok) mis.push(w); };
async function meet(bestand) {
  const b = await open({ bestand, q: 'test=1&zaad=777&stand=overleven&straal=2&x=51&z=-41&tijd=0.5' });
  await wachtKlaar(b.page); await b.page.waitForTimeout(1500);
  const r = await b.page.evaluate(() => {
    const R = window.__rommelblok, B = R.G.B, sp = R.sp, X = Math.floor(sp.x), Y = Math.floor(sp.y) + 30, Z = Math.floor(sp.z);
    for (let x = -14; x <= 14; x++) for (let z = -14; z <= 14; z++) { R.zetBlok(X + x, Y, Z + z, B.steen); for (let y = 1; y <= 4; y++) R.zetBlok(X + x, Y + y, Z + z, 0); }
    const s = R.WD.speler, uit = {};
    for (const [naam, inv, draai] of [['rennen en springen', { voor: 1, rent: true, spring: true }, 0.9], ['wandelen', { voor: 1 }, 0.65]]) {
      R.zet(X + 0.5, Y + 1.02, Z - 6.5); sp.yaw = 0; sp.rent = false; sp.renMix = 0; s.honger = 20; s.verzadiging = 0; s.uitputting = 0; s.hp = 20;
      const I = Object.assign({ voor: 0, opzij: 0, spring: false, sluip: false, rent: false, omhoog: false, omlaag: false }, inv), dt = 1 / 60;
      let weg = 0, px = sp.x, pz = sp.z, sprong = 0, vy = 0;
      for (let i = 0; i < 60 / dt; i++) { sp.yaw += draai * dt; R.beweeg(dt, I); R.overleefTik(dt); weg += Math.hypot(sp.x - px, sp.z - pz); px = sp.x; pz = sp.z; if (sp.vy > 8 && vy <= 8) sprong++; vy = sp.vy; }
      uit[naam] = { honger: +(20 - s.honger + (s.uitputting || 0) / 4).toFixed(2), meter: Math.round(weg), sprongen: sprong };
    }
    return uit;
  });
  await b.sluit(); return r;
}
(async () => {
  const uitMap = require('./uit'), oud = process.argv[2] || path.join(__dirname, 'referentie', 'rommelblok-ronde3.html');
  fs.copyFileSync(oud, path.join(uitMap, 'honger-oud.html'));
  const was = await meet('honger-oud.html'), nu = await meet('rommelblok.html');
  for (const k of Object.keys(nu)) console.log(k.padEnd(19) + ' vroeger ' + was[k].honger + ' hongerpunten (' + was[k].meter + ' m, ' + was[k].sprongen + ' sprongen), nu ' + nu[k].honger + ' (' + nu[k].meter + ' m, ' + nu[k].sprongen + ' sprongen)');
  const rj = nu['rennen en springen'], rjo = was['rennen en springen'];
  check(rj.honger > 0.5 && rj.honger <= rjo.honger * 0.4, 'een minuut rennen en springen kost nog maar ' + rj.honger + ' van de 20 hongerpunten (was ' + rjo.honger + ')');
  check(nu.wandelen.honger === 0 && nu.wandelen.meter > 200, 'wandelen kost geen honger');
  console.log(mis.length ? mis.length + ' FOUTEN' : 'honger: alles goed');
  process.exit(mis.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
