const UIT = require('./uit');
const fs = require('fs'), path = require('path');
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const SRC = path.join(__dirname, '..', 'src');
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#6b5a4a;font:11px sans-serif;color:#fff"><div id="r" style="display:flex;flex-wrap:wrap;gap:6px;padding:8px;width:900px"></div><script>${fs.readFileSync(path.join(SRC, 'gedeeld.js'), 'utf8')}\n${fs.readFileSync(path.join(SRC, 'texturen.js'), 'utf8')}
const G = RB_GEDEELD(); let t = performance.now(); const T = RB_TEXTUREN(G); const tT = performance.now() - t; t = performance.now(); const I = RB_ICONEN(G, T);
const ids = ${JSON.stringify(process.argv.slice(2))}.map(s => G.I[s] !== undefined ? G.I[s] : G.B[s]);
for (const id of ids) { const d = document.createElement('div'); d.style.cssText = 'width:64px;text-align:center;background:rgba(0,0,0,.25);border-radius:6px;padding:4px 0'; const im = new Image(); im.src = I.icoon(id, 48); im.style.cssText = 'width:48px;height:48px;image-rendering:pixelated;display:block;margin:auto'; d.appendChild(im); d.appendChild(document.createTextNode(G.IT[id].sleutel.slice(0, 11))); document.getElementById('r').appendChild(d); }
document.title = 'klaar ' + tT.toFixed(1) + ' iconen ' + (performance.now() - t).toFixed(1);
</script>`;
fs.mkdirSync(path.join(UIT, 'icontest'), { recursive: true }); fs.writeFileSync(path.join(UIT, 'icontest', 'iconen.html'), html);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 920, height: 700 } });
  const fouten = []; p.on('pageerror', e => fouten.push(e.message)); p.on('console', m => { if (m.type() === 'error') fouten.push(m.text()); });
  await p.goto('file://' + path.join(UIT, 'icontest', 'iconen.html'));
  await p.waitForFunction(() => document.title.startsWith('klaar'), null, { timeout: 10000 }).catch(() => {});
  console.log(await p.title(), fouten);
  await p.screenshot({ path: path.join(UIT, 'iconen_test.png'), fullPage: true });
  await b.close();
})();
