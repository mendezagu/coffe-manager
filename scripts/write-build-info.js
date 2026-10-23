// Escribe src/app/build-info.ts con la versión que se está compilando, para mostrarla en el menú lateral:
//   número: 1.0.<cantidad de commits>  (sube solo con cada cambio publicado; sin historial de git usa la fecha)
//   fecha y hora de la compilación, y el commit (solo como dato técnico)
// Corre antes de "npm run build:app" (hook "prebuild:app"), también en Cloudflare.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sh = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

// En algunos servidores de compilación el repositorio llega "recortado": se intenta traer el historial completo
if (sh('git rev-parse --is-shallow-repository') === 'true') sh('git fetch --unshallow --quiet');
const shallow = sh('git rev-parse --is-shallow-repository') === 'true';
const count = Number(sh('git rev-list --count HEAD')) || 0;

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
// Si no hay historial confiable, el número sale de la fecha y la hora (también sube con cada publicación)
const stamp = `${String(now.getUTCFullYear()).slice(2)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;
const version = `1.0.${!shallow && count > 0 ? count : stamp}`;
const commit = (process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || sh('git rev-parse HEAD')).slice(0, 7) || 'dev';

const content = `// Generado por scripts/write-build-info.js al compilar: no editar a mano.
export const BUILD_INFO = { version: '${version}', commit: '${commit}', builtAt: '${now.toISOString()}' };
`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'app', 'build-info.ts'), content);
console.log('build-info:', version, commit, now.toISOString());
