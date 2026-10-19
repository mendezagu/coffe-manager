// Frena la publicación si no estás parado en la rama main (producción siempre sale de main).
const { execSync } = require('child_process');

const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
if (branch !== 'main') {
  console.error(`\nNo se publica: estás en la rama "${branch}" y producción sale siempre de "main".`);
  console.error('Fusioná tu rama en main, cambiá a main (git checkout main) y volvé a correr el deploy.\n');
  process.exit(1);
}
