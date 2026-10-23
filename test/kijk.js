// opent de pagina in Chromium, wacht tot de wereld er is, maakt een schermafbeelding
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const http = require('http'), fs = require('fs'), path = require('path');
const UIT = require('./uit'); const BESTAND = (process.argv.find(a => a.startsWith('bestand=')) || 'bestand=rommelblok.html').slice(8);
const args = Object.fromEntries(process.argv.slice(2).map(a => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; }));
const W = +(args.w || 1280), H = +(args.h || 720), wacht = +(args.wacht || 8000), naam = args.naam || 'kijk';
const srv = http.createServer((q, r) => { const f = path.join(UIT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/rommelblok.html')); if (fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream' }); r.end(fs.readFileSync(f)); } else { r.writeHead(404); r.end(); } }).listen(0, async () => {
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: +(args.dpr || 1), isMobile: !!args.mobiel, hasTouch: !!args.mobiel });
  const page = await ctx.newPage();
  await page.route(/workers\.dev|cloudflareinsights|rubensrommelhoekje|api\.github/, r => r.abort());
  const fouten = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') fouten.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => fouten.push('pageerror: ' + e.message));
  await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => console.error('CSP: ' + e.violatedDirective + ' ' + e.blockedURI)); });
  const q = args.q || 'test=1&zaad=12345';
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/${BESTAND}?${q}`);
  await page.waitForFunction(() => window.__rommelblok && window.__rommelblok.klaar, null, { timeout: 60000 }).catch(() => fouten.push('niet klaar binnen 60 s'));
  const klaarNa = Date.now() - t0;
  if (args.js) await page.evaluate(args.js);
  await page.waitForTimeout(wacht);
  const info = await page.evaluate(() => { const r = window.__rommelblok; return r ? { fps: r.fps.toFixed(1), ms: r.frameMs.toFixed(1), straal: r.straal, schaal: r.schaal, stats: r.R.stats, gpu: r.R.gpuMB.toFixed(1), pos: [r.sp.x, r.sp.y, r.sp.z].map(v => v.toFixed(1)), gl: (() => { const g = r.R.gl; const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })() } : null; });
  await page.screenshot({ path: path.join(UIT, naam + '.png') });
  console.log(JSON.stringify({ klaarNa, info }, null, 0));
  console.log(fouten.slice(0, 20).join('\n') || 'geen fouten');
  await browser.close(); srv.close();
});
