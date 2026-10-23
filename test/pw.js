// gedeelde hulp voor browsertests
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const http = require('http'), fs = require('fs'), path = require('path');
const UIT = require('./uit');
async function open(opties = {}) {
  const srv = await new Promise(ok => { const s = http.createServer((q, r) => { const f = path.join(UIT, decodeURIComponent(q.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/json' }); r.end(fs.readFileSync(f)); } else { r.writeHead(404); r.end(); } }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1024, height: 600 }, acceptDownloads: true }, opties.ctx || {}));
  const page = await ctx.newPage();
  await page.route(/workers\.dev|cloudflareinsights|rubensrommelhoekje|api\.github|fonts\.g/, r => r.abort());
  const fouten = [];
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|status of 404/.test(m.text())) fouten.push('console: ' + m.text()); });
  page.on('pageerror', e => fouten.push('pageerror: ' + e.message));
  await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => console.error('CSP: ' + e.violatedDirective + ' ' + e.blockedURI)); });
  if (opties.taal !== null) await page.addInitScript(t => { try { if (!localStorage.getItem('rommelblok-taal')) localStorage.setItem('rommelblok-taal', t); } catch (e) {} }, opties.taal || 'nl');
  const url = `http://127.0.0.1:${srv.address().port}/${opties.bestand || 'rommelblok.html'}${opties.q ? '?' + opties.q : ''}`;
  await page.goto(url);
  const sluit = async () => { await browser.close(); srv.close(); };
  return { page, fouten, sluit, url, ctx };
}
const wachtKlaar = page => page.waitForFunction(() => window.__rommelblok && window.__rommelblok.klaar, null, { timeout: 60000 });
module.exports = { open, wachtKlaar };
