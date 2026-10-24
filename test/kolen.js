// Steenkool dicht bij de oppervlakte (gedeelde code): node test/kolen.js
// 1. zichtbare kolen (aan de lucht, tot 30 blokken onder de grond) en kolen tot 20 blokken diep: veel vaker dan vroeger
// 2. het enige verschil met vroeger: steen die steenkool werd (geen ander blok veranderd)
// 3. alleen in nieuwe stukken: met opt.erts 1 (een oudere gedeelde wereld) en in de stukken uit opt.kolenOud
//    (waar je al was in een oudere eigen wereld) is alles precies zoals vroeger
// 4. hetzelfde zaadje geeft precies dezelfde stukken
const { G } = require('../shared/index.js');
const B = G.B, KOOL = B.erts_kolen;
let fout = 0; const mis = (...a) => { fout++; console.log('MIS:', ...a); };
const gelijk = (a, b) => Buffer.from(a.buffer).equals(Buffer.from(b.buffer));
let tel = { oud: { zicht: 0, ondiep: 0 }, nieuw: { zicht: 0, ondiep: 0 } }, stukken = 0, anders = 0;
for (const zaad of [777, 12345, 4242, 31337]) {
  const Wo = G.maakWereld(zaad, { erts: 1 }), Wn = G.maakWereld(zaad), Wn2 = G.maakWereld(zaad);
  const s0 = Wn.startPlek(), cx0 = Math.floor(s0.x) >> 4, cz0 = Math.floor(s0.z) >> 4;
  const oudPlekken = []; for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) oudPlekken.push(cx0 + x, cz0 + z);
  const Wk = G.maakWereld(zaad, { kolenOud: Int32Array.from(oudPlekken) });
  for (const [px, pz] of [[0, 0], [40, -25], [-60, 30], [120, 120]]) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const cx = cx0 + px + dx, cz = cz0 + pz + dz, a = Wo.maakStuk(cx, cz).d, b = Wn.maakStuk(cx, cz).d; stukken++;
    if (!gelijk(b, Wn2.maakStuk(cx, cz).d)) mis('zaadje', zaad, 'stuk', cx, cz, 'is de tweede keer anders');
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { anders++; if (!(a[i] === B.steen && b[i] === KOOL)) { mis('zaadje', zaad, 'stuk', cx, cz, 'blok', i, a[i], '->', b[i]); break; } }
    const k = Wk.maakStuk(cx, cz).d, inOud = Math.abs(cx - cx0) <= 1 && Math.abs(cz - cz0) <= 1;
    if (inOud && !gelijk(k, a)) mis('zaadje', zaad, 'stuk', cx, cz, 'waar je al was, kreeg toch nieuwe kolen');
    if (!inOud && !gelijk(k, b)) mis('zaadje', zaad, 'stuk', cx, cz, 'is anders dan in een nieuwe wereld');
    // tellen
    for (const [naam, d] of [['oud', a], ['nieuw', b]]) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      let top = 0; for (let y = G.HOOG - 1; y > 0; y--) { const id = d[G.idx(x, y, z)] & 255; if (id && G.DICHT[id]) { top = y; break; } }
      for (let y = Math.max(1, top - 30); y <= top; y++) {
        if ((d[G.idx(x, y, z)] & 255) !== KOOL) continue;
        if (y >= top - 20) tel[naam].ondiep++;
        const lucht = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a2, b2, c2]) => { const X = x + a2, Y = y + b2, Z = z + c2; return X >= 0 && Z >= 0 && X < 16 && Z < 16 && d[G.idx(X, Y, Z)] === 0; });
        if (lucht) tel[naam].zicht++;
      }
    }
  }
}
const per = (n) => (n / stukken).toFixed(1);
console.log(stukken + ' stukken. Per stuk, vroeger -> nu: kolen aan de lucht (tot 30 diep) ' + per(tel.oud.zicht) + ' -> ' + per(tel.nieuw.zicht) + ', kolen tot 20 blokken diep ' + per(tel.oud.ondiep) + ' -> ' + per(tel.nieuw.ondiep) + ' (' + anders + ' blokken steen werden steenkool)');
if (!(tel.nieuw.zicht >= tel.oud.zicht * 2.5)) mis('niet genoeg meer zichtbare kolen');
if (!(tel.nieuw.ondiep >= tel.oud.ondiep * 2)) mis('niet genoeg meer kolen dicht onder de grond');
console.log(fout ? fout + ' FOUTEN' : 'steenkool: alles goed');
process.exit(fout ? 1 : 0);
