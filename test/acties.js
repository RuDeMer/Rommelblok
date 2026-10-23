// acties: alles wat je in de wereld verandert wordt een actie met gevolgen; dezelfde wereld + dezelfde acties = hetzelfde resultaat
const { open, wachtKlaar } = require('./pw');
const Q = 'test=1&zaad=777&stand=overleven&tijd=0.45&straal=3';
(async () => {
  let { page, fouten, sluit } = await open({ q: Q });
  await wachtKlaar(page); await page.waitForTimeout(1500);
  const A = await page.evaluate(async () => {
    const R = window.__rommelblok, G = R.G, B = G.B, I = G.I, sp = R.sp, wacht = ms => new Promise(ok => setTimeout(ok, ms));
    R.tekenUit = true; R.valVrij = 600;
    // een vlak stukje gras zoeken
    let plek = null;
    for (let r = 0; r < 30 && !plek; r++) for (let dz = -r; dz <= r && !plek; dz++) for (let dx = -r; dx <= r && !plek; dx++) {
      const X = Math.floor(sp.x) + dx, Z = Math.floor(sp.z) + dz;
      for (let y = 100; y > 40; y--) { const v = R.blokOp(X, y, Z); if (v > 0 && G.VAST[v & 255]) { if ((v & 255) === B.gras) { let ok = true; for (let a = -1; a <= 4; a++) for (let b = -1; b <= 3; b++) { if ((R.blokOp(X + a, y, Z + b) & 255) !== B.gras) ok = false; const o = R.blokOp(X + a, y + 1, Z + b) & 255; if (o && G.VAST[o]) ok = false; } if (ok) plek = [X, y, Z]; } break; } }
    }
    const [X, Y, Z] = plek;
    for (let a = -1; a <= 4; a++) for (let b = -1; b <= 5; b++) for (let h = 1; h <= 3; h++) if (R.blokOp(X + a, Y + h, Z + b)) R.zetBlok(X + a, Y + h, Z + b, 0);
    await wacht(300);
    const start = R.acties.log.length;
    const doel = (x, y, z, n) => ({ x, y, z, v: R.blokOp(x, y, z), n: n || [0, 1, 0], p: [x + 0.5, y + 1, z + 0.5] });
    // 1. een blok gras weghakken, 2. planken neerzetten
    R.breek(doel(X, Y, Z), false);
    R.geef('planken_eik', 4); R.geef('kist', 1); R.geef('deur', 1);
    const kies = s => R.kies(R.WD.inv.findIndex(v => v && v.id === (I[s] !== undefined ? I[s] : B[s])));
    kies('planken_eik'); R.plaats(doel(X + 1, Y, Z), R.WD.inv[R.WD.kies]);
    // 3. een kist, met iets erin (via het kistscherm)
    kies('kist'); R.plaats(doel(X + 2, Y, Z), R.WD.inv[R.WD.kies]);
    R.openBlok('kist', { x: X + 2, y: Y + 1, z: Z, v: R.blokOp(X + 2, Y + 1, Z) }); await wacht(150);
    R.WD.dingen[(X + 2) + ',' + (Y + 1) + ',' + Z].inhoud[4] = { id: I.appel, n: 3 }; R.geef('stok', 1); await wacht(50);
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true })); await wacht(150);
    // 4. een deur neerzetten en openen (richten en gebruiken)
    kies('deur'); R.plaats(doel(X + 3, Y, Z + 2), R.WD.inv[R.WD.kies]);
    R.zet(X + 3.5, Y + 1, Z + 4.5); R.kijk(0, -0.15); R.spelTik(0.016, performance.now());
    const opDeur = R.doel && (R.blokOp(R.doel.x, R.doel.y, R.doel.z) & 255) === B.deur; R.kies(8); R.WD.inv[8] = null; R.gebruik();
    // 5. de kist weer kapot: de inhoud valt eruit
    R.breek(doel(X + 2, Y + 1, Z), false);
    await wacht(200);
    const log = JSON.parse(JSON.stringify(R.acties.log.slice(start)));
    // eindstand van alles wat een actie veranderde
    const plekken = new Map(); for (const a of log) for (const g of a.gevolg) if (g[0] === 'b') plekken.set(g[1] + ',' + g[2] + ',' + g[3], 0);
    for (const k of plekken.keys()) { const [x, y, z] = k.split(',').map(Number); plekken.set(k, R.blokOp(x, y, z)); }
    return { log, eind: [...plekken], dingen: JSON.stringify(R.WD.dingen), opDeur, soorten: log.map(a => a.t + ':' + a.gevolg.map(g => g[0]).join('')) };
  });
  console.log('acties:', A.soorten.join('  '), '| op de deur gericht:', A.opDeur);
  console.log(fouten.join(' ') || 'geen fouten (eerste keer)'); const f1 = fouten.length; await sluit();
  // dezelfde wereld opnieuw, en alleen de acties uitvoeren
  ({ page, fouten, sluit } = await open({ q: Q }));
  await wachtKlaar(page); await page.waitForTimeout(1500);
  const Bv = await page.evaluate(async ({ log, eind }) => {
    const R = window.__rommelblok, wacht = ms => new Promise(ok => setTimeout(ok, ms)); R.tekenUit = true;
    const voor = R.acties.log.length;
    for (const a of log) R.acties.ontvang(a);
    await wacht(400);
    let anders = 0; for (const [k, v] of eind) { const [x, y, z] = k.split(',').map(Number); if (R.blokOp(x, y, z) !== v) anders++; }
    return { anders, getest: eind.length, nieuwGemeld: R.acties.log.length - voor, dingen: JSON.stringify(R.WD.dingen), losse: R.losse.length };
  }, A);
  console.log(JSON.stringify(Bv));
  const mis = [], soorten = A.soorten.map(s => s.split(':')[0]);
  for (const s of ['breek', 'plaats', 'kist', 'gebruik']) if (!soorten.includes(s)) mis.push('geen actie ' + s);
  if (!A.soorten.some(s => s.startsWith('breek:') && s.includes('w') && s.includes('l'))) mis.push('kist kapot zonder inhoud eruit');
  if (!A.opDeur) mis.push('niet op de deur gericht');
  if (Bv.anders || !Bv.getest) mis.push(`${Bv.anders} van ${Bv.getest} blokken anders na opnieuw uitvoeren`);
  if (Bv.nieuwGemeld) mis.push('ontvangen acties werden opnieuw gemeld');
  if (Bv.dingen !== A.dingen) mis.push('kisten anders na opnieuw uitvoeren');
  console.log(mis.length ? 'MIS: ' + mis.join(', ') : 'acties: alles goed (zelfde wereld + zelfde acties = zelfde resultaat)');
  console.log(fouten.join(' ') || 'geen fouten'); await sluit();
  process.exit(mis.length || fouten.length || f1 ? 1 : 0);
})();
