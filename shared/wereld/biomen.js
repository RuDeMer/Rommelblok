// De streken (biomen) en kleurhulpjes van de wereldmaker.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).

// ============================================================================
// De wereldmaker
// ============================================================================
const BIOMEN = [
  // sleutel, nl, en
  ['oceaan', 'Oceaan', 'Ocean'], ['diepe_oceaan', 'Diepe oceaan', 'Deep ocean'], ['strand', 'Strand', 'Beach'], ['vlakte', 'Vlakte', 'Plains'],
  ['heide', 'Heide', 'Heath'], ['bos', 'Bos', 'Forest'], ['berkenbos', 'Berkenbos', 'Birch forest'], ['herfstbos', 'Herfstbos', 'Autumn forest'],
  ['taiga', 'Taiga', 'Taiga'], ['sneeuwvlakte', 'Sneeuwvlakte', 'Snowy plains'], ['sneeuwbergen', 'Besneeuwde bergen', 'Snowy mountains'], ['bergen', 'Bergen', 'Mountains'],
  ['woestijn', 'Woestijn', 'Desert'], ['savanne', 'Savanne', 'Savanna'], ['moeras', 'Moeras', 'Swamp'], ['rivier', 'Rivier', 'River'], ['bevroren_oceaan', 'Bevroren zee', 'Frozen sea'], ['tulpenveld', 'Tulpenveld', 'Tulip fields'],
];
const BI = {}; BIOMEN.forEach((b, i) => BI[b[0]] = i);
const rgb565 = (r, g, b) => ((Math.round(r * 31) & 31) << 11) | ((Math.round(g * 63) & 63) << 5) | (Math.round(b * 31) & 31);
const kl = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

export {
  BIOMEN, BI, rgb565, kl,
};
