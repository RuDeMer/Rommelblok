const UIT = require('./uit');
const { gedeeld } = require('./laad'); const png = require('./png');
const G = gedeeld(); const zaad = +(process.argv[2] || 12345), stap = +(process.argv[3] || 4), N = 600;
const W = G.maakWereld(zaad);
const KL = { oceaan: [40, 90, 190], diepe_oceaan: [25, 60, 150], strand: [230, 214, 150], vlakte: [120, 190, 80], heide: [150, 110, 160], bos: [50, 130, 50], berkenbos: [140, 190, 120], herfstbos: [210, 110, 40], taiga: [40, 100, 80], sneeuwvlakte: [235, 240, 250], sneeuwbergen: [255, 255, 255], bergen: [130, 130, 130], woestijn: [240, 220, 120], savanne: [190, 180, 80], moeras: [80, 100, 60], rivier: [60, 140, 220], bevroren_oceaan: [170, 200, 240], tulpenveld: [240, 80, 120] };
const img = new Uint8Array(N * N * 3), tel = {}; const k = {};
for (let pz = 0; pz < N; pz++) for (let px = 0; px < N; px++) {
  const x = (px - N / 2) * stap, z = (pz - N / 2) * stap; W.kolom(x, z, k);
  const n = G.BIOMEN[k.b][0]; tel[n] = (tel[n] || 0) + 1;
  const c = KL[n]; const sh = k.h < G.ZEE ? 0.6 + 0.4 * k.h / G.ZEE : 0.75 + (k.h - G.ZEE) / 140;
  for (let i = 0; i < 3; i++) img[(pz * N + px) * 3 + i] = Math.max(0, Math.min(255, c[i] * sh));
}
png(UIT + '/kaart_' + zaad + '.png', N, N, Buffer.from(img));
const tot = N * N; console.log(Object.entries(tel).sort((a, b) => b[1] - a[1]).map(([n, v]) => n + ' ' + (100 * v / tot).toFixed(1) + '%').join(', '));
