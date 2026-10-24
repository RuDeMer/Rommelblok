// ============================================================================
// Rommelblok: geluid. Alles zelf gemaakt met de Web Audio API: geen bestanden, geen samples.
// RB_GELUID({ ctx }) geeft de geluidsfuncties; zonder Web Audio doen ze stil niets.
// ============================================================================
export function RB_GELUID(opt) {
  'use strict';
  opt = opt || {};
  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  const OFF = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : null;
  let ctx = null, offline = false, aanS = true, vol = 0.7, muziekAan = false;
  let bus = null, demp = null, hoofd = null, galmIn = null, wit = null, bruin = null;
  let stemmen = 0;
  const MAX = 24;
  const r = (a, b) => a + Math.random() * (b - a);
  const kies = l => l[Math.floor(Math.random() * l.length)];

  // ---------------- de keten: alles -> bus -> demper (onder water) -> hoofdvolume -> compressor -> zachte begrenzer -> uit
  function bouw() {
    const c = ctx;
    bus = c.createGain();
    demp = c.createBiquadFilter(); demp.type = 'lowpass'; demp.frequency.value = 20000; demp.Q.value = 0.5;
    hoofd = c.createGain(); hoofd.gain.value = aanS ? vol : 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25;
    const grens = c.createWaveShaper(), curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = 0.94 * Math.tanh(x * 1.1) / Math.tanh(1.1); }
    grens.curve = curve;
    bus.connect(demp); demp.connect(hoofd); hoofd.connect(comp); comp.connect(grens); grens.connect(c.destination);
    // galm: zelfgemaakte impulsrespons (ruis die uitsterft, steeds zachter en doffer)
    const sr = c.sampleRate, n = Math.floor(sr * 1.7), ir = c.createBuffer(2, n, sr);
    for (let k = 0; k < 2; k++) { const d = ir.getChannelData(k); let lp = 0; for (let i = 0; i < n; i++) { const t = i / n; lp += (Math.random() * 2 - 1 - lp) * (0.5 - 0.42 * t); d[i] = lp * Math.pow(1 - t, 2.6) * 0.6; } }
    const conv = c.createConvolver(); conv.buffer = ir;
    galmIn = c.createGain(); galmIn.gain.value = 0.5;
    galmIn.connect(conv); conv.connect(bus);
    // ruis: één keer gemaakt, wit en bruin (dof)
    const m = sr * 2;
    wit = c.createBuffer(1, m, sr); bruin = c.createBuffer(1, m, sr);
    const w = wit.getChannelData(0), b = bruin.getChannelData(0); let last = 0;
    for (let i = 0; i < m; i++) { w[i] = Math.random() * 2 - 1; last = (last + 0.02 * w[i]) / 1.02; b[i] = last * 3.5; }
  }
  if (opt.ctx) { ctx = opt.ctx; offline = !!(OFF && ctx instanceof OFF); try { bouw(); } catch (e) { ctx = null; } }
  const klaar = () => !!(ctx && bus && aanS && ctx.state !== 'closed' && (offline || ctx.state === 'running'));

  // ---------------- één klinkende gebeurtenis; alles wordt opgeruimd zodra het laatste stukje klaar is
  function klank(fn, o) {
    if (!klaar() || stemmen >= (o && o.laag ? MAX - 8 : MAX)) return;
    stemmen++;
    const nodes = [], bronnen = [];
    const uit = ctx.createGain(); nodes.push(uit);
    let naar = bus;
    if (o && o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); p.connect(bus); nodes.push(p); naar = p; }
    uit.connect(naar);
    if (o && o.galm) { const s = ctx.createGain(); s.gain.value = o.galm; uit.connect(s); s.connect(galmIn); nodes.push(s); }
    const v = { t: ctx.currentTime + 0.005, uit, knoop: n => (nodes.push(n), n), bron: (n, a, b, ofs) => { bronnen.push(n); nodes.push(n); if (ofs != null) n.start(a, ofs); else n.start(a); n.stop(b); return n; } };
    try { fn(v); } catch (e) { /* geluid mag nooit het spel storen */ }
    let open = bronnen.length;
    const weg = () => { stemmen--; for (const n of nodes) { try { n.disconnect(); } catch (e) {} } };
    if (!open) { weg(); return; }
    for (const b of bronnen) b.onended = () => { if (--open === 0) weg(); };
  }
  // omhullende: snel aan, dan uitsterven
  function omhul(v, g, s, aanval, piek, verval) {
    g.gain.setValueAtTime(0.0001, s);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, piek), s + aanval);
    g.gain.exponentialRampToValueAtTime(0.0001, s + aanval + verval);
    return s + aanval + verval + 0.03;
  }
  // stootje ruis door een filter
  function ruis(v, o) {
    const s = v.t + (o.na || 0), src = v.knoop(ctx.createBufferSource());
    src.buffer = o.bruin ? bruin : wit; src.playbackRate.value = o.snel || 1;
    const f = v.knoop(ctx.createBiquadFilter()); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1000, s); f.Q.value = o.Q || 0.8;
    if (o.freqEind) f.frequency.exponentialRampToValueAtTime(o.freqEind, s + (o.aanval || 0.005) + (o.verval || 0.1));
    const g = v.knoop(ctx.createGain());
    src.connect(f); f.connect(g); g.connect(v.uit);
    const eind = omhul(v, g, s, o.aanval || 0.004, o.piek || 0.1, o.verval || 0.08);
    v.bron(src, s, eind, Math.random() * 1.5); // elke keer een ander stukje ruis
  }
  // toontje, eventueel glijdend
  function toon(v, o) {
    const s = v.t + (o.na || 0), osc = v.knoop(ctx.createOscillator());
    osc.type = o.vorm || 'sine'; osc.frequency.setValueAtTime(o.freq, s);
    if (o.freqEind) osc.frequency.exponentialRampToValueAtTime(o.freqEind, s + (o.glij || (o.aanval || 0.005) + (o.verval || 0.1)));
    if (o.fm) { const m = v.knoop(ctx.createOscillator()), mg = v.knoop(ctx.createGain()); m.frequency.value = o.fm; mg.gain.value = o.fmDiep || 60; m.connect(mg); mg.connect(osc.frequency); v.bron(m, s, s + (o.aanval || 0.005) + (o.verval || 0.1) + 0.05); }
    const g = v.knoop(ctx.createGain());
    osc.connect(g); g.connect(v.uit);
    v.bron(osc, s, omhul(v, g, s, o.aanval || 0.004, o.piek || 0.08, o.verval || 0.1));
  }
  // meerdere korrels ruis door elkaar (knisperen, kraken, ritselen)
  function korrels(v, n, spreid, o) { for (let i = 0; i < n; i++) ruis(v, Object.assign({}, o, { na: (o.na || 0) + Math.random() * spreid, freq: o.freq * r(0.75, 1.3), piek: o.piek * r(0.6, 1) })); }
  // plopjes van belletjes in het water
  function bel(v, na, piek) { const f = r(350, 900); toon(v, { na, freq: f, freqEind: f * r(1.6, 2.4), aanval: 0.004, verval: r(0.03, 0.07), piek: piek || 0.04 }); }

  // ---------------- materialen: soort is 'stap', 'hak', 'breek' of 'plaats'
  const MAT = {
    gras(v, k, s, p) { korrels(v, k === 'breek' ? 4 : 2, 0.05, { type: 'bandpass', freq: 2800 * p, Q: 0.7, aanval: 0.01, verval: k === 'breek' ? 0.14 : 0.08, piek: 0.13 * s }); ruis(v, { type: 'highpass', freq: 5200, aanval: 0.015, verval: 0.06, piek: 0.04 * s }); },
    aarde(v, k, s, p) { ruis(v, { bruin: true, type: 'lowpass', freq: 520 * p, Q: 0.6, aanval: 0.006, verval: k === 'breek' ? 0.2 : 0.1, piek: 0.32 * s }); toon(v, { freq: 95 * p, freqEind: 60, aanval: 0.004, verval: 0.08, piek: 0.08 * s }); if (k === 'breek') korrels(v, 3, 0.12, { bruin: true, type: 'lowpass', freq: 700, aanval: 0.004, verval: 0.06, piek: 0.15 * s }); },
    steen(v, k, s, p) { ruis(v, { type: 'bandpass', freq: 1900 * p, Q: 1.6, aanval: 0.001, verval: k === 'hak' ? 0.035 : 0.05, piek: 0.6 * s }); toon(v, { vorm: 'triangle', freq: 520 * p, freqEind: 380 * p, aanval: 0.001, verval: 0.04, piek: 0.05 * s }); if (k === 'breek') korrels(v, 6, 0.2, { type: 'bandpass', freq: 2200, Q: 2, aanval: 0.001, verval: 0.04, piek: 0.14 * s }); },
    zand(v, k, s, p) { korrels(v, k === 'breek' ? 10 : 6, 0.1, { type: 'highpass', freq: 3200 * p, Q: 0.6, aanval: 0.002, verval: 0.03, piek: 0.08 * s }); ruis(v, { type: 'bandpass', freq: 4200, Q: 0.5, aanval: 0.02, verval: 0.1, piek: 0.04 * s }); },
    grind(v, k, s, p) { korrels(v, k === 'breek' ? 12 : 7, 0.12, { type: 'bandpass', freq: 1700 * p, Q: 1.6, aanval: 0.001, verval: 0.025, piek: 0.16 * s }); },
    hout(v, k, s, p) { const f = r(170, 250) * p; toon(v, { vorm: 'triangle', freq: f, freqEind: f * 0.85, aanval: 0.002, verval: 0.09, piek: 0.16 * s }); toon(v, { freq: f * 2.31, aanval: 0.001, verval: 0.05, piek: 0.06 * s }); ruis(v, { type: 'bandpass', freq: 900 * p, Q: 1.4, aanval: 0.002, verval: 0.05, piek: 0.12 * s }); if (k === 'breek') { ruis(v, { na: 0.05, type: 'bandpass', freq: 600, Q: 1, aanval: 0.003, verval: 0.18, piek: 0.12 * s }); korrels(v, 4, 0.15, { type: 'bandpass', freq: 1300, Q: 1.5, aanval: 0.002, verval: 0.04, piek: 0.08 * s }); } },
    blad(v, k, s, p) { ruis(v, { type: 'bandpass', freq: 3800 * p, Q: 0.5, aanval: 0.03, verval: k === 'breek' ? 0.22 : 0.12, piek: 0.1 * s }); korrels(v, 2, 0.08, { type: 'highpass', freq: 4500, aanval: 0.01, verval: 0.06, piek: 0.05 * s }); },
    sneeuw(v, k, s, p) { korrels(v, k === 'breek' ? 6 : 4, 0.09, { bruin: true, type: 'bandpass', freq: 950 * p, Q: 1.1, aanval: 0.006, verval: 0.04, piek: 0.2 * s }); ruis(v, { type: 'bandpass', freq: 2600, Q: 0.7, aanval: 0.02, verval: 0.07, piek: 0.03 * s }); },
    glas(v, k, s, p) {
      const n = k === 'breek' ? 7 : 2;
      for (let i = 0; i < n; i++) { const f = r(2200, 4200) * p; toon(v, { na: k === 'breek' ? Math.random() * 0.25 : i * 0.01, freq: f, aanval: 0.001, verval: k === 'breek' ? r(0.15, 0.35) : 0.14, piek: (k === 'breek' ? 0.05 : 0.04) * s }); }
      ruis(v, { type: 'highpass', freq: 3500, aanval: 0.001, verval: k === 'breek' ? 0.12 : 0.03, piek: 0.1 * s });
    },
    metaal(v, k, s, p) { const f = r(420, 560) * p; for (const [m, a] of [[1, 0.08], [2.76, 0.05], [5.4, 0.03]]) toon(v, { freq: f * m, aanval: 0.001, verval: k === 'breek' ? 0.6 : 0.3, piek: a * s }); ruis(v, { type: 'bandpass', freq: 3000, Q: 2, aanval: 0.001, verval: 0.03, piek: 0.08 * s }); },
    stof(v, k, s, p) { ruis(v, { bruin: true, type: 'lowpass', freq: 750 * p, Q: 0.5, aanval: 0.01, verval: k === 'breek' ? 0.16 : 0.08, piek: 0.26 * s }); },
    water(v, k, s, p) { ruis(v, { type: 'lowpass', freq: 1200 * p, aanval: 0.02, verval: 0.15, piek: 0.06 * s }); for (let i = 0; i < 3; i++) bel(v, Math.random() * 0.12, 0.04 * s); },
    modder(v, k, s, p) { ruis(v, { bruin: true, type: 'lowpass', freq: 420 * p, aanval: 0.01, verval: 0.12, piek: 0.55 * s }); toon(v, { freq: 210 * p, freqEind: 75, aanval: 0.01, verval: 0.1, piek: 0.06 * s }); ruis(v, { type: 'bandpass', freq: 1100, Q: 3, aanval: 0.02, verval: 0.05, piek: 0.03 * s }); },
  };
  // ---------------- voetstappen: kort en zacht, per ondergrond. Elke stap is net iets anders (toonhoogte, korrels),
  // en de linker- en rechtervoet klinken een haartje verschillend, iets links en iets rechts. Metaal is een doffe tik, nooit schel.
  let voet = 0;
  const hiel = (v, s, p, freq, piek) => ruis(v, { bruin: true, type: 'lowpass', freq: freq * p, Q: 0.7, aanval: 0.004, verval: 0.06, piek: piek * s });
  const STAP = {
    steen(v, s, p) { hiel(v, s, p, 360, 0.22); ruis(v, { na: 0.008, type: 'bandpass', freq: 1250 * p, Q: 1.1, aanval: 0.002, verval: 0.035, piek: 0.09 * s }); ruis(v, { na: 0.03, type: 'bandpass', freq: 2300 * p, Q: 0.9, aanval: 0.01, verval: 0.03, piek: 0.022 * s }); },
    hout(v, s, p) { const f = r(150, 185) * p; toon(v, { vorm: 'triangle', freq: f, freqEind: f * 0.8, aanval: 0.003, verval: 0.075, piek: 0.11 * s }); hiel(v, s, p, 420, 0.13); ruis(v, { type: 'bandpass', freq: 650 * p, Q: 1.2, aanval: 0.002, verval: 0.04, piek: 0.06 * s }); },
    gras(v, s, p) { hiel(v, s, p, 280, 0.16); korrels(v, 3, 0.06, { type: 'bandpass', freq: 2300 * p, Q: 0.8, aanval: 0.008, verval: 0.05, piek: 0.045 * s }); },
    aarde(v, s, p) { hiel(v, s, p, 260, 0.26); ruis(v, { na: 0.01, bruin: true, type: 'bandpass', freq: 700 * p, Q: 0.8, aanval: 0.005, verval: 0.05, piek: 0.07 * s }); },
    zand(v, s, p) { hiel(v, s, p, 300, 0.12); korrels(v, 6, 0.07, { type: 'bandpass', freq: 2900 * p, Q: 0.7, aanval: 0.004, verval: 0.03, piek: 0.035 * s }); },
    grind(v, s, p) { hiel(v, s, p, 300, 0.14); korrels(v, 7, 0.08, { type: 'bandpass', freq: 1500 * p, Q: 1.4, aanval: 0.001, verval: 0.025, piek: 0.08 * s }); },
    sneeuw(v, s, p) { korrels(v, 5, 0.1, { bruin: true, type: 'bandpass', freq: 850 * p, Q: 1, aanval: 0.006, verval: 0.04, piek: 0.14 * s }); hiel(v, s, p, 240, 0.1); },
    glas(v, s, p) { hiel(v, s, p, 380, 0.16); toon(v, { na: 0.004, freq: r(1500, 1750) * p, aanval: 0.001, verval: 0.035, piek: 0.016 * s }); ruis(v, { type: 'bandpass', freq: 2600, Q: 1.5, aanval: 0.001, verval: 0.02, piek: 0.03 * s }); },
    metaal(v, s, p) { hiel(v, s, p, 340, 0.16); const f = r(230, 270) * p; toon(v, { vorm: 'triangle', freq: f, freqEind: f * 0.97, aanval: 0.002, verval: 0.11, piek: 0.045 * s }); toon(v, { freq: f * 2.02, aanval: 0.002, verval: 0.06, piek: 0.016 * s }); ruis(v, { type: 'bandpass', freq: 900 * p, Q: 3, aanval: 0.002, verval: 0.05, piek: 0.05 * s }); },
    blad(v, s, p) { korrels(v, 3, 0.08, { type: 'bandpass', freq: 3000 * p, Q: 0.6, aanval: 0.01, verval: 0.06, piek: 0.05 * s }); hiel(v, s, p, 300, 0.08); },
    stof(v, s, p) { hiel(v, s, p, 240, 0.2); ruis(v, { type: 'bandpass', freq: 1500 * p, Q: 0.6, aanval: 0.01, verval: 0.04, piek: 0.02 * s }); },
    water(v, s, p) { ruis(v, { type: 'lowpass', freq: 1100 * p, freqEind: 500, aanval: 0.01, verval: 0.12, piek: 0.09 * s }); hiel(v, s, p, 260, 0.08); bel(v, r(0.01, 0.06), 0.02 * s); },
    modder(v, s, p) { ruis(v, { bruin: true, type: 'lowpass', freq: 380 * p, aanval: 0.012, verval: 0.1, piek: 0.32 * s }); toon(v, { freq: 170 * p, freqEind: 90, aanval: 0.01, verval: 0.08, piek: 0.035 * s }); },
  };
  function stap(m, s, ren) {
    const f = STAP[m] || STAP.steen; voet ^= 1;
    const p = r(0.93, 1.07) * (voet ? 1.03 : 0.97) * (ren ? 1.04 : 1);
    klank(v => f(v, s * 2.4, p), { laag: true, pan: voet ? 0.08 : -0.08 });
  }
  function mat(m, soort, sterkte, extra) {
    const f = MAT[m] || MAT.steen;
    const s = sterkte == null ? 1 : sterkte, p = r(0.88, 1.13) * (soort === 'hak' ? 1.08 : soort === 'plaats' ? 0.86 : 1);
    klank(v => {
      f(v, soort, s, p);
      if (soort === 'plaats') toon(v, { freq: 120, freqEind: 70, aanval: 0.003, verval: 0.07, piek: 0.09 * s });
      if (extra) extra(v);
    }, { laag: soort === 'stap' });
  }

  // ---------------- doorlopende sfeer: wind, water, onder water
  let sfeer = null, laatsteSfeer = -1, volgendeVogel = 0, volgendeKrekel = 0, volgendeDruppel = 0, volgendeBel = 0, volgendeMuziek = 0, volgendeTik = 0;
  function lus(buf, type, freq, Q) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(bus); s.start(ctx.currentTime, Math.random() * 1.5);
    return { s, f, g };
  }
  function startSfeer() { sfeer = { wind: lus(bruin, 'bandpass', 420, 0.8), water: lus(wit, 'lowpass', 750, 0.7), onder: lus(bruin, 'lowpass', 260, 0.6), regen: lus(wit, 'bandpass', 2600, 0.35), regenLaag: lus(bruin, 'lowpass', 900, 0.5) }; }
  const naar = (param, waarde, tijd) => { try { param.setTargetAtTime(waarde, ctx.currentTime, tijd); } catch (e) {} };
  function omgeving(o) {
    if (!klaar() || offline) return;
    o = o || {};
    const nu = ctx.currentTime;
    if (nu - laatsteSfeer < 0.1) return; // tien keer per seconde is genoeg
    laatsteSfeer = nu;
    if (!sfeer) startSfeer();
    const stil = !!o.pauze, buiten = Math.max(0, Math.min(1, o.buiten || 0)), nacht = Math.max(0, Math.min(1, o.nacht || 0)), grot = Math.max(0, Math.min(1, o.grot || 0));
    const hoog = Math.max(0, Math.min(1, ((o.hoogte || 64) - 62) / 55)), onder = !!o.onderWater, waterBij = Math.max(0, Math.min(1, o.waterBij || 0));
    // wind: buiten sterker, hoger in de wereld nog sterker; het filter dwaalt langzaam
    const wf = 330 + 260 * (Math.sin(nu * 0.13) * 0.5 + Math.sin(nu * 0.047 + 1.3) * 0.5) + 300 * hoog;
    naar(sfeer.wind.f.frequency, wf, 1.5);
    naar(sfeer.wind.g.gain, stil || onder ? 0 : buiten * (0.03 + 0.09 * hoog) * (0.75 + 0.25 * Math.sin(nu * 0.31)), 1.2);
    naar(sfeer.water.g.gain, stil || onder ? 0 : waterBij * 0.05, 0.8);
    naar(sfeer.onder.g.gain, stil || !onder ? 0 : 0.05, 0.5);
    // regen: een zacht ruisen met getik, buiten helder en onder een dak gedempt (dan vooral het lage geroffel)
    const regen = Math.max(0, Math.min(1, o.regen || 0)), binnen = !!o.binnen;
    naar(sfeer.regen.g.gain, stil || onder ? 0 : regen * (binnen ? 0.012 : 0.05), 1.5);
    naar(sfeer.regen.f.frequency, binnen ? 1300 : 2600, 0.8);
    naar(sfeer.regenLaag.g.gain, stil || onder ? 0 : regen * (binnen ? 0.035 : 0.025), 1.5);
    if (!stil && !onder && !binnen && regen > 0.3 && nu > volgendeTik) { klank(v => { for (let i = 0; i < 3; i++) korrels(v, 1, 0.02, { na: Math.random() * 0.25, type: 'bandpass', freq: r(2500, 5200), Q: 3, aanval: 0.001, verval: 0.025, piek: 0.012 * regen }); }, { pan: r(-0.8, 0.8) }); volgendeTik = nu + r(0.05, 0.18); }
    naar(demp.frequency, onder ? 550 : 20000, 0.15);
    if (stil) return;
    // vogeltjes overdag, buiten
    const dag = (1 - nacht) * buiten;
    if (!onder && dag > 0.4 && nu > volgendeVogel) {
      if (volgendeVogel) vogel(dag);
      volgendeVogel = nu + r(4, 15);
    }
    // krekels 's nachts
    if (!onder && nacht * buiten > 0.35 && nu > volgendeKrekel) { if (volgendeKrekel) krekel(nacht * buiten); volgendeKrekel = nu + r(0.7, 1.8); }
    // druppels in grotten
    if (grot > 0.5 && nu > volgendeDruppel) { if (volgendeDruppel) druppel(grot); volgendeDruppel = nu + r(1.5, 6); }
    // kabbelend water en borrelen onder water
    if ((waterBij > 0.15 || onder) && nu > volgendeBel) { klank(v => { bel(v, 0, onder ? 0.02 : 0.025 * waterBij); if (Math.random() < 0.5) bel(v, r(0.05, 0.15), 0.015); }, { laag: true, pan: r(-0.6, 0.6) }); volgendeBel = nu + r(0.25, onder ? 1.1 : 0.7); }
    // muziek
    if (muziekAan && nu > volgendeMuziek) { if (volgendeMuziek) stukje(); volgendeMuziek = nu + r(40, 120); }
  }
  function vogel(k) {
    const basis = r(1900, 3200), n = 2 + Math.floor(Math.random() * 4), op = Math.random() < 0.5;
    klank(v => {
      let t = 0;
      for (let i = 0; i < n; i++) {
        const d = r(0.05, 0.14), f = basis * r(0.9, 1.15);
        toon(v, { na: t, freq: f, freqEind: op ? f * r(1.2, 1.5) : f * r(0.65, 0.85), glij: d, aanval: 0.01, verval: d, piek: 0.03 * k, fm: r(25, 55), fmDiep: r(60, 160) });
        t += d + r(0.03, 0.12);
      }
    }, { laag: true, pan: r(-0.8, 0.8), galm: 0.25 });
  }
  function krekel(k) {
    const f = r(4200, 4800), n = 3 + Math.floor(Math.random() * 2);
    klank(v => { for (let i = 0; i < n; i++) toon(v, { na: i * 0.045, freq: f, aanval: 0.006, verval: 0.025, piek: 0.012 * k }); }, { laag: true, pan: r(-0.9, 0.9) });
  }
  function druppel(k) {
    const f = r(1200, 2300);
    klank(v => toon(v, { freq: f, freqEind: f * 0.78, aanval: 0.002, verval: r(0.08, 0.14), piek: 0.045 * k }), { laag: true, pan: r(-0.9, 0.9), galm: 0.9 });
  }
  // ---------------- muziek: een rustig stukje van een paar maten, vijftonig, met zachte toetsen en galm
  const VIJF = [0, 2, 4, 7, 9];
  function noot(v, na, midi, piek, lang) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    toon(v, { na, freq: f, aanval: 0.008, verval: lang || 1.4, piek });
    toon(v, { na, vorm: 'triangle', freq: f * 2, aanval: 0.004, verval: (lang || 1.4) * 0.4, piek: piek * 0.25 });
  }
  function stukje() {
    const grond = kies([60, 62, 65, 67]), tel = 60 / r(64, 78), maten = 3 + Math.floor(Math.random() * 2);
    klank(v => {
      let stap = Math.floor(Math.random() * 5) + 5;
      for (let m = 0; m < maten; m++) {
        noot(v, m * tel * 4, grond - 12 + (m % 2 ? 7 : 0), 0.035, 2.4);
        for (let b = 0; b < 4; b++) {
          if (Math.random() < 0.3 && b) continue;
          stap = Math.max(0, Math.min(11, stap + kies([-2, -1, -1, 1, 1, 2, 0])));
          const midi = grond + VIJF[stap % 5] + 12 * Math.floor(stap / 5);
          noot(v, m * tel * 4 + b * tel + (Math.random() < 0.25 ? tel / 2 : 0), midi, 0.03, 1.3);
        }
      }
      noot(v, maten * tel * 4, grond, 0.03, 2.8);
    }, { galm: 0.7 });
  }

  // ---------------- de functies voor het spel
  const API = {
    ontgrendel() {
      try {
        if (!ctx) { if (!AC) return; ctx = new AC({ latencyHint: 'interactive' }); bouw(); }
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
      } catch (e) { ctx = null; }
    },
    aan(b) { aanS = !!b; if (hoofd) naar(hoofd.gain, aanS ? vol : 0, 0.05); },
    volume(v) { vol = Math.max(0, Math.min(1, +v || 0)); if (hoofd) naar(hoofd.gain, aanS ? vol : 0, 0.05); },
    muziek(b) { muziekAan = !!b; if (ctx && muziekAan) volgendeMuziek = ctx.currentTime + r(3, 8); },
    get aanStaat() { return aanS; },
    get context() { return ctx; },
    get klinkend() { return stemmen; },
    stap: (m, s, ren) => stap(m, s == null ? 0.55 : s, ren),
    hak: (m, s) => mat(m, 'hak', s == null ? 0.6 : s),
    breek: (m, s) => mat(m, 'breek', s == null ? 1 : s),
    plaats: (m, s) => mat(m, 'plaats', s == null ? 0.8 : s),
    spring: () => klank(v => ruis(v, { type: 'bandpass', freq: 600, freqEind: 1400, Q: 0.9, aanval: 0.03, verval: 0.1, piek: 0.05 })),
    land(k) { k = Math.max(0, Math.min(1, k == null ? 0.3 : k)); klank(v => { ruis(v, { bruin: true, type: 'lowpass', freq: 300 + 300 * k, aanval: 0.003, verval: 0.1 + 0.12 * k, piek: 0.12 + 0.3 * k }); toon(v, { freq: 75, freqEind: 45, aanval: 0.003, verval: 0.12, piek: 0.05 + 0.12 * k }); }); },
    plons(groot) { const g = groot ? 1 : 0.55; klank(v => { ruis(v, { type: 'lowpass', freq: 3200, freqEind: 450, aanval: 0.005, verval: 0.45 * g + 0.1, piek: 0.28 * g }); for (let i = 0; i < 4 + 4 * g; i++) bel(v, r(0.05, 0.5), 0.04 * g); }, { galm: 0.15 }); },
    zwem: () => klank(v => { ruis(v, { type: 'lowpass', freq: 850, freqEind: 500, aanval: 0.08, verval: 0.22, piek: 0.07 }); bel(v, r(0.05, 0.2), 0.025); }, { laag: true }),
    au: () => klank(v => { ruis(v, { bruin: true, type: 'lowpass', freq: 260, aanval: 0.003, verval: 0.14, piek: 0.4 }); toon(v, { freq: 115, freqEind: 70, aanval: 0.003, verval: 0.12, piek: 0.12 }); toon(v, { vorm: 'triangle', na: 0.02, freq: 440, freqEind: 290, glij: 0.18, aanval: 0.01, verval: 0.17, piek: 0.06 }); }),
    eet: () => klank(v => { for (let i = 0; i < 3; i++) korrels(v, 2, 0.03, { na: i * 0.13 + r(0, 0.02), type: 'bandpass', freq: 2100, Q: 1.3, aanval: 0.003, verval: 0.05, piek: 0.09 }); }),
    slik: () => klank(v => { toon(v, { freq: 320, freqEind: 140, aanval: 0.01, verval: 0.12, piek: 0.08 }); ruis(v, { bruin: true, type: 'lowpass', freq: 500, aanval: 0.01, verval: 0.1, piek: 0.08 }); }),
    oppak: () => klank(v => { const f = r(480, 560); toon(v, { freq: f, freqEind: f * 2.1, aanval: 0.003, verval: 0.08, piek: 0.08 }); toon(v, { na: 0.01, freq: f * 2, freqEind: f * 3.5, aanval: 0.003, verval: 0.06, piek: 0.025 }); }),
    klik: () => klank(v => { toon(v, { vorm: 'triangle', freq: r(1150, 1300), aanval: 0.001, verval: 0.03, piek: 0.06 }); ruis(v, { type: 'highpass', freq: 4000, aanval: 0.001, verval: 0.012, piek: 0.03 }); }),
    deur(open) { mat('hout', 'plaats', 0.7, v => { if (open) toon(v, { vorm: 'sawtooth', na: 0.02, freq: r(560, 640), freqEind: r(700, 780), glij: 0.2, aanval: 0.03, verval: 0.18, piek: 0.012, fm: 9, fmDiep: 25 }); else ruis(v, { na: 0.06, bruin: true, type: 'lowpass', freq: 400, aanval: 0.003, verval: 0.08, piek: 0.2 }); }); },
    kist(open) { mat('hout', 'plaats', 0.6, v => { if (open) toon(v, { vorm: 'sawtooth', na: 0.03, freq: r(300, 360), freqEind: r(240, 280), glij: 0.25, aanval: 0.04, verval: 0.22, piek: 0.01, fm: 7, fmDiep: 15 }); else ruis(v, { na: 0.04, bruin: true, type: 'lowpass', freq: 350, aanval: 0.003, verval: 0.1, piek: 0.22 }); }); },
    oven: () => klank(v => { ruis(v, { bruin: true, type: 'bandpass', freq: 220, freqEind: 900, Q: 0.7, aanval: 0.12, verval: 0.5, piek: 0.25 }); korrels(v, 6, 0.6, { type: 'bandpass', freq: 2500, Q: 2, aanval: 0.001, verval: 0.02, piek: 0.05 }); }),
    stuk: () => klank(v => { for (const m of [1, 2.4, 4.1]) toon(v, { freq: 1300 * m, freqEind: 900 * m, aanval: 0.001, verval: 0.12, piek: 0.04 }); ruis(v, { type: 'bandpass', freq: 2600, Q: 1.5, aanval: 0.001, verval: 0.08, piek: 0.15 }); toon(v, { vorm: 'triangle', na: 0.06, freq: 600, freqEind: 300, glij: 0.2, aanval: 0.01, verval: 0.2, piek: 0.05 }); }),
    nieuw: () => klank(v => { const g = kies([72, 74, 77]); [0, 4, 7, 12].forEach((s, i) => noot(v, i * 0.055, g + s, 0.045, 0.6)); }, { galm: 0.35 }),
    vult: () => klank(v => { ruis(v, { type: 'lowpass', freq: 600, freqEind: 1600, aanval: 0.05, verval: 0.3, piek: 0.08 }); for (let i = 0; i < 6; i++) { const f = 300 + i * 90; toon(v, { na: i * 0.05 + r(0, 0.02), freq: f, freqEind: f * 1.8, aanval: 0.003, verval: 0.05, piek: 0.035 }); } }),
    giet: () => klank(v => { ruis(v, { type: 'lowpass', freq: 1500, freqEind: 500, aanval: 0.04, verval: 0.5, piek: 0.12 }); for (let i = 0; i < 5; i++) bel(v, 0.1 + i * 0.08, 0.03); }),
    ontdek: () => klank(v => { const f = kies([880, 988, 1047]); for (const [m, a, d] of [[1, 0.07, 1.6], [2.0, 0.035, 1.1], [3.01, 0.02, 0.7], [4.2, 0.012, 0.5]]) toon(v, { freq: f * m, aanval: 0.002, verval: d, piek: a }); }, { galm: 0.6 }),
    dood: () => klank(v => { [67, 64, 60, 57].forEach((m, i) => noot(v, i * 0.28, m, 0.05, 0.9)); }, { galm: 0.5 }),
    slaap: () => klank(v => { const g = kies([72, 74]); [0, 4, 7, 11, 14, 19, 16, 12].forEach((s, i) => noot(v, i * 0.14, g + s, 0.022, 1.2)); }, { galm: 0.8 }),
    // een karretje over de naad tussen twee stukjes spoor: twee doffe tikken (laag gehouden, nooit schel)
    kar(snel) {
      const k = Math.max(0.15, Math.min(1, (snel || 2) / 9)), g = Math.max(0.035, 0.11 - k * 0.07);
      klank(v => { for (let i = 0; i < 2; i++) { ruis(v, { na: i * g, bruin: true, type: 'lowpass', freq: 360 + 220 * k, aanval: 0.002, verval: 0.05, piek: 0.05 + 0.08 * k }); toon(v, { na: i * g, vorm: 'triangle', freq: r(140, 155), freqEind: 100, aanval: 0.002, verval: 0.06, piek: 0.025 + 0.03 * k }); } }, { laag: true });
    },
    // een stuwspoor dat een karretje wegduwt: een zacht aanzwellend gezoem
    stuw: () => klank(v => { ruis(v, { type: 'bandpass', freq: 260, freqEind: 1000, Q: 1.1, aanval: 0.05, verval: 0.35, piek: 0.06 }); toon(v, { vorm: 'triangle', freq: 165, freqEind: 330, glij: 0.3, aanval: 0.03, verval: 0.3, piek: 0.03 }); }),
    // dieren en griezels (stap 4): een kort, zacht geluidje per soort; au = geraakt (iets hoger en korter)
    wezen(soort, au) {
      const h = au ? 1.25 : 1, k = au ? 0.6 : 1;
      klank(v => {
        switch (soort) {
          case 'koe': toon(v, { vorm: 'sawtooth', freq: r(110, 130) * h, freqEind: r(82, 92) * h, glij: 0.7 * k, aanval: 0.12, verval: 0.75 * k, piek: 0.03, fm: 4, fmDiep: 6 }); ruis(v, { bruin: true, type: 'lowpass', freq: 380, aanval: 0.1, verval: 0.6 * k, piek: 0.05 }); break;
          case 'schaap': toon(v, { vorm: 'sawtooth', freq: r(330, 380) * h, freqEind: r(300, 330) * h, glij: 0.5 * k, aanval: 0.04, verval: 0.5 * k, piek: 0.018, fm: 22, fmDiep: 40 }); break;
          case 'kip': for (let i = 0; i < (au ? 2 : 3); i++) toon(v, { na: i * 0.11, vorm: 'triangle', freq: r(620, 760) * h, freqEind: r(480, 560), aanval: 0.006, verval: 0.07, piek: 0.035 }); break;
          case 'eend': for (let i = 0; i < 2; i++) ruis(v, { na: i * 0.16, type: 'bandpass', freq: r(900, 1100) * h, freqEind: 600, Q: 6, aanval: 0.01, verval: 0.12, piek: 0.12 }); break;
          case 'konijn': case 'hagedis': korrels(v, 3, 0.08, { type: 'bandpass', freq: 3200 * h, Q: 2, aanval: 0.002, verval: 0.03, piek: 0.03 }); break;
          case 'hert': toon(v, { vorm: 'triangle', freq: r(520, 600) * h, freqEind: r(380, 420), aanval: 0.02, verval: 0.25 * k, piek: 0.03 }); break;
          case 'zeehond': toon(v, { vorm: 'square', freq: r(260, 300) * h, freqEind: r(200, 220), aanval: 0.02, verval: 0.3 * k, piek: 0.012 }); ruis(v, { type: 'bandpass', freq: 700, Q: 2, aanval: 0.02, verval: 0.25, piek: 0.04 }); break;
          case 'spook': toon(v, { freq: r(440, 520) * h, freqEind: r(300, 340), glij: 0.9 * k, aanval: 0.25 * k, verval: 0.9 * k, piek: 0.03, fm: 5, fmDiep: 18 }); break;
          case 'kwal': for (let i = 0; i < 3; i++) bel(v, i * 0.09, 0.03); toon(v, { freq: r(180, 220) * h, freqEind: 140, aanval: 0.05, verval: 0.3, piek: 0.03 }); break;
          case 'braam': korrels(v, 6, 0.25, { type: 'bandpass', freq: 1800 * h, Q: 1.1, aanval: 0.003, verval: 0.05, piek: 0.05 }); break;
          case 'sla': ruis(v, { bruin: true, type: 'lowpass', freq: 520, aanval: 0.002, verval: 0.09, piek: 0.22 }); break;
          case 'poef': ruis(v, { type: 'lowpass', freq: 2200, freqEind: 300, aanval: 0.01, verval: 0.35, piek: 0.12 }); toon(v, { freq: 660, freqEind: 990, aanval: 0.005, verval: 0.18, piek: 0.03 }); break;
          case 'stuiter': { const s2 = Math.max(0.2, au || 0.5); toon(v, { vorm: 'triangle', freq: 180, freqEind: 520, glij: 0.16, aanval: 0.005, verval: 0.2, piek: 0.05 * s2 }); ruis(v, { bruin: true, type: 'lowpass', freq: 400, aanval: 0.003, verval: 0.08, piek: 0.1 * s2 }); break; }
        }
      });
    },
    omgeving,
  };
  return API;
}
