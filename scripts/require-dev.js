// Frena la publicación en pruebas si no estás parado en la rama de desarrollo (para no subir a pruebas algo que no es).
const { execSync } = require('child_process');

const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
if (!['develop', 'dev'].includes(branch)) {
  console.error(`\nNo se publica en pruebas: estás en la rama "${branch}" y pruebas sale de "develop" (o "dev").`);
  console.error('Cambiá de rama (git checkout develop) y volvé a correr el deploy.\n');
  process.exit(1);
}
