// Maten van de wereld: een stuk is 16 x 16 x 128 blokken, de zee ligt op 56.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).

const CH = 16, HOOG = 128, ZEE = 56, SECTIES = HOOG / 16, VOL = CH * CH * HOOG;
const idx = (x, y, z) => (y << 8) | (z << 4) | x;

export {
  CH, HOOG, ZEE, SECTIES, VOL, idx,
};
