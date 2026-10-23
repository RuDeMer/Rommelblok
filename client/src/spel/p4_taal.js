// ============================================================================
// Taal: Nederlands en Engels. De Nederlandse zin is de sleutel; EN_ZIN geeft de Engelse.
// Keuze in localStorage 'rommelblok-taal'; zonder keuze volgt het spel de browser.
// ============================================================================
let TAAL = 'nl';
try { TAAL = localStorage.getItem('rommelblok-taal') || ((navigator.language || 'nl').toLowerCase().startsWith('nl') ? 'nl' : 'en'); } catch (e) {}
if (TAAL !== 'nl' && TAAL !== 'en') TAAL = 'nl';
const EN_ZIN = {};
function t(nl, ...a) { let s = TAAL === 'en' && EN_ZIN[nl] !== undefined ? EN_ZIN[nl] : nl; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s; }
function naam(id) { const it = IT[id]; if (!it) return ''; return TAAL === 'en' ? it.en : it.nl; }
function biomeNaam(b) { const x = G.BIOMEN[b]; return x ? (TAAL === 'en' ? x[2] : x[1]) : ''; }
function zetTaal(taal) {
  TAAL = taal; try { localStorage.setItem('rommelblok-taal', taal); } catch (e) {}
  document.documentElement.lang = taal;
  vertaalPagina();
}
function vertaalPagina() {
  for (const el of document.querySelectorAll('[data-t]')) { if (!el.dataset.nl) el.dataset.nl = el.innerHTML; el.innerHTML = TAAL === 'en' && EN_ZIN[el.dataset.nl] !== undefined ? EN_ZIN[el.dataset.nl] : el.dataset.nl; }
  for (const el of document.querySelectorAll('[data-t-label]')) { if (!el.dataset.nlLabel) el.dataset.nlLabel = el.getAttribute('aria-label') || ''; el.setAttribute('aria-label', t(el.dataset.nlLabel)); }
  for (const el of document.querySelectorAll('[data-t-titel]')) { if (!el.dataset.nlTitel) el.dataset.nlTitel = el.getAttribute('title') || ''; el.setAttribute('title', t(el.dataset.nlTitel)); }
  for (const el of document.querySelectorAll('[data-t-plek]')) { if (!el.dataset.nlPlek) el.dataset.nlPlek = el.getAttribute('placeholder') || ''; el.setAttribute('placeholder', t(el.dataset.nlPlek)); }
  const k = $('rb-taal'); if (k) { k.textContent = TAAL === 'en' ? 'NL' : 'EN'; k.setAttribute('aria-label', TAAL === 'en' ? 'Nederlands' : 'English'); }
  if (typeof naTaal === 'function') naTaal();
}
