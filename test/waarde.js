// hoeveel moeite kost een voorwerp? Een waarde per voorwerp: vaste waarden voor wat je vindt, hakt of oogst,
// en voor de rest de goedkoopste manier om het te maken (recepten en de oven, met brandstof). Voor de balans van het ruilen.
module.exports = function waarden(G) {
  const { IT, I, B, REC, OVEN, TAG } = G, W = new Map();
  const vast = {
    aarde: 0.1, zand: 0.3, grind: 0.3, kei: 0.3, klei: 0.5, sneeuw: 0.2, ijs: 0.5, mergel: 0.3, leisteen: 0.4, graniet: 0.4, basalt: 0.4, marmer: 0.5, veen: 0.3, modder: 0.2, zandsteen: 0.6,
    kolen: 2, koperbrok: 2, ijzerbrok: 4, goudbrok: 7, robijn: 30, sterrensplinter: 30, sterrensteen: 30,
    tarwe: 1, tarwezaad: 0.3, aardappel: 0.8, wortel: 0.8, suikerbiet: 0.8, bietenzaad: 0.5, pompoen: 3, pompoenpit: 1,
    appel: 2, bessen: 1, kersen: 1.5, walnoot: 1.5, paddenstoel_bruin: 0.6, paddenstoel_rood: 0.6, vlas: 0.8, riet: 0.5, hooggras: 0.1, varen: 0.2, cactus: 0.6, waterlelie: 1,
    bessenstruik: 2, was: 1.5, emmer_water: 0, mos: 0.3, klimop: 0.3, spinnenweb: 0.5, gloeizwam: 1, druipsteen_hang: 0.5, druipsteen_staand: 0.5, dorre_struik: 0.2, wilgentak: 0.5,
  };
  for (const [k, v] of Object.entries(vast)) { const id = I[k] !== undefined ? I[k] : B[k]; if (id !== undefined) W.set(id, v); }
  IT.forEach((it, id) => { if (!it) return; const s = it.sleutel; if (/^stam_/.test(s)) W.set(id, 2); if (/^blad_/.test(s)) W.set(id, 0.2); if (/^stekje_/.test(s)) W.set(id, 1.5); if (/^(tulp_|paardenbloem|korenbloem|heide|zonnebloem|klaproos|lavendel|madelief|vergeetmenietje)/.test(s)) W.set(id, 0.6); });
  const v = id => (W.has(id) ? W.get(id) : Infinity);
  const sleutel = s => (typeof s === 'string' && s[0] === '#' ? Math.min(...TAG[s].map(v)) : v(typeof s === 'string' ? (I[s] !== undefined ? I[s] : B[s]) : s));
  // herhalen tot er niets meer verandert (de goedkoopste weg wint)
  for (let ronde = 0; ronde < 30; ronde++) {
    let veranderd = false;
    for (const r of REC) {
      let k = 0;
      if (r.los) for (const s of r.los) k += sleutel(s);
      else for (const rij of r.patroon) for (const c of rij) if (c !== ' ') k += sleutel(r.sleutels[c]);
      const per = k / (r.aantal || 1);
      if (per < v(r.uit) - 1e-9) { W.set(r.uit, per); veranderd = true; }
    }
    for (const o of OVEN) { const per = (sleutel(o.in) + 0.3) / (o.aantal || 1); if (per < v(o.uit) - 1e-9) { W.set(o.uit, per); veranderd = true; } }
    if (!veranderd) break;
  }
  return id => v(id);
};
