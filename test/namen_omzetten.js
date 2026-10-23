// Bewoners uit een oudere wereld krijgen eenmalig hun nieuwe naam (stap 2): node test/namen_omzetten.js
// - een oude naam wordt de nieuwe naam op dezelfde plek in de lijst; een naam die al nieuw is, blijft
// - het gebeurt maar één keer (WD.bwNamen), dus een nieuwe naam die toevallig ook in de oude lijst stond, verandert niet nog eens
// - namen in een dorpje blijven uniek
const { open, wachtKlaar } = require('./pw');
(async () => {
  const b = await open({ q: 'test=1&zaad=777&stand=overleven&straal=2' });
  const { page } = b; await wachtKlaar(page);
  const r = await page.evaluate(() => {
    const R = window.__rommelblok, WD = R.WD, oud = WD.bewoners;
    WD.bewoners = [{ naam: 'Sjeng' }, { naam: 'Sraar' }, { naam: 'Fien' }, { naam: 'Mia' }, { naam: 'Anna' }]; delete WD.bwNamen;
    R.bewonerNamenOmzetten(); const een = WD.bewoners.map(k => k.naam), vlag = WD.bwNamen;
    R.bewonerNamenOmzetten(); const twee = WD.bewoners.map(k => k.naam);
    const verwacht = ['Sjeng', 'Sraar', 'Fien', 'Mia'].map(n => R.NAMEN[R.NAMEN_OUD.indexOf(n)]).concat(['Anna']);
    // alle oude namen: elk een andere nieuwe
    const alle = new Set(R.NAMEN_OUD.map((n, i) => R.NAMEN[i]));
    WD.bewoners = oud;
    return { een, twee, vlag, verwacht, uniek: alle.size === R.NAMEN_OUD.length };
  });
  console.log(JSON.stringify(r));
  const mis = [];
  if (r.een.join() !== r.verwacht.join()) mis.push('omgezet: ' + r.een.join(', '));
  if (r.twee.join() !== r.een.join()) mis.push('de tweede keer veranderde er nog iets');
  if (r.vlag !== 2) mis.push('geen vlag');
  if (!r.uniek) mis.push('twee oude namen krijgen dezelfde nieuwe naam');
  console.log(mis.length ? 'MIS: ' + mis.join(' | ') : 'namen omzetten: alles goed (' + r.een.join(', ') + ')');
  console.log(b.fouten.join('\n') || 'geen fouten'); await b.sluit();
  process.exit(mis.length || b.fouten.length ? 1 : 0);
})();
