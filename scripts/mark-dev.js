// Deja en la carpeta compilada de pruebas la orden de no indexar el sitio en buscadores.
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error('mark-dev: falta la carpeta compilada');
  process.exit(1);
}
fs.writeFileSync(path.join(dir, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n');
fs.writeFileSync(path.join(dir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
