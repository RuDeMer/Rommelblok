// de map voor de testpagina en alles wat de tests maken (schermafbeeldingen, exports); niet in de repository
const os = require('os'), path = require('path'), fs = require('fs');
const UIT = process.env.RB_UIT || path.join(os.tmpdir(), 'rommelblok-uit');
fs.mkdirSync(UIT, { recursive: true });
module.exports = UIT;
