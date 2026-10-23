// bewoners in de browser: een dorpje krijgt bewoners (één per bed, met beroepen), ze vinden een route en lopen,
// 's nachts liggen ze in bed en 's ochtends staan ze op, deuren gaan open en weer dicht, ruilen werkt (en raakt op),
// na bewaren en opnieuw openen zijn dezelfde bewoners er (niet dubbel), en het ruilscherm past op een telefoon
const UIT = require('./uit');
const { open, wachtKlaar } = require('./pw');
const wacht = ms => new Promise(ok => setTimeout(ok, ms));
const { gedeeld } = require('./laad.js'); const G = gedeeld();
(async () => {
  const mis = [];
  // het dichtstbijzijnde dorpje bij de start (zaadje 777)
  const A = G.maakWereld(G.zaadVan('777')), sp0 = A.startPlek(); let D = null;
  for (let rz = -2; rz <= 1; rz++) for (let rx = -2; rx <= 1; rx++) { const d = A.dorpVan(rx, rz); if (d && A.bouwVak(Math.floor(d.x / 64), Math.floor(d.z / 64)).soorten.some(s => s[0] === 'dorp') && (!D || Math.hypot(d.x - sp0.x, d.z - sp0.z) < Math.hypot(D.x - sp0.x, D.z - sp0.z))) D = d; }
  const info = A.bouwVak(Math.floor(D.x / 64), Math.floor(D.z / 64)).soorten.find(s => s[0] === 'dorp')[5], bedden = info.gebouwen.reduce((n, g) => n + g.bedden.length, 0);
  console.log(`dorpje ${info.id}: ${info.gebouwen.map(g => g.soort).join(' ')}, ${bedden} bedden`);
  let { page, fouten, sluit, ctx } = await open({ q: 'test=1&zaad=777&stand=overleven&straal=4', ctx: { viewport: { width: 960, height: 600 } } });
  await wachtKlaar(page); await wacht(800);
  await page.evaluate(([x, y, z]) => { const R = window.__rommelblok; R.WD.id = 'bewoners-proef'; R.valVrij = 99999; R.tijd(0.33); R.sp.vliegt = true; R.zet(x + 0.5, y + 6, z + 6.5); }, [D.x, D.h, D.z]);
  await page.waitForFunction(id => (window.__rommelblok.WD.dorpen || []).includes(id), info.id, { timeout: 30000 }).catch(() => {});
  await wacht(4000);
  // 1. bewoners: één per bed, met de beroepen van de werkplaatsen
  const r1 = await page.evaluate(id => { const R = window.__rommelblok, l = R.WD.bewoners.filter(b => b.dorp === id); return { n: l.length, beroepen: l.map(b => b.beroep), ruil: l.map(b => b.ruil.length), ids: l.map(b => b.id), namen: l.map(b => b.naam) }; }, info.id);
  console.log('bewoners:', r1.n, r1.beroepen.join(' '), '| namen:', r1.namen.join(' '));
  if (r1.n !== bedden) mis.push(`${r1.n} bewoners voor ${bedden} bedden`);
  for (const g of info.gebouwen) { const b = { bakkerij: 'bakker', smederij: 'smid', bibliotheek: 'bibliothecaris' }[g.soort]; if (b && !r1.beroepen.includes(b)) mis.push('geen ' + b); }
  if (info.akkers.length && !r1.beroepen.includes('boer')) mis.push('geen boer');
  if (r1.ruil.some(n => n < 4)) mis.push('te weinig ruilen');
  if (new Set(r1.namen).size !== r1.namen.length) mis.push('dubbele namen');
  // 2. overdag: ze vinden een route en lopen (met de echte klok, zodat de route in stukjes gezocht wordt)
  const start = await page.evaluate(id => window.__rommelblok.WD.bewoners.filter(b => b.dorp === id).map(b => [b.x, b.z]), info.id);
  let liep = new Set(), deurOpen = 0;
  for (let i = 0; i < 20; i++) {
    await wacht(1000);
    const s = await page.evaluate(id => { const R = window.__rommelblok; return R.WD.bewoners.filter(b => b.dorp === id).map(b => { const r = R.bwRust.get(b.id) || {}; return [b.id, !!r.pad, b.x, b.z]; }); }, info.id);
    s.forEach(([id, pad, x, z], j) => { if (pad || Math.hypot(x - start[j][0], z - start[j][1]) > 1.5) liep.add(id); });
    deurOpen += await page.evaluate(deuren => deuren.filter(([x, y, z]) => (window.__rommelblok.blokOp(x, y, z) >> 8) & 4).length, info.gebouwen.map(g => g.deur));
  }
  console.log(`overdag: ${liep.size} van de ${r1.n} liepen ergens heen; deuren open gezien: ${deurOpen}`);
  if (liep.size < Math.ceil(r1.n * 0.6)) mis.push(`maar ${liep.size} van de ${r1.n} bewoners lopen`);
  // 3. de avond: naar huis (door de deur); daarna moeten alle deuren weer dicht zijn
  // (de klok net voor de avond zetten en dan vanzelf laten doorlopen: een sprong in de tijd zet iedereen meteen op zijn plek)
  await page.evaluate(() => window.__rommelblok.tijd(0.6995));
  let binnenDoor = 0;
  for (let i = 0; i < 200; i++) { await wacht(250); binnenDoor += await page.evaluate(deuren => deuren.filter(([x, y, z]) => (window.__rommelblok.blokOp(x, y, z) >> 8) & 4).length, info.gebouwen.map(g => g.deur)); }
  // wachten tot niemand meer loopt (hooguit 30 s), en dan nog even voor de laatste deur
  for (let i = 0; i < 30 && await page.evaluate(id => window.__rommelblok.WD.bewoners.some(b => b.dorp === id && (window.__rommelblok.bwRust.get(b.id) || {}).pad), info.id); i++) await wacht(1000);
  await wacht(3000);
  const avond = await page.evaluate(([id, deuren]) => {
    const R = window.__rommelblok, l = R.WD.bewoners.filter(b => b.dorp === id);
    // thuis: binnen, bij je bed of op je plekje in huis
    const thuisBij = b => [b.thuis, b.bed].some(p => p && Math.hypot(b.x - p[0] - 0.5, b.z - p[2] - 0.5) < 2.5);
    return { thuis: l.filter(thuisBij).length, onderweg: l.filter(b => !thuisBij(b) && (R.bwRust.get(b.id) || {}).pad).length,
      // een deur die openstaat terwijl er niemand in de deuropening staat (zoals in het spel: iemand die erdoor loopt, mag hem openhouden)
      open: deuren.filter(([x, y, z]) => ((R.blokOp(x, y, z) >> 8) & 4) && !R.WD.bewoners.some(b => Math.abs(b.x - x - 0.5) < 0.75 && Math.abs(b.z - z - 0.5) < 0.75)).length }; }, [info.id, info.gebouwen.map(g => g.deur)]);
  console.log((await page.evaluate(id => { const R = window.__rommelblok; return R.WD.bewoners.filter(b => b.dorp === id && b.thuis && Math.hypot(b.x - b.thuis[0] - 0.5, b.z - b.thuis[2] - 0.5) >= 2.5).map(b => { const r = R.bwRust.get(b.id) || {}; return `  niet thuis: ${b.naam} (${b.beroep}) op ${Math.hypot(b.x - b.thuis[0] - 0.5, b.z - b.thuis[2] - 0.5).toFixed(1)} m, ${r.pad ? 'loopt (' + r.i + '/' + r.pad.length + ')' : 'staat, wacht ' + (r.wacht || 0).toFixed(1)}, fase ${r.fase}, doel ${r.doel && r.doel.plek}`; }).join('\n'); }, info.id)));
  console.log(`avond: ${avond.thuis} van de ${r1.n} thuis, ${avond.onderweg} nog onderweg; deuren open gezien onderweg: ${binnenDoor}, nu nog open: ${avond.open}`);
  if (!binnenDoor && !deurOpen) mis.push('nooit een deur open gezien');
  if (avond.thuis < Math.ceil(r1.n * 0.5) || avond.thuis + avond.onderweg < r1.n) mis.push(`maar ${avond.thuis} van de ${r1.n} thuis en ${avond.onderweg} onderweg`);
  if (avond.open) {
    console.log(await page.evaluate(([id, deuren]) => { const R = window.__rommelblok; return deuren.filter(([x, y, z]) => ((R.blokOp(x, y, z) >> 8) & 4) && !R.WD.bewoners.some(b => Math.abs(b.x - x - 0.5) < 0.75 && Math.abs(b.z - z - 0.5) < 0.75)).map(([x, y, z]) => 'open deur ' + [x, y, z] + ': ' + R.WD.bewoners.filter(b => Math.hypot(b.x - x - 0.5, b.z - z - 0.5) < 3).map(b => { const r = R.bwRust.get(b.id) || {}; return `${b.naam} ${b.beroep} op ${Math.hypot(b.x - x - 0.5, b.z - z - 0.5).toFixed(2)} (${b.x.toFixed(2)},${b.y.toFixed(2)},${b.z.toFixed(2)}) thuis ${b.thuis} pad ${!!r.pad} doel ${r.doel && r.doel.plek} fase ${r.fase}`; }).join(' | ')).join('\n'); }, [info.id, info.gebouwen.map(g => g.deur)]));
    mis.push(`${avond.open} deuren blijven open`);
  }
  // 4. de nacht overslaan (zoals slapen): iedereen ligt meteen in bed; daarna de ochtend: iedereen is op
  await page.evaluate(() => window.__rommelblok.tijd(0.9)); await wacht(1500);
  const nacht = await page.evaluate(id => { const R = window.__rommelblok; return R.WD.bewoners.filter(b => b.dorp === id).filter(b => (R.bwRust.get(b.id) || {}).ligt).length; }, info.id);
  await page.evaluate(() => { const R = window.__rommelblok; R.WD.dag = (R.WD.dag || 0) + 1; R.tijd(0.3); }); await wacht(1500);
  const ochtend = await page.evaluate(id => { const R = window.__rommelblok; return R.WD.bewoners.filter(b => b.dorp === id).filter(b => (R.bwRust.get(b.id) || {}).ligt).length; }, info.id);
  console.log(`nacht: ${nacht} van de ${r1.n} in bed; ochtend: ${ochtend} nog in bed`);
  if (nacht !== r1.n) mis.push(`'s nachts maar ${nacht} van de ${r1.n} in bed`);
  if (ochtend) mis.push(`'s ochtends nog ${ochtend} in bed`);
  // beeld van een slapende bewoner
  await page.evaluate(() => window.__rommelblok.tijd(0.9)); await wacht(800);
  await page.evaluate(id => { const R = window.__rommelblok, b = R.WD.bewoners.find(x => x.dorp === id && x.bed); R.zet(b.bed[0] + 0.5 + 1.6, b.bed[1] + 1.4, b.bed[2] + 0.5 + 1.6); R.kijk(Math.atan2(1.6, 1.6), -0.55); }, info.id);
  await wacht(1500); await page.screenshot({ path: UIT + '/bewoner_slaapt.png' });
  await page.evaluate(() => window.__rommelblok.tijd(0.35)); await wacht(1500);
  // 5. ruilen: de spullen geven, het scherm openen, ruilen tot het op is
  const rr = await page.evaluate(async id => {
    const R = window.__rommelblok, wacht = ms => new Promise(ok => setTimeout(ok, ms)), b = R.WD.bewoners.find(x => x.dorp === id && x.beroep !== 'dorpeling') || R.WD.bewoners.find(x => x.dorp === id);
    const nr = b.ruil[0][0], a = R.RUIL[b.beroep][nr], sl = s => (R.G.I[s] !== undefined ? R.G.I[s] : R.G.B[s]);
    for (const [s, n] of a.geef) R.geef(s, n * (a.max + 1));
    const voor = a.geef.map(([s]) => R.tel(sl(s))), krijgVoor = R.tel(sl(a.krijg[0]));
    R.openRuilen(b); await wacht(300);
    const rij = document.querySelector('#rb-ruil-lijst .rb-ruil-rij'), knop = rij && rij.querySelector('button');
    const open = document.querySelector('#rb-ruilen') && !document.querySelector('#rb-ruilen').hidden;
    for (let i = 0; i < a.max; i++) { document.querySelector('#rb-ruil-lijst .rb-ruil-rij button').click(); await wacht(30); }
    const knop2 = document.querySelector('#rb-ruil-lijst .rb-ruil-rij button');
    const na = a.geef.map(([s]) => R.tel(sl(s))), krijgNa = R.tel(sl(a.krijg[0]));
    return { open, beroep: b.beroep, ruil: a.geef.map(g => g.join(' ')).join(' + ') + ' -> ' + a.krijg.join(' '), max: a.max, weg: voor.map((v, i) => v - na[i]), moet: a.geef.map(([, n]) => n * a.max), erbij: krijgNa - krijgVoor, moetErbij: a.krijg[1] * a.max, op: knop2.disabled, tekst: knop2.textContent, id: b.id, gedaan: b.ruil[0][1] };
  }, info.id);
  console.log('ruilen:', JSON.stringify(rr));
  await page.screenshot({ path: UIT + '/bewoner_ruilen.png' });
  if (!rr.open) mis.push('ruilscherm gaat niet open');
  if (rr.weg.some((v, i) => v !== rr.moet[i]) || rr.erbij !== rr.moetErbij) mis.push('ruilen klopt niet: ' + JSON.stringify(rr));
  if (!rr.op) mis.push('ruil raakt niet op');
  // de volgende dag (als ze wakker zijn) is er weer voorraad
  await page.evaluate(() => { const R = window.__rommelblok; R.WD.dag = (R.WD.dag || 0) + 1; R.bewonersTik(0.016); });
  const nieuw = await page.evaluate(id => window.__rommelblok.WD.bewoners.find(b => b.id === id).ruil[0][1], rr.id);
  if (nieuw !== 0) mis.push('geen nieuwe voorraad de volgende dag');
  // 6. het ruilscherm op een telefoon (360 breed): niets valt eruit
  await page.setViewportSize({ width: 360, height: 700 }); await wacht(500);
  const past = await page.evaluate(() => { const p = document.querySelector('#rb-ruilen .rb-paneel'), r = p.getBoundingClientRect(), rij = [...document.querySelectorAll('.rb-ruil-rij')].map(e => e.scrollWidth <= e.clientWidth + 1); return { breed: r.width, binnen: r.left >= 0 && r.right <= innerWidth, rijen: rij.every(Boolean), scroll: document.documentElement.scrollWidth <= innerWidth }; });
  await page.screenshot({ path: UIT + '/bewoner_ruilen_telefoon.png' });
  console.log('telefoon:', JSON.stringify(past));
  if (!past.binnen || !past.rijen || !past.scroll) mis.push('ruilscherm past niet op een telefoon');
  await page.setViewportSize({ width: 960, height: 600 });
  await page.keyboard.press('Escape'); await wacht(200);
  // 7. bewaren en opnieuw openen: dezelfde bewoners, niet dubbel
  await page.evaluate(async () => { await window.__rommelblok.bewaarWereld(true); });
  const opgeslagen = await page.evaluate(async () => { const w = (await window.__rommelblok.alleWerelden()).find(x => x.id === 'bewoners-proef'); return w ? { n: (w.bewoners || []).length, dorpen: (w.dorpen || []).length, velden: Object.keys((w.bewoners || [])[0] || {}).join(',') } : null; });
  console.log('opgeslagen:', JSON.stringify(opgeslagen));
  const f1 = fouten.slice(); await sluit();
  ({ page, fouten, sluit } = await open({ q: 'test=1&zaad=777&stand=overleven&straal=4', ctx: { viewport: { width: 960, height: 600 } } }));
  await wachtKlaar(page); await wacht(500);
  // de bewaarde wereld openen (zoals vanuit het beginscherm)
  await page.evaluate(async () => { const R = window.__rommelblok, w = (await R.alleWerelden()).find(x => x.id === 'bewoners-proef'); if (w) await R.speelWereld(w); });
  await page.waitForFunction(() => window.__rommelblok.klaar, null, { timeout: 60000 }); await wacht(8000);
  const terug = await page.evaluate(id => { const R = window.__rommelblok, l = R.WD.bewoners.filter(b => b.dorp === id); return { n: l.length, ids: l.map(b => b.id), totaal: R.WD.bewoners.length, uniek: new Set(R.WD.bewoners.map(b => b.id)).size }; }, info.id);
  console.log('na opnieuw openen:', JSON.stringify(terug));
  if (terug.n !== r1.n || terug.ids.join() !== r1.ids.join()) mis.push('andere bewoners na opnieuw openen');
  if (terug.uniek !== terug.totaal) mis.push('dubbele bewoners');
  await page.evaluate(async () => { try { await window.__rommelblok.verwijder('bewoners-proef'); } catch (e) {} });
  mis.push(...f1, ...fouten);
  console.log(mis.length ? 'FOUT: ' + mis.join(' | ') : 'bewoners: alles goed');
  await sluit();
  process.exit(mis.length ? 1 : 0);
})();
