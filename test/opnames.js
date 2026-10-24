// De opnames (client/geluiden/rommelblok-geluiden.bin, CC0): node test/opnames.js
// 1. Het bestand: klein genoeg, en elke opname staat in BRONNEN.md met een bron en de licentie CC0.
// 2. In Chromium (offline renderen): alles is te ontsleutelen, de stilte die de MP3-coder ervoor zet is eraf (het geluid
//    begint meteen), niets vervormt, en elk geluid is ongeveer even hard als het zelfgemaakte geluid dat het vervangt.
// 3. Dieren en spookjes: elk geluid klinkt (met en zonder opnames), geraakt klinkt anders dan gewoon.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const fs = require('fs'), path = require('path');
const bron = require('./bron')('geluid.js');
const BIN = path.join(__dirname, '..', 'client', 'geluiden', 'rommelblok-geluiden.bin');
const mis = []; const check = (ok, w) => { console.log((ok ? 'goed ' : 'FOUT ') + w); if (!ok) mis.push(w); };
(async () => {
  // ---------- 1. het bestand en de bronnen
  const b = fs.readFileSync(BIN), n = b.readUInt32LE(4), kop = JSON.parse(b.slice(8, 8 + n).toString());
  const stukjes = Object.values(kop.klanken).reduce((s, l) => s + l.length, 0);
  check(b.slice(0, 4).toString() === 'RBG1' && b.length <= 220 * 1024, 'het bestand begint met RBG1 en is klein (' + (b.length / 1024).toFixed(0) + ' kB, ' + Object.keys(kop.klanken).length + ' soorten, ' + stukjes + ' stukjes)');
  const md = fs.readFileSync(path.join(path.dirname(BIN), 'BRONNEN.md'), 'utf8'), rijen = md.split('\n').filter(r => /^\| [a-z_]+ \|/.test(r));
  check(rijen.length === stukjes && rijen.every(r => /\| CC0 1\.0 \|$/.test(r) && /(kenney\.nl|bigsoundbank\.com)/.test(r)), 'BRONNEN.md noemt elk stukje, met de bron en de licentie CC0 1.0 (' + rijen.length + ' regels)');
  check(Object.keys(kop.klanken).every(k => rijen.some(r => r.startsWith('| ' + k + ' |'))), 'en elke soort geluid staat erin');

  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const fouten = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') fouten.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => fouten.push('pageerror: ' + e.message));
  await page.setContent('<!doctype html><html><body><script>' + bron + '</script></body></html>');
  await page.evaluate(b64 => { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); window.__bin = a.buffer; }, b.toString('base64'));

  // ---------- 2. ontsleutelen, begin, vervorming en hoe hard
  const uit = await page.evaluate(async () => {
    const sr = 44100;
    // een geluid offline renderen, met of zonder opnames: piek, rms (over het klinkende deel) en wanneer het begint
    async function meet(f, metOpnames) {
      const ctx = new OfflineAudioContext(2, sr * 3, sr), g = RB_GELUID({ ctx }); g.volume(1);
      if (metOpnames) { g.laadOpnamen(window.__bin.slice(0)); for (let i = 0; i < 400 && !g.opnamenKlaar; i++) await new Promise(r => setTimeout(r, 10)); if (!g.opnamenKlaar) return null; }
      f(g);
      const buf = await ctx.startRendering(), d = buf.getChannelData(0), e = buf.getChannelData(1);
      let piek = 0, som = 0, n = 0, begin = -1, eind = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.max(Math.abs(d[i]), Math.abs(e[i])); if (a > piek) piek = a; }
      // begin en einde: waar het geluid boven 5% van zijn piek komt (de stilte van een MP3-coder blijft daar ver onder)
      for (let i = 0; i < d.length; i++) { const a = Math.max(Math.abs(d[i]), Math.abs(e[i])); if (a > piek * 0.05) { if (begin < 0) begin = i; eind = i; } }
      for (let i = Math.max(0, begin); i <= eind; i++) { som += d[i] * d[i]; n++; }
      return { piek: +piek.toFixed(3), rms: +Math.sqrt(som / Math.max(1, n)).toFixed(4), begin: +(begin / sr * 1000).toFixed(1), lengte: +((eind - begin) / sr).toFixed(2) };
    }
    // alles ontsleuteld?
    const ctx = new OfflineAudioContext(1, sr, sr), g = RB_GELUID({ ctx }); g.laadOpnamen(window.__bin.slice(0));
    for (let i = 0; i < 400 && !g.opnamenKlaar; i++) await new Promise(r => setTimeout(r, 10));
    const namen = g.opnameNamen, begin = g.opnameBegin;
    const PROEF = {
      'stap steen': g => g.stap('steen'), 'stap hout': g => g.stap('hout'), 'stap gras': g => g.stap('gras'), 'stap aarde': g => g.stap('aarde'), 'stap zand': g => g.stap('zand'),
      'stap sneeuw': g => g.stap('sneeuw'), 'stap stof': g => g.stap('stof'), 'stap grind': g => g.stap('grind'),
      'hak steen': g => g.hak('steen'), 'hak hout': g => g.hak('hout'), 'hak aarde': g => g.hak('aarde'), 'hak glas': g => g.hak('glas'), 'hak metaal': g => g.hak('metaal'),
      'breek steen': g => g.breek('steen'), 'breek hout': g => g.breek('hout'), 'breek glas': g => g.breek('glas'), 'breek metaal': g => g.breek('metaal'), 'breek gras': g => g.breek('gras'), 'breek stof': g => g.breek('stof'),
      'plaats steen': g => g.plaats('steen'), 'plaats hout': g => g.plaats('hout'), 'plaats aarde': g => g.plaats('aarde'), 'plaats glas': g => g.plaats('glas'),
      'deur open': g => g.deur(true), 'deur dicht': g => g.deur(false), 'kist open': g => g.kist(true), 'kist dicht': g => g.kist(false), 'oven': g => g.oven(), 'au': g => g.au(), 'land hard': g => g.land(1),
      'sla': g => g.wezen('sla'), 'koe': g => g.wezen('koe'), 'schaap': g => g.wezen('schaap'), 'kip': g => g.wezen('kip'),
    };
    const res = {};
    // (elk geluid kiest een willekeurige opname: drie keer meten en het gemiddelde nemen)
    const gem = async (f, met) => { const l = [await meet(f, met), await meet(f, met), await meet(f, met)]; return { piek: Math.max(...l.map(m => m.piek)), rms: +(l.reduce((s, m) => s + m.rms, 0) / 3).toFixed(4), begin: Math.max(...l.map(m => m.begin)), lengte: +(l.reduce((s, m) => s + m.lengte, 0) / 3).toFixed(2) }; };
    for (const [naam, f] of Object.entries(PROEF)) res[naam] = { met: await gem(f, true), zonder: await gem(f, false) };
    // dieren en spookjes (met opnames), gewoon en geraakt
    const DIER = ['koe', 'schaap', 'kip', 'eend', 'hert', 'zeehond', 'konijn', 'hagedis', 'spook', 'kwal', 'braam'], dier = {};
    for (const d of DIER) dier[d] = { gewoon: await meet(g => g.wezen(d), true), au: await meet(g => g.wezen(d, true), true), zelf: await meet(g => g.wezen(d), false) };
    const spook = {};
    for (const s of ['spook_ziet', 'spook_dreig', 'spook_duik', 'spook_gemist']) spook[s] = { vol: await meet(g => g.wezen(s, 1), true), zacht: await meet(g => g.wezen(s, 0.3), true) };
    const rugzak = await meet(g => g.rugzak(), true);
    return { namen, begin, res, dier, spook, rugzak };
  });
  check(uit.namen.length === Object.keys(kop.klanken).length, 'alle ' + Object.keys(kop.klanken).length + ' soorten opnames zijn ontsleuteld (' + uit.namen.length + ')');
  console.log('  geluid           met opname (piek, rms, begin ms, lengte)      zelfgemaakt (piek, rms)   verhouding rms');
  let teZacht = [], teHard = [], laat = [], vervormd = [];
  for (const [n, { met, zonder }] of Object.entries(uit.res)) {
    const v = met.rms / Math.max(1e-6, zonder.rms);
    console.log('  ' + n.padEnd(16) + ' ' + [met.piek, met.rms, met.begin, met.lengte].join(', ').padEnd(44) + ' ' + [zonder.piek, zonder.rms].join(', ').padEnd(24) + ' ' + v.toFixed(2));
    // een tik, slag of stap begint meteen (deuren, kisten, de oven, stof en dieren zwellen aan, die tellen hier niet)
    if (!/deur|kist|oven|stof|koe|schaap|kip/.test(n) && met.begin > 30) laat.push(n + ' (' + met.begin + ' ms)');
    if (met.piek >= 0.98) vervormd.push(n);
    // dieren en slaan: het zelfgemaakte geluid was heel zacht, dus daar een vaste maat (rms 0,012 tot 0,06)
    if (['koe', 'schaap', 'kip', 'sla'].includes(n)) { if (met.rms < 0.012) teZacht.push(n + ' rms ' + met.rms); if (met.rms > 0.06) teHard.push(n + ' rms ' + met.rms); continue; }
    if (v < 0.4) teZacht.push(n + ' ' + v.toFixed(2)); if (v > 4) teHard.push(n + ' ' + v.toFixed(2));
  }
  check(uit.begin !== null && uit.begin <= 4, 'de stilte die de MP3-coder ervoor zet, is eraf: elk stukje begint binnen ' + (uit.begin || 0).toFixed(1) + ' ms (zonder knippen zo’n 50)');
  check(!laat.length, 'tikken, slagen en stappen klinken meteen (binnen 30 ms na het moment zelf)' + (laat.length ? ': ' + laat.join(', ') : ''));
  check(!vervormd.length, 'niets vervormt (piek onder 0,98)' + (vervormd.length ? ': ' + vervormd.join(', ') : ''));
  check(!teZacht.length && !teHard.length, 'elke opname is ongeveer even hard als het zelfgemaakte geluid (0,4 tot 4 keer; dieren en slaan rms 0,012 tot 0,06)' + (teZacht.length ? '; te zacht: ' + teZacht.join(', ') : '') + (teHard.length ? '; te hard: ' + teHard.join(', ') : ''));
  const stil = Object.entries(uit.dier).filter(([, m]) => !(m.gewoon.piek > 0.01 && m.au.piek > 0.01 && m.zelf.piek > 0.01)).map(([d]) => d);
  check(!stil.length, 'elk dier klinkt, gewoon en geraakt, met en zonder opnames' + (stil.length ? ': stil: ' + stil.join(', ') : ''));
  const anders = Object.entries(uit.dier).filter(([, m]) => Math.abs(m.gewoon.lengte - m.au.lengte) > 0.03 || Math.abs(m.gewoon.rms - m.au.rms) / m.gewoon.rms > 0.08).map(([d]) => d);
  check(anders.length >= 8, 'geraakt klinkt anders dan gewoon (korter, hoger of harder) bij ' + anders.length + ' van ' + Object.keys(uit.dier).length + ' dieren');
  console.log('  dieren: ' + Object.entries(uit.dier).map(([d, m]) => d + ' ' + m.gewoon.lengte + 's/' + m.au.lengte + 's').join(', '));
  const sp = Object.entries(uit.spook);
  check(sp.every(([, m]) => m.vol.piek > 0.01 && m.zacht.piek < m.vol.piek * 0.5 && m.vol.piek < 0.98), 'de spookjes: zien, dreigen, duiken en mis hebben ze elk een eigen geluid, zachter van verder weg (' + sp.map(([s, m]) => s.slice(6) + ' ' + m.vol.lengte + 's').join(', ') + ')');
  check(uit.spook.spook_dreig.vol.lengte >= 0.7 && uit.spook.spook_dreig.vol.rms > uit.spook.spook_gemist.vol.rms * 0.8, 'dreigen duurt lang genoeg om op tijd weg te springen (' + uit.spook.spook_dreig.vol.lengte + ' s), en is goed te horen');
  check(uit.rugzak.piek > 0.01, 'de rugzak open: wat leer en stof');
  check(!fouten.length, 'geen fouten in de console' + (fouten.length ? ': ' + fouten.join('; ') : ''));
  await browser.close();

  // ---------- 4. de echte pagina: haalt het bestand op als de wereld speelt, en gebruikt de opnames
  const { open, wachtKlaar } = require('./pw');
  const p2 = await open({ q: 'test=1&zaad=777&stand=overleven&straal=2&x=51&z=-41&tijd=0.5', ctx: { viewport: { width: 640, height: 400 } } });
  const verzoeken = []; p2.page.on('request', r => { if (/geluiden/.test(r.url())) verzoeken.push(r.url()); });
  await wachtKlaar(p2.page);
  await p2.page.mouse.click(320, 200); // een klik zet het geluid aan
  const klaar = await p2.page.waitForFunction(() => window.__rommelblok.geluid && window.__rommelblok.geluid.opnamenKlaar, null, { timeout: 30000, polling: 200 }).then(() => true, () => false);
  const pg = await p2.page.evaluate(() => { const g = window.__rommelblok.geluid; g.breek('steen'); g.wezen('koe'); g.deur(true); return { namen: g.opnameNamen.length, klinkt: g.klinkend }; });
  check(klaar && verzoeken.length === 1 && pg.namen === Object.keys(kop.klanken).length, 'de pagina haalt rommelblok-geluiden.bin één keer op nadat de wereld begon, en ontsleutelt alles (' + pg.namen + ' soorten)');
  check(pg.klinkt >= 3, 'en speelt opnames af (breken, een koe, een deur: ' + pg.klinkt + ' klanken tegelijk)');
  check(!p2.fouten.length, 'geen fouten op de pagina' + (p2.fouten.length ? ': ' + p2.fouten.join('; ') : ''));
  await p2.sluit();
  // zonder het bestand (oude site, of geen verbinding): geen fouten, alles klinkt zelfgemaakt
  const p3 = await open({ q: 'test=1&zaad=777&stand=overleven&straal=2&x=51&z=-41&tijd=0.5', ctx: { viewport: { width: 640, height: 400 } } });
  await p3.page.route(/rommelblok-geluiden\.bin/, r => r.fulfill({ status: 404, body: '' }));
  await wachtKlaar(p3.page); await p3.page.mouse.click(320, 200); await p3.page.waitForTimeout(4000);
  const zonder = await p3.page.evaluate(() => { const g = window.__rommelblok.geluid; g.breek('steen'); g.wezen('koe'); return { klaar: g.opnamenKlaar, klinkt: g.klinkend }; });
  check(!zonder.klaar && zonder.klinkt >= 2 && !p3.fouten.length, 'zonder het bestand: geen fouten, en alles klinkt zelfgemaakt' + (p3.fouten.length ? ': ' + p3.fouten.join('; ') : ''));
  await p3.sluit();
  console.log(mis.length ? mis.length + ' FOUT' : 'opnames: alles goed');
  process.exit(mis.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
