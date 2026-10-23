// Rails: welke kanten verbonden zijn, en hoe een nieuw spoor aansluit.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { B } from './blokken.js';
import { RICHTING } from './vormen.js';

// ---------------- rails: welke kanten verbonden zijn, en hoe een nieuw spoor aansluit op wat er al ligt
const isSpoor = id => id === B.mijnspoor || id === B.stuwspoor;
// de twee einden (richtingen 0 tot 3); bij een helling eerst het lage eind, dan het hoge
function spoorEinden(st) { st &= 15; if (st < 4) return st & 1 ? [3, 1] : [0, 2]; if (st < 8) { const d = st - 4; return [(d + 2) % 4, d]; } const k = st - 8; return [k, (k + 1) % 4]; }
const spoorOp = st => { st &= 15; return st >= 4 && st < 8 ? st - 4 : -1; };
const eindHoogte = (st, e) => (spoorOp(st) === e ? 1 : 0);
const heeftEind = (st, e) => { const [a, b] = spoorEinden(st); return a === e || b === e; };
// hoeveel einden van het spoor op (px, py, pz) aansluiten op een ander spoor (buur geeft blokwaarden op relatieve plekken)
function aansluitingen(buur, px, py, pz, st, behalve) {
  let n = 0;
  for (const e of spoorEinden(st)) {
    if (e === behalve) continue;
    const [dx, dz] = RICHTING[e], h = py + eindHoogte(st, e), terug = (e + 2) % 4;
    for (const ny of [h, h - 1]) { const v = buur(px + dx, ny, pz + dz); if (v > 0 && isSpoor(v & 255) && heeftEind(v >> 8, terug) && ny + eindHoogte(v >> 8, terug) === h) { n++; break; } }
  }
  return n;
}
function staatVoor(paar, stuw) {
  // paar: lijst van { d, dy } (dy 1: het spoor ernaast ligt hoger, dus deze kant gaat omhoog)
  if (paar.length === 2) {
    const [a, c] = paar;
    if ((a.d + 2) % 4 === c.d) { if (a.dy === 1) return 4 + a.d; if (c.dy === 1) return 4 + c.d; return a.d & 1; }
    if (stuw || a.dy === 1 || c.dy === 1) return -1;
    return 8 + (((c.d - a.d + 4) % 4) === 1 ? a.d : c.d);
  }
  if (paar.length === 1) return paar[0].dy === 1 ? 4 + paar[0].d : paar[0].d & 1;
  return -1;
}
// de stand van een nieuw spoor (kr: de richting waarin je kijkt), en welke sporen ernaast mee moeten draaien: [[dx, dy, dz, waarde], ...]
function spoorKies(buur, kr, stuw) {
  const kand = [];
  for (let d = 0; d < 4; d++) {
    const [dx, dz] = RICHTING[d], terug = (d + 2) % 4;
    for (const dy of [0, 1, -1]) {
      const v = buur(dx, dy, dz); if (!(v > 0 && isSpoor(v & 255))) continue;
      const ns = v >> 8, hT = dy === 1 ? 1 : 0;
      const wijst = heeftEind(ns, terug) && dy + eindHoogte(ns, terug) === hT;
      const vrij = aansluitingen(buur, dx, dy, dz, ns, terug) < 2;
      if (wijst || vrij) { kand.push({ d, dy, wijst, v, dx, dz }); break; }
    }
  }
  kand.sort((a, b) => (b.wijst - a.wijst));
  // een rechte lijn gaat voor; anders de eerste twee (een bocht), anders één
  let paar = [];
  for (let i = 0; i < kand.length && !paar.length; i++) for (let j = i + 1; j < kand.length; j++) if ((kand[i].d + 2) % 4 === kand[j].d && staatVoor([kand[i], kand[j]], stuw) >= 0) { paar = [kand[i], kand[j]]; break; }
  if (!paar.length && kand.length >= 2 && staatVoor(kand.slice(0, 2), stuw) >= 0) paar = kand.slice(0, 2);
  if (!paar.length && kand.length) paar = [kand.find(k => k.dy !== 1) || kand[0]];
  let st = staatVoor(paar, stuw); if (st < 0) { paar = []; st = kr & 1; }
  // de sporen ernaast die nog niet naar ons wijzen, gaan ons kant op
  const buren = [];
  for (const k of paar) {
    if (k.wijst) continue;
    const ns = k.v >> 8, terug = (k.d + 2) % 4, id = k.v & 255, stuwN = id === B.stuwspoor;
    // welk eind van de buur sluit al aan (dat blijft)?
    let blijf = null;
    for (const e of spoorEinden(ns)) { if (e === terug) continue; if (aansluitingenEind(buur, k.dx, k.dy, k.dz, ns, e)) { blijf = e; break; } }
    // de buur ligt lager: hij gaat omhoog naar ons; ligt hij hoger, dan gaan wij omhoog en blijft hij vlak
    const lijst = [{ d: terug, dy: k.dy === -1 ? 1 : 0 }];
    if (blijf !== null) lijst.push({ d: blijf, dy: eindHoogte(ns, blijf) });
    const nst = staatVoor(lijst, stuwN);
    if (nst >= 0) buren.push([k.dx, k.dy, k.dz, id | (((ns & 0xF0) | nst) << 8)]);
  }
  return { st, buren };
}
// sluit dit ene eind van het spoor op (px, py, pz) aan op een ander spoor?
function aansluitingenEind(buur, px, py, pz, st, e) {
  const [dx, dz] = RICHTING[e], h = py + eindHoogte(st, e), terug = (e + 2) % 4;
  for (const ny of [h, h - 1]) { const v = buur(px + dx, ny, pz + dz); if (v > 0 && isSpoor(v & 255) && heeftEind(v >> 8, terug) && ny + eindHoogte(v >> 8, terug) === h) return true; }
  return false;
}


export {
  isSpoor, spoorEinden, spoorOp, eindHoogte, heeftEind, aansluitingen, staatVoor, spoorKies, aansluitingenEind,
};
