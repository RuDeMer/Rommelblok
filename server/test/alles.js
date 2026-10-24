// Alle servertests: node test/alles.js (vanuit server/)
// Een echte server op een vrije poort met een eigen database, en nagemaakte spelers die het protocol spreken.
import { startServer, maakWereld, doeMee, speler, wacht, goed, fout, G } from './hulp.js';
import { maakServer } from '../src/server.js';
import WebSocket from 'ws';

const { B, I } = G;
const S = await startServer({ MAX_NIEUW_PER_DAG: '50', MAX_PER_ADRES: '40' });
const t0 = Date.now();
const antwoord = (p, nr, ms = 15000) => p.op(m => (m.t === 'ja' || m.t === 'nee') && m.nr === nr, ms);
let nr = 0;
const doe = (p, a) => { a.nr = ++nr; p.stuur({ t: 'actie', a }); return antwoord(p, a.nr); };
const plek = (p, x, y, z, extra) => p.stuur(Object.assign({ t: 'p', x, y, z, yaw: 0, pitch: 0, f: 0, h: 0, a: 0, k: 0 }, extra));

console.log('--- samen in een wereld');
const A = await maakWereld(S.url, { zaad: 4242, stand: 'overleven' });
goed(A.w.t === 'welkom' && A.w.eigenaar && /^[a-z]+-[a-z]+-[a-z]+-\d+$/.test(A.code) && A.sleutel, 'een nieuwe wereld: welkom als eigenaar, met een uitnodigingscode (' + A.code + ')');
goed(A.w.wereld.zaad === 4242 && A.w.wereld.stand === 'overleven' && Array.isArray(A.w.start), 'het welkom heeft het zaadje, de stand en de startplek');
const Bm = await doeMee(S.url, A.code);
goed(Bm.w.t === 'welkom' && !Bm.w.eigenaar && Bm.w.spelers.length === 1, 'meedoen met de code: welkom, geen eigenaar, en je ziet wie er al is');
goed(!!(await A.p.soort('erbij')), 'de eigenaar hoort dat er iemand bij komt');
const C = await doeMee(S.url, A.code.toUpperCase().replace(/-/g, ' '));
goed(C.w.t === 'welkom', 'de code mag met hoofdletters en spaties');
await C.p.sluit();
goed(!!(await A.p.soort('weg')), 'wie weggaat, verdwijnt bij de anderen');
const st = A.w.start;
plek(Bm.p, st[0] + 1, st[1], st[2]);
goed(!!(await A.p.op(m => m.t === 'spelers' && m.l.some(r => r[0] === Bm.w.jij && Math.abs(r[1] - st[0] - 1) < 0.01))), 'plekken gaan rond');
Bm.p.stuur({ t: 'zeg', n: 3 });
const z = await A.p.soort('zeg'); goed(z.wie === Bm.w.jij && z.n === 3, 'een zinnetje komt aan als nummer');
Bm.p.stuur({ t: 'zeg', n: 4 }); await wacht(300);
goed(A.p.berichten.filter(m => m.t === 'zeg').length === 1, 'nog een zinnetje binnen 2 seconden wordt niet doorgestuurd');
Bm.p.stuur({ t: 'zeg', n: 999 }); Bm.p.stuur({ t: 'zeg', n: 'Hallo allemaal' }); await wacht(2300); Bm.p.stuur({ t: 'zeg', n: 'vrije tekst' }); await wacht(300);
goed(A.p.berichten.filter(m => m.t === 'zeg').length === 1, 'geen vrije tekst en geen onbekende zinnetjes');

console.log('--- samen bouwen');
const x = Math.floor(st[0]), y = Math.floor(st[1]) - 1, zz = Math.floor(st[2]);
let r = await doe(A.p, { t: 'breek', x, y, z: zz, met: 0, gevolg: [['l', x + 0.5, y + 0.4, zz + 0.5, I.aarde !== undefined ? I.aarde : B.aarde, 1, 0], ['b', x, y, zz, 0]] });
goed(r.t === 'ja' && r.a[3] === 0, 'een blok breken wordt goedgekeurd');
const bl = await Bm.p.soort('blokken'); goed(bl.a.join() === [x, y, zz, 0].join() && bl.s === 'breek' && bl.v > 0, 'de ander krijgt de verandering (met wat er stond, voor de brokjes)');
const l1 = await Bm.p.soort('los'); goed(l1.l.length === 1 && l1.l[0][0] > 0, 'wat eruit valt krijgt een nummer van de server');
Bm.p.stuur({ t: 'raap', id: l1.l[0][0] }); A.p.stuur({ t: 'raap', id: l1.l[0][0] });
const op1 = await A.p.op(m => m.t === 'opgeraapt' && m.id === l1.l[0][0] && m.wie === Bm.w.jij);
const op2 = await A.p.op(m => m.t === 'opgeraapt' && m.id === l1.l[0][0] && m.wie === -1);
goed(op1 && op2, 'twee spelers tegelijk: maar één krijgt het (geen verdubbelen)');
r = await doe(A.p, { t: 'breek', x, y: y - 3, z: zz, met: 0, gevolg: [['b', x, y - 3, zz, 0]] });
r = await doe(A.p, { t: 'breek', x, y: y - 4, z: zz, met: 0, gevolg: [['b', x, y - 4, zz, 0]] });
goed(r.t === 'nee' && r.reden === 'te-snel' && r.a[3] > 0, 'steen met je hand, snel achter elkaar: te snel, en je krijgt het echte blok terug');
r = await doe(A.p, { t: 'plaats', x: x + 30, y, z: zz, gevolg: [['b', x + 30, y + 1, zz, B.steen]] });
goed(r.t === 'nee' && r.reden === 'bereik', 'ver weg bouwen mag niet');
r = await doe(A.p, { t: 'breek', x, y: 0, z: zz, gevolg: [['b', x, 0, zz, 0]] });
goed(r.t === 'nee', 'de bodem (hoogte 0) kun je niet veranderen');
r = await doe(A.p, { t: 'plaats', x, y: y + 1, z: zz, gevolg: [['b', x + 1, y + 1, zz, 250]] });
goed(r.t === 'nee' && r.reden === 'vorm', 'een blok dat niet bestaat mag niet');
// in een andere speler bouwen
plek(Bm.p, x + 2.5, st[1], zz + 0.5); await wacht(200);
r = await doe(A.p, { t: 'plaats', x: x + 2, y: Math.floor(st[1]), z: zz, gevolg: [['b', x + 2, Math.floor(st[1]), zz, B.steen]] });
goed(r.t === 'nee' && r.reden === 'speler', 'geen vast blok in een andere speler');
r = await doe(A.p, { t: 'plaats', x: x + 3, y: Math.floor(st[1]), z: zz + 2, gevolg: [['b', x + 3, Math.floor(st[1]), zz + 2, B.planken_eik || B.steen]] });
goed(r.t === 'ja', 'naast hem bouwen mag wel');
await Bm.p.op(m => m.t === 'blokken' && m.a[0] === x + 3);
// spullen die je gooit
r = await doe(A.p, { t: 'los', gevolg: [['l', st[0], st[1] + 1.3, st[2] + 0.4, I.stok, 3, 0]] });
goed(r.t === 'ja' && (await Bm.p.op(m => m.t === 'los' && m.l.some(q => q[4] === I.stok))), 'iets weggooien: iedereen ziet het');
r = await doe(A.p, { t: 'los', gevolg: [['l', st[0] + 40, st[1], st[2], I.stok, 3, 0]] });
goed(r.t === 'nee' && r.reden === 'los', 'iets ver weg laten vallen mag niet');
r = await doe(A.p, { t: 'los', gevolg: [['l', st[0], st[1] + 1, st[2], I.stok, 500, 0]] });
goed(r.t === 'nee', 'meer dan een stapel mag niet');

console.log('--- water en groei op de server');
// een bron in een gat: het water stroomt (de server rekent, iedereen krijgt het)
const wy = Math.floor(st[1]);
r = await doe(A.p, { t: 'gebruik', x: x + 1, y: wy, z: zz + 1, gevolg: [['b', x + 1, wy, zz + 1, G.W]] });
const stroom = await Bm.p.op(m => m.t === 'blokken' && !m.wie && m.a.some((v, i) => i % 4 === 3 && (v & 255) === G.W), 8000).catch(() => null);
goed(r.t === 'ja' && !!stroom, 'water dat je neerzet, stroomt op de server, en de anderen zien het');

console.log('--- kisten en ovens');
const ky = Math.floor(st[1]);
r = await doe(A.p, { t: 'plaats', x: x - 2, y: ky, z: zz, gevolg: [['b', x - 2, ky, zz, B.kist]] });
goed(r.t === 'ja', 'een kist neerzetten');
A.p.stuur({ t: 'open', x: x - 2, y: ky, z: zz });
let o = await A.p.soort('open'); goed(o.ok && o.d && o.d.soort === 'kist', 'een kist openen');
Bm.p.stuur({ t: 'open', x: x - 2, y: ky, z: zz });
o = await Bm.p.soort('open'); goed(!o.ok && o.reden === 'bezet', 'een tweede speler kan er niet tegelijk in');
r = await doe(A.p, { t: 'kist', x: x - 2, y: ky, z: zz, gevolg: [['k', x - 2, ky, zz, 0, { id: I.stok, n: 5 }]] });
goed(r.t === 'ja', 'iets in de kist leggen');
r = await doe(Bm.p, { t: 'kist', x: x - 2, y: ky, z: zz, gevolg: [['k', x - 2, ky, zz, 0, null]] });
goed(r.t === 'nee' && r.reden === 'kist', 'wie de kist niet open heeft, kan er niets uit halen');
A.p.stuur({ t: 'dicht' }); await wacht(100);
Bm.p.stuur({ t: 'open', x: x - 2, y: ky, z: zz });
o = await Bm.p.op(m => m.t === 'open' && m.ok); goed(o.d.inhoud[0] && o.d.inhoud[0].n === 5, 'na het sluiten kan de ander erin, en ziet wat erin ligt');
Bm.p.stuur({ t: 'dicht' }); await wacht(100);
// kist kapot: de inhoud van de server valt eruit (niet wat de pagina dacht)
const losVoor = A.p.berichten.length;
await wacht(2500); // een kist hakken met je hand duurt even
r = await doe(A.p, { t: 'breek', x: x - 2, y: ky, z: zz, met: 0, gevolg: [['b', x - 2, ky, zz, 0], ['w', x - 2, ky, zz]] });
const uit = await A.p.op(m => m.t === 'los' && m.l.some(q => q[4] === I.stok && q[5] === 5), 4000, losVoor).catch(() => null);
goed(r.t === 'ja' && !!uit, 'een kist breken: wat de server erin had, valt eruit');
// oven: kolen en ijzererts, de server bakt (ook als niemand kijkt)
r = await doe(A.p, { t: 'plaats', x: x - 2, y: ky, z: zz + 1, gevolg: [['b', x - 2, ky, zz + 1, B.oven]] });
A.p.stuur({ t: 'open', x: x - 2, y: ky, z: zz + 1 }); o = await A.p.op(m => m.t === 'open' && m.ok);
const erts = I.ruw_ijzer !== undefined ? I.ruw_ijzer : (G.OVEN.find(q => q.uit === I.ijzerstaaf) || G.OVEN[0]).in;
r = await doe(A.p, { t: 'oven', x: x - 2, y: ky, z: zz + 1, gevolg: [['k', x - 2, ky, zz + 1, 'in', { id: erts, n: 1 }], ['k', x - 2, ky, zz + 1, 'brand', { id: I.kolen, n: 1 }]] });
const aan = await Bm.p.op(m => m.t === 'blokken' && m.a[0] === x - 2 && (m.a[3] & 255) === B.oven_aan, 3000).catch(() => null);
goed(r.t === 'ja' && !!aan, 'de oven gaat aan op de server, en de ander ziet hem gloeien');
const klaarO = await A.p.op(m => m.t === 'ding' && m.d.uit, 12000).catch(() => null);
goed(!!klaarO && klaarO.d.uit.n === 1, 'na 8 seconden is het klaar (wie de oven open heeft, ziet het)');
A.p.stuur({ t: 'dicht' });
// oude kist: de server vult hem, vast per plek
const bk = [x - 3, ky, zz + 3];
r = await doe(A.p, { t: 'plaats', x: bk[0], y: bk[1], z: bk[2], gevolg: [['b', ...bk, B.buitkist]] });
r = await doe(A.p, { t: 'gebruik', x: bk[0], y: bk[1], z: bk[2], gevolg: [['v', ...bk, B.buitkist], ['b', ...bk, B.kist]] });
A.p.stuur({ t: 'open', x: bk[0], y: bk[1], z: bk[2] }); o = await A.p.op(m => m.t === 'open' && m.x === bk[0] && m.z === bk[2]);
const verwacht = G.SPULLEN.buitInhoud(bk[0], bk[1], bk[2], B.buitkist, 4242);
goed(o.ok && JSON.stringify(o.d.inhoud) === JSON.stringify(verwacht), 'een oude kist: de server vult hem, precies zoals bij alleen spelen');
A.p.stuur({ t: 'dicht' });

console.log('--- bewegen');
const pv = await A.p.op(m => m.t === 'spelers'); void pv;
plek(Bm.p, x + 2.5, st[1], zz + 0.5); await wacht(150);
plek(Bm.p, x + 2.5 + 60, st[1], zz + 0.5);
const terug = await Bm.p.soort('plek', 3000).catch(() => null);
goed(!!terug && Math.abs(terug.x - x - 2.5) < 0.01 && terug.k === 1, 'te snel bewegen: de server zet je terug');
plek(Bm.p, x + 2.5 + 30, st[1], zz + 0.5, { k: 0 }); await wacht(200);
goed(Bm.p.berichten.filter(m => m.t === 'plek').length === 1, 'berichten van voor het terugzetten tellen niet');
plek(Bm.p, x + 3, st[1], zz + 0.5, { k: 1 }); await wacht(200);
goed(Bm.p.berichten.filter(m => m.t === 'plek').length === 1, 'daarna gewoon verder lopen');
// door een muur: een muur van steen neerzetten en erdoorheen springen
const my = Math.floor(st[1]);
const muur = [];
for (let dy = 0; dy < 3; dy++) for (let dz = -1; dz <= 1; dz++) muur.push((await doe(A.p, { t: 'plaats', x: x + 4, y: my + dy, z: zz + dz, gevolg: [['b', x + 4, my + dy, zz + dz, B.steen]] })).t);
if (process.env.RB_DEBUG) console.log('muur', muur.join(','), JSON.stringify(Bm.p.berichten.filter(m => m.t === 'plek')));
await wacht(200);
const vorig = Bm.p.berichten.filter(m => m.t === 'plek').length;
plek(Bm.p, x + 5.5, st[1], zz + 0.5, { k: 1 });
const dm = await Bm.p.op(m => m.t === 'plek' && m.k === 2, 3000).catch(() => null);
goed(!!dm && Bm.p.berichten.filter(m => m.t === 'plek').length === vorig + 1, 'door een muur lopen: de server zet je terug');

// na flauwvallen spring je naar je startplek (dat mag), maar niet zomaar ergens heen
plek(Bm.p, st[0] + 0.3, st[1], st[2] + 0.3, { f: 16, k: 2 }); await wacht(250);
goed(Bm.p.berichten.filter(m => m.t === 'plek').length === vorig + 1, 'na flauwvallen naar je startplek springen mag');
plek(Bm.p, st[0] + 200, st[1], st[2], { f: 16, k: 2 });
goed(!!(await Bm.p.op(m => m.t === 'plek' && m.k === 3, 3000).catch(() => null)), 'maar niet naar een plek ver weg');
plek(Bm.p, st[0] + 0.3, st[1], st[2] + 0.3, { k: 3 }); await wacht(150);

console.log('--- rommel: kapotte en vreemde berichten');
const vreemd = [null, 1, 'x', [], {}, { t: 5 }, { t: 'p' }, { t: 'p', x: 'a', y: null, z: {} }, { t: 'p', x: 1e300, y: -1e300, z: NaN }, { t: 'actie' }, { t: 'actie', a: 7 }, { t: 'actie', a: { t: 'breek', gevolg: 'b' } },
  { t: 'actie', a: { t: 'breek', gevolg: [['b', 'x', 1, 2, 3]] } }, { t: 'actie', a: { t: 'breek', gevolg: [['b', 1.5, 60, 2, 1]] } }, { t: 'actie', a: { t: 'kist', gevolg: [['k', 1, 2, 3, '__proto__', { id: 1, n: 1 }]] } },
  { t: 'actie', a: { t: 'los', gevolg: [['l', 0, 0, 0, -1, 1, 0]] } }, { t: 'actie', a: { t: 'plaats', gevolg: new Array(500).fill(['b', 0, 60, 0, 1]) } }, { t: 'open', x: 'a' }, { t: 'open', x: 1e9, y: 1, z: 1 },
  { t: 'raap', id: 'x' }, { t: 'raap', id: -5 }, { t: 'zeg', n: -1 }, { t: 'zeg', n: 1.5 }, { t: 'meld', wie: 'x' }, { t: 'meld', wie: 999999 }, { t: 'beheer', doe: 'verwijder' }, { t: 'beheer', doe: { x: 1 } },
  { t: 'bewaar', d: [1, 2] }, { t: 'bewaar', d: 'x'.repeat(100) }, { t: 'slaap', x: 1 }, { t: 'hallo', v: 1 }, { t: 'onbekend' }, { t: '__proto__' }, { t: 'constructor' }];
for (const m of vreemd) Bm.p.ws.send(JSON.stringify(m));
Bm.p.ws.send('{kapot'); Bm.p.ws.send(Buffer.from([1, 2, 3]));
await wacht(500);
Bm.p.stuur({ t: 'zeg', n: 5 });
goed(!!(await A.p.op(m => m.t === 'zeg' && m.n === 5, 4000).catch(() => null)), 'na een hoop rommel werkt alles gewoon nog (de wereld is niet gecrasht)');

console.log('--- de eigenaar');
A.p.stuur({ t: 'beheer', doe: 'bouwen', wie: 'eigenaar' });
await Bm.p.op(m => m.t === 'regels' && m.bouwen === 'eigenaar' && !m.mag);
r = await doe(Bm.p, { t: 'plaats', x: x + 2, y: my, z: zz - 2, gevolg: [['b', x + 2, my, zz - 2, B.steen]] });
goed(r.t === 'nee' && r.reden === 'mag-niet', 'alleen de eigenaar mag bouwen: de ander niet meer');
A.p.stuur({ t: 'beheer', doe: 'bouwen', wie: 'iedereen' }); await Bm.p.op(m => m.t === 'regels' && m.mag);
A.p.stuur({ t: 'beheer', doe: 'code' });
const nc = await A.p.op(m => m.t === 'beheer' && m.doe === 'code');
goed(!!nc.code && nc.code !== A.code, 'een nieuwe code maken');
let D = await doeMee(S.url, A.code); goed(D.w.t === 'nee' && D.w.reden === 'code', 'de oude code werkt niet meer');
D = await doeMee(S.url, nc.code); goed(D.w.t === 'welkom', 'de nieuwe wel');
A.p.stuur({ t: 'beheer', doe: 'weg-sturen', wie: D.w.jij });
goed((await D.p.soort('nee')).reden === 'weggestuurd', 'iemand eruit zetten');
D = await doeMee(S.url, nc.code, { geheim: D.p.geheim }); goed(D.w.t === 'welkom', 'eruit gezet: terugkomen mag wel');
A.p.stuur({ t: 'beheer', doe: 'weren', wie: D.w.jij }); await D.p.gesloten;
D = await doeMee(S.url, nc.code, { geheim: D.p.geheim }); goed(D.w.t === 'nee' && D.w.reden === 'geweerd', 'iemand weren: die komt er niet meer in');
Bm.p.stuur({ t: 'beheer', doe: 'code' }); await wacht(300);
goed(!Bm.p.berichten.some(m => m.t === 'beheer'), 'wie geen eigenaar is, kan niets beheren');
Bm.p.stuur({ t: 'meld', wie: A.w.jij });
goed(!!(await Bm.p.soort('gemeld')), 'iemand melden');
const ml = await (await fetch(S.http + '/beheer/meldingen', { headers: { Authorization: 'Bearer een-lang-testwachtwoord' } })).json();
goed(ml.meldingen.length === 1 && ml.meldingen[0].naam.length === 2, 'Ruben ziet de melding (met het beheerwachtwoord)');
goed((await fetch(S.http + '/beheer/meldingen')).status === 401 && (await fetch(S.http + '/beheer/meldingen', { headers: { Authorization: 'Bearer fout' } })).status === 401, 'zonder het goede wachtwoord niet');
// eigenaar op een ander apparaat (met de sleutel uit rommelblok-v3)
const E = await doeMee(S.url, nc.code, { hallo: { sleutel: A.sleutel } });
goed(E.w.eigenaar === true, 'met de sleutel ben je ook op een ander apparaat eigenaar');
await E.p.sluit();
A.p.stuur({ t: 'beheer', doe: 'dicht', aan: true });
goed((await Bm.p.op(m => m.t === 'nee' && m.nr === undefined)).reden === 'dicht', 'de wereld sluiten: de anderen moeten eruit');
D = await doeMee(S.url, nc.code); goed(D.w.t === 'nee' && D.w.reden === 'dicht', 'en er kan niemand meer bij');
A.p.stuur({ t: 'beheer', doe: 'dicht', aan: false });
await A.p.op(m => m.t === 'regels' && !m.dicht);

console.log('--- grenzen');
const nep = speler(S.url, { herkomst: 'https://slechte-site.example' });
goed(await nep.open.then(() => false, e => /403/.test(e.message)), 'een andere site mag niet verbinden');
const oud = speler(S.url); await oud.open; oud.hallo({ v: 0, code: nc.code });
goed((await oud.soort('nee')).reden === 'versie', 'een oude pagina hoort: ververs de pagina');
const groot = speler(S.url); await groot.open; groot.ws.send('x'.repeat(20000));
goed((await groot.gesloten) === 1009, 'een te groot bericht: de verbinding gaat dicht');
const duw = speler(S.url); await duw.open; duw.hallo({ code: nc.code }); await duw.soort('welkom');
for (let i = 0; i < 400; i++) duw.stuur({ t: 'leven' });
goed((await duw.soort('nee', 4000)).reden === 'te-veel', 'wie blijft duwen (honderden berichten), gaat eruit');
const stil = speler(S.url); await stil.open;
goed((await stil.soort('nee', 13000)).reden === 'geen-hallo', 'wie geen hallo zegt, gaat er na 10 seconden uit');

console.log('--- grenzen per adres en per wereld (aparte servers)');
const S2 = await startServer({ MAX_PER_ADRES: '4' });
const open = []; for (let i = 0; i < 4; i++) { const q = speler(S2.url); await q.open; open.push(q); }
const vijfde = speler(S2.url); goed(await vijfde.open.then(() => false, e => /429/.test(e.message)), '4 verbindingen per adres, de vijfde niet');
await S2.server.sluit();
const S3 = await startServer({ MAX_SPELERS: '2', MAX_NIEUW_PER_DAG: '3', MAX_WERELDEN: '200', MAX_PER_ADRES: '40' });
const W1 = await maakWereld(S3.url); await maakWereld(S3.url); await maakWereld(S3.url);
const W4 = speler(S3.url); await W4.open; W4.hallo({ maak: { zaad: 1, stand: 'bouwen', moeilijk: 'vredig' } });
goed((await W4.soort('nee')).reden === 'te-veel-werelden', '3 nieuwe werelden per adres per dag');
const P2 = await doeMee(S3.url, W1.code); const P3 = await doeMee(S3.url, W1.code);
goed(P2.w.t === 'welkom' && P3.w.t === 'nee' && P3.w.reden === 'vol', 'een wereld is vol bij het maximum aantal spelers');
const fc = [];
for (let i = 0; i < 9; i++) { const q = await doeMee(S3.url, 'rode-boot-trein-' + (10 + i)); fc.push(q.w.reden); }
goed(fc.slice(0, 8).every(x2 => x2 === 'code') && fc[8] === 'te-veel-codes', 'na 8 foute codes even niet meer proberen');
await S3.server.sluit();
const S6 = await startServer({ MAX_VERBINDINGEN: '2', MAX_PER_ADRES: '40', MAX_FOUTE_CODES_TOTAAL: '3' });
const v1 = speler(S6.url), v2 = speler(S6.url); await v1.open; await v2.open;
const v3 = speler(S6.url); goed(await v3.open.then(() => false, e => /429/.test(e.message)), 'hooguit zoveel verbindingen in totaal');
v1.hallo({ code: 'rode-boot-trein-10' }); await v1.gesloten; v2.hallo({ code: 'rode-boot-trein-11' }); await v2.gesloten;
const f3 = await doeMee(S6.url, 'rode-boot-trein-12'), f4 = await doeMee(S6.url, 'rode-boot-trein-13');
goed(f3.w.reden === 'code' && f4.w.reden === 'druk', 'te veel foute codes van alle adressen samen: even niet');
await S6.server.sluit();
const S4 = await startServer({ MAX_WERELDEN: '2', MAX_NIEUW_PER_DAG: '9', MAX_PER_ADRES: '40' });
await maakWereld(S4.url); await maakWereld(S4.url);
const W5 = speler(S4.url); await W5.open; W5.hallo({ maak: { zaad: 1, stand: 'bouwen', moeilijk: 'vredig' } });
goed((await W5.soort('nee')).reden === 'vol-server', 'hooguit zoveel gedeelde werelden in totaal');
await S4.server.sluit();

console.log('--- slapen: alleen als iedereen slaapt');
{
  const S5 = await startServer({ LEEG_WACHT: '100', MAX_PER_ADRES: '40' });
  const E1 = await maakWereld(S5.url); const id5 = E1.w.wereld.id; await E1.p.sluit();
  await wacht(1200); // de kamer stopt en bewaart
  const { DatabaseSync } = await import('node:sqlite');
  const d = new DatabaseSync(S5.inst.dbPad); d.prepare('UPDATE werelden SET tijd = 0.9 WHERE id = ?').run(id5); d.close();
  const E2 = await doeMee(S5.url, E1.code, { geheim: E1.p.geheim }), E3 = await doeMee(S5.url, E1.code);
  goed(E2.w.wereld.tijd > 0.89, 'de tijd van de wereld wordt bewaard (het is nu nacht)');
  E2.p.stuur({ t: 'slaap' });
  const half = await E3.p.soort('slaap', 3000).catch(() => null);
  goed(!!half && half.slapen === 1 && half.van === 2, 'één van de twee slaapt: de nacht gaat nog niet voorbij');
  E3.p.stuur({ t: 'slaap' });
  const och = await E2.p.op(m => m.t === 'tijd' && m.ochtend, 3000).catch(() => null);
  goed(!!och && Math.abs(och.tijd - 0.255) < 0.01 && och.dag === 1, 'als iedereen slaapt, wordt het ochtend (een nieuwe dag)');
  const tijd = await E3.p.op(m => m.t === 'tijd' && !m.ochtend, 7000).catch(() => null);
  goed(!!tijd, 'de server laat iedereen geregeld weten hoe laat het is');
  await S5.server.sluit();
}

console.log('--- vrij typen, eigen namen en commando\'s (hoofdstuk 5: alles nagekeken door de server)');
{
  const S6 = await startServer({ MAX_NIEUW_PER_DAG: '50', MAX_PER_ADRES: '40' });
  const E = await maakWereld(S6.url, { zaad: 777 });
  const F = await doeMee(S6.url, E.code), Gs = await doeMee(S6.url, E.code);
  const namen = [E.w.naam, F.w.naam, Gs.w.naam].map(n => JSON.stringify(n));
  goed(new Set(namen).size === 3, 'drie spelers met dezelfde gekozen naam krijgen elk een andere naam (' + [E.w.naam, F.w.naam, Gs.w.naam].map(n => G.SAMEN.naamVan(n, 'nl')).join(', ') + ')');
  goed(E.w.wereld.namen === false && E.w.wereld.typen === false && E.w.wereld.commandos === false, 'eigen namen en vrij typen staan standaard uit');
  // vrij typen staat uit
  F.p.stuur({ t: 'zeg', tekst: 'hoi allemaal' });
  goed((await F.p.soort('zeg-nee')).reden === 'uit', 'vrij typen staat uit: de server weigert een eigen tekst');
  await wacht(2100);
  // alleen de eigenaar kan het aanzetten
  F.p.stuur({ t: 'beheer', doe: 'typen', aan: true }); await wacht(300);
  goed(!F.p.berichten.some(m => m.t === 'regels' && m.typen), 'een gewone speler kan vrij typen niet aanzetten');
  E.p.stuur({ t: 'beheer', doe: 'typen', aan: true });
  goed(!!(await Gs.p.op(m => m.t === 'regels' && m.typen === true)), 'de eigenaar zet vrij typen aan, en iedereen hoort het');
  F.p.stuur({ t: 'zeg', tekst: '  hoi   allemaal! ' });
  const zt = await Gs.p.op(m => m.t === 'zeg' && m.tekst);
  goed(zt.tekst === 'hoi allemaal!' && zt.wie === F.w.jij && (await F.p.soort('zeg-ja')).tekst === 'hoi allemaal!', 'een eigen tekst komt aan (netjes gemaakt), en wie hem stuurde hoort dat het goed was');
  F.p.stuur({ t: 'zeg', tekst: 'nog een' });
  goed((await F.p.op(m => m.t === 'zeg-nee' && m.reden === 'snel')).reden === 'snel', 'binnen 2 seconden nog een bericht: te snel');
  const weiger = async (tekst, reden) => { await wacht(2100); const n0 = Gs.p.berichten.filter(m => m.t === 'zeg').length; F.p.stuur({ t: 'zeg', tekst }); const r = await F.p.op(m => m.t === 'zeg-nee' && m.reden === reden, 4000).catch(() => null); await wacht(200); return !!r && Gs.p.berichten.filter(m => m.t === 'zeg').length === n0; };
  goed(await weiger('wat een k4nk3r spel', 'woord'), 'een scheldwoord (ook met cijfers) komt er niet door');
  goed(await weiger('kom naar www.mijnsite.nl', 'link'), 'een link komt er niet door');
  goed(await weiger('mail me: piet@voorbeeld.nl', 'mail'), 'een e-mailadres komt er niet door');
  goed(await weiger('bel me 06 12 34 56 78', 'telefoon'), 'een telefoonnummer komt er niet door');
  goed(await weiger('x'.repeat(81), 'lang'), 'langer dan 80 tekens komt er niet door');
  // melden: het bericht gaat mee (alleen bij een melding wordt het bewaard)
  Gs.p.stuur({ t: 'meld', wie: F.w.jij }); await Gs.p.soort('gemeld');
  const meld = S6.server.db.meldingen().find(r => r.wereld === E.w.wereld.id);
  goed(!!meld && meld.wat.zinnen.includes('hoi allemaal!'), 'bij een melding gaat het bericht mee');
  // eigen namen
  F.p.stuur({ t: 'naam', tekst: 'Kees' });
  goed((await F.p.soort('naam-nee')).reden === 'uit', 'eigen namen staan uit: de server weigert een eigen naam');
  E.p.stuur({ t: 'beheer', doe: 'namen', aan: true }); await F.p.op(m => m.t === 'regels' && m.namen === true);
  await wacht(2100); F.p.stuur({ t: 'naam', tekst: 'Kees' });
  const nj = await F.p.soort('naam-ja'), nb = await Gs.p.op(m => m.t === 'naam' && m.wie === F.w.jij);
  goed(nj.naam === 'Kees' && nb.naam === 'Kees', 'de eigenaar zet eigen namen aan: een speler heet nu Kees, en de anderen zien dat');
  Gs.p.stuur({ t: 'naam', tekst: ' kees ' });
  goed((await Gs.p.soort('naam-nee')).reden === 'bezet', 'dezelfde naam (met andere hoofdletters en spaties) is bezet');
  await wacht(2100); Gs.p.stuur({ t: 'naam', tekst: 'KankerKees' });
  goed((await Gs.p.op(m => m.t === 'naam-nee' && m.reden === 'woord')).reden === 'woord', 'een naam gaat door hetzelfde filter');
  await wacht(2100); Gs.p.stuur({ t: 'naam', tekst: '0612345678' });
  goed(!!(await Gs.p.op(m => m.t === 'naam-nee' && m.reden === 'tekens')), 'een telefoonnummer als naam mag niet');
  // terugkomen: de eigen naam blijft van jou, ook als je weg was
  await F.p.sluit(); await wacht(300);
  await wacht(2100); Gs.p.stuur({ t: 'naam', tekst: 'Kees' });
  goed((await Gs.p.op(m => m.t === 'naam-nee' && m.reden === 'bezet')).reden === 'bezet', 'als Kees weg is, is de naam nog steeds van hem');
  const F2 = await doeMee(S6.url, E.code, { geheim: F.p.geheim });
  goed(F2.w.naam === 'Kees', 'Kees komt terug en heet weer Kees');
  // de eigenaar zet eigen namen weer uit: iedereen weer twee woorden
  E.p.stuur({ t: 'beheer', doe: 'namen', aan: false });
  const terug = await F2.p.op(m => m.t === 'naam-ja');
  goed(Array.isArray(terug.naam), 'eigen namen weer uit: Kees heet weer zoals eerst (twee woorden)');
  // (Kees kwam terug met dezelfde twee woorden als de eigenaar: die waren bezet, dus kreeg hij toen al andere)
  const nuNamen = [E.w.naam, Gs.w.naam, terug.naam].map(n => JSON.stringify(n));
  goed(new Set(nuNamen).size === 3, 'en niemand heeft dan dezelfde naam (' + [E.w.naam, Gs.w.naam, terug.naam].map(n => G.SAMEN.naamVan(n, 'nl')).join(', ') + ')');
  // commando's
  F2.p.stuur({ t: 'cmd', wat: 'tijd', tijd: 0.75 });
  goed((await F2.p.op(m => m.t === 'cmd')).reden === 'eigenaar', 'een gewone speler mag geen commando geven');
  E.p.stuur({ t: 'cmd', wat: 'tijd', tijd: 0.75 });
  const tj = await F2.p.op(m => m.t === 'tijd' && Math.abs(m.tijd - 0.75) < 0.01);
  const cr = await F2.p.op(m => m.t === 'regels' && m.commandos === true);
  goed(!!tj && !!cr, 'de eigenaar zet de tijd op 18 uur: iedereen ziet het, en de wereld telt niet meer voor het logboek');
  E.p.stuur({ t: 'cmd', wat: 'weer', regen: true });
  goed((await F2.p.op(m => m.t === 'weer')).regen === true, 'het weer: regen voor iedereen');
  E.p.stuur({ t: 'cmd', wat: 'stand', stand: 'bouwen' });
  goed((await F2.p.op(m => m.t === 'stand')).stand === 'bouwen', 'de stand: bouwen voor iedereen');
  plek(F2.p, F2.w.start[0] + 3, F2.w.start[1], F2.w.start[2] + 3); await wacht(300);
  E.p.stuur({ t: 'cmd', wat: 'ga', wie: F2.w.jij });
  const ga = await E.p.op(m => m.t === 'plek' && m.ga);
  goed(Math.abs(ga.x - F2.w.start[0] - 3) < 0.5, 'de eigenaar gaat naar een andere speler');
  E.p.stuur({ t: 'cmd', wat: 'geef', id: I.stok, n: 5, wie: F2.w.jij });
  const kr = await F2.p.op(m => m.t === 'krijg');
  goed(kr.id === I.stok && kr.n === 5, 'de eigenaar geeft een andere speler 5 stokken');
  E.p.stuur({ t: 'cmd', wat: 'geef', id: I.stok, n: 5000 });
  goed((await E.p.op(m => m.t === 'cmd' && !m.ok && m.reden === 'vorm')).reden === 'vorm', 'een commando dat niet klopt, doet niets');
  const welk = await doeMee(S6.url, E.code);
  goed(welk.w.wereld.commandos === true && welk.w.wereld.regen === true && welk.w.wereld.stand === 'bouwen', 'wie later binnenkomt, krijgt het weer, de stand en dat er commando\'s gebruikt zijn');
  await S6.server.sluit();
}

console.log('--- bewaren en terugkomen');
plek(A.p, st[0] + 0.5, st[1], st[2] + 0.5, { k: 0 }); await wacht(200);
A.p.stuur({ t: 'bewaar', d: { speler: { hp: 17 }, inv: [{ id: I.stok, n: 2 }] } });
await A.p.sluit(); await wacht(300);
await S.server.sluit();
const s3 = maakServer(S.inst); const ad = await s3.luister();
const A2 = await doeMee(`ws://127.0.0.1:${ad.port}/samen`, nc.code, { geheim: A.p.geheim, hallo: { sleutel: A.sleutel } });
goed(A2.w.t === 'welkom' && A2.w.eigenaar && A2.w.data && A2.w.data.speler.hp === 17 && A2.w.data.inv[0].n === 2, 'na een herstart: je rugzak en je levens zijn er nog');
goed(Math.abs(A2.w.plek[0] - st[0] - 0.5) < 0.02, 'en je staat waar je was');
const stuk = await A2.p.soort('stuk', 15000);
const alle = stuk.l.flatMap(q => { const o2 = []; for (let i = 0; i < q[2].length; i += 2) o2.push([q[0] * 16 + (q[2][i] & 15), q[2][i] >> 8, q[1] * 16 + ((q[2][i] >> 4) & 15), q[2][i + 1]]); return o2; });
goed(alle.some(q => q[0] === x && q[1] === y && q[2] === zz && (q[3] === 0 || (q[3] & 255) === G.W)) && alle.some(q => q[0] === x + 4 && (q[3] & 255) === B.steen), 'en de wereld is zoals jullie hem achterlieten');
// de wereld verwijderen
A2.p.stuur({ t: 'beheer', doe: 'verwijder' });
goed((await A2.p.soort('nee')).reden === 'verwijderd', 'de eigenaar verwijdert de wereld');
await wacht(500);
D = await doeMee(`ws://127.0.0.1:${ad.port}/samen`, nc.code); goed(D.w.t === 'nee' && D.w.reden === 'code', 'daarna bestaat hij niet meer');
await s3.sluit();

console.log(`servertests: ${fout() ? fout() + ' FOUT' : 'alles goed'} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fout() ? 1 : 0);
void WebSocket;
