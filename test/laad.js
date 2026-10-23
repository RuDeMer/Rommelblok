// laadt de gedeelde code (shared/) en de rekenhulpjes (client/src/werkers/werker.js) in Node
const shared = require('../shared/index.js');
const werker = require('../client/src/werkers/werker.js');
const texturen = require('../client/src/motor/texturen.js');
const MODULES = { 'gedeeld.js': { RB_GEDEELD: () => shared.G }, 'werker.js': werker, 'texturen.js': texturen };
function laad(bestand, naam) { const m = MODULES[bestand]; if (!m || !(naam in m)) throw new Error('onbekend: ' + bestand + ' ' + naam); return m[naam]; }
module.exports = { gedeeld: () => shared.G, laad };
