// Wat de bouwwerken en de dorpjes samen gebruiken.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { BI } from './biomen.js';

// wm: de werkplaats van één wereld (zaadje, ruis en wat de eerdere delen gemaakt hebben)
export function bouwGrond(wm) {
  const {
    kolom,
  } = wm;

  // ============================================================================
  // Bouwwerken: ruïnes, oude mijngangen en sterrenkraters. Per vak van 64 x 64 vast uit het zaadje,
  // als een lijst blokken met wereldcoördinaten. Elk stuk zet alleen zijn eigen deel, in een vaste volgorde: zo zijn er geen naden.
  // Wat een bouwwerk bekijkt is alleen de kolom (hoogte en streek), nooit de blokken van een buurstuk.
  // ============================================================================
  const BOUW = { krater: 0.03, ruine: 0.17, mijn: 0.1 }, BW = 5;
  // manieren: ZET altijd, VUL alleen in lucht (of iets kleins), GRAAF lucht maken (niet in water of een meeroever), OPGROND alleen in lucht met iets vasts eronder
  const ZET = 0, VUL = 1, GRAAF = 2, OPGROND = 3;
  const NAT_STREEK = new Set([BI.oceaan, BI.diepe_oceaan, BI.bevroren_oceaan, BI.rivier, BI.strand]);
  const bouwVakken = new Map(), bk = {};
  const hKol = (x, z) => Math.floor(kolom(x, z, bk).h);

  Object.assign(wm, {
    BOUW, BW, ZET, VUL, GRAAF, OPGROND, NAT_STREEK, bouwVakken, bk, hKol,
  });
}
