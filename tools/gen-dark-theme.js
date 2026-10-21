// Genera src/_dark-theme.generated.scss: el modo oscuro del panel interno (estilo Discord, grises neutros).
//
// En vez de tocar cada pantalla, se recorren los templates y los .ts buscando las clases de color de Tailwind que se
// usan (bg-white, bg-sage-100, text-cafe-green-700, hover:bg-cafe-red-50…) y por cada una se escribe, bajo `html.dark`,
// la versión oscura. Si se agrega una clase de color nueva, se vuelve a correr:  node tools/gen-dark-theme.js
//
// Reglas de la traducción (la paleta clara no se toca):
//  - fondos y bordes claros (sage 50-300, tintes 50-300 de cada color) pasan a grises/tintes oscuros;
//  - textos oscuros (sage 400-900, colores 600-900) pasan a claros;
//  - fondos medios y oscuros (500+) y textos claros (50-300) se dejan como están: son botones, barras, etc.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const OUT = path.join(ROOT, '_dark-theme.generated.scss');

// ---- paleta oscura (Discord) ----
const SURFACE = '#2b2d31'; // lo que en claro es "bg-white" (tarjetas, paneles)
const SAGE_BG = { 50: '#34363c', 100: '#313338', 200: '#3f4147', 300: '#4a4d54' };
const SAGE_BORDER = { 50: '#3f4147', 100: '#3f4147', 200: '#3f4147', 300: '#4a4d54', 400: '#5c5f66' };
const SAGE_TEXT = { 400: '#80848e', 500: '#949ba4', 600: '#b5bac1', 700: '#c4c9ce', 800: '#dbdee1', 900: '#f2f3f5' };

// Color base de cada tono, para armar sus tintes oscuros y sus textos claros
const HUES = {
  'cafe-green': '#4f8668',
  'cafe-mint': '#5fae86',
  'cafe-red': '#c0462f',
  'cafe-amber': '#e6834a',
  yellow: '#eab308',
  sky: '#38bdf8',
};

const hex = (n) => n.toString(16).padStart(2, '0');
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const A = rgb(a);
  const B = rgb(b);
  return '#' + A.map((v, i) => hex(Math.round(v + (B[i] - v) * t))).join('');
};
const withAlpha = (h, a) => `rgba(${rgb(h).join(', ')}, ${a})`;

// tinte oscuro de un tono para fondos/bordes (50 muy sutil … 300 más marcado)
const TINT_MIX = { 50: 0.2, 100: 0.3, 200: 0.42, 300: 0.55 };
const tintBg = (hue, step) => mix(SURFACE, HUES[hue], TINT_MIX[step]);
const tintBorder = (hue, step) => mix(SURFACE, HUES[hue], TINT_MIX[step] + 0.1);
// textos: 600 un poco aclarado, 700-900 claros
const TEXT_MIX = { 600: 0.3, 700: 0.5, 800: 0.62, 900: 0.74 };
const lightText = (hue, step) => mix(HUES[hue], '#ffffff', TEXT_MIX[step]);

// Botones principales: el verde botella (#1b2822) casi no se distingue de una tarjeta oscura, así que se aclara
const BUTTON_GREEN = '#2e7a57';
const BUTTON_GREEN_HOVER = '#3a8c67';

function darkValue(prop, color, step, hover) {
  if (color === 'white') return prop === 'bg' ? SURFACE : null;
  if (color === 'sage') {
    if (prop === 'bg') return SAGE_BG[step] ?? null;
    if (prop === 'text' || prop === 'placeholder') return SAGE_TEXT[step] ?? null;
    return SAGE_BORDER[step] ?? null; // border, ring, divide
  }
  if (!HUES[color]) return null;
  if (prop === 'bg' && color === 'cafe-green') {
    if (step === 600 || step === 700) return BUTTON_GREEN;
    if (step === 800 && hover) return BUTTON_GREEN_HOVER;
  }
  if (prop === 'bg') return TINT_MIX[step] ? tintBg(color, step) : null;
  if (prop === 'border' || prop === 'ring' || prop === 'divide') return TINT_MIX[step] ? tintBorder(color, step) : null;
  return TEXT_MIX[step] ? lightText(color, step) : null; // text, placeholder
}

// ---- recorrido de los archivos ----
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.(html|ts)$/.test(f.name) && !/\.spec\.ts$/.test(f.name)) out.push(p);
  }
  return out;
}

const COLORS = ['white', 'sage', ...Object.keys(HUES)].join('|').replace(/cafe-green|cafe-mint|cafe-red|cafe-amber/g, (m) => m);
const RE = new RegExp(
  `(?<![\\w-])((?:[a-z0-9-]+:)*)(!?)(bg|text|border|ring|divide|placeholder)-(white|(?:${COLORS})-(\\d{2,3}))(?:\\/(\\d{1,3}))?(?![\\w-])`,
  'g',
);

const found = new Map(); // clase completa -> partes
for (const file of walk(path.join(ROOT, 'app'))) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(RE)) {
    const [full, variants, important, prop, token, step, alpha] = m;
    found.set(full, { variants: variants.split(':').filter(Boolean), important: !!important, prop, token, alpha });
  }
}

const esc = (s) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);
const PSEUDO = { hover: ':hover', focus: ':focus', active: ':active', 'focus-visible': ':focus-visible', disabled: ':disabled', first: ':first-child', last: ':last-child' };
const MEDIA = { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' };
const CSS_PROP = { bg: 'background-color', text: 'color', border: 'border-color', ring: '--tw-ring-color', divide: 'border-color', placeholder: 'color' };

const rules = [];
const skipped = [];
for (const [cls, p] of [...found.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const m = /^(white|cafe-green|cafe-mint|cafe-red|cafe-amber|sage|yellow|sky)(?:-(\d+))?$/.exec(p.token);
  if (!m) continue;
  const base = darkValue(p.prop, m[1], Number(m[2]), p.variants.includes('hover'));
  if (!base) continue;
  const value = p.alpha ? withAlpha(base, Number(p.alpha) / 100) : base;

  let pseudo = '';
  let media = null;
  let ok = true;
  let placeholder = false;
  for (const v of p.variants) {
    if (PSEUDO[v]) pseudo += PSEUDO[v];
    else if (MEDIA[v]) media = MEDIA[v];
    else if (v === 'placeholder') placeholder = true;
    else ok = false;
  }
  if (!ok) {
    skipped.push(cls);
    continue;
  }
  let selector = `html.dark .${esc(cls)}${pseudo}`;
  if (p.prop === 'placeholder') selector += '::placeholder';
  else if (placeholder) selector += '::placeholder';
  if (p.prop === 'divide') selector = `html.dark .${esc(cls)} > :not([hidden]) ~ :not([hidden])`;

  let decl = `${CSS_PROP[p.prop]}: ${value} !important;`;
  if (p.prop === 'ring') decl = `--tw-ring-color: ${value} !important;`;
  const rule = `${selector} { ${decl} }`;
  rules.push(media ? `@media (min-width: ${media}) { ${rule} }` : rule);
}

const header = `// ARCHIVO GENERADO por tools/gen-dark-theme.js: no se edita a mano.
// Modo oscuro del panel interno. Si se agregan clases de color nuevas, correr:  node tools/gen-dark-theme.js
`;
fs.writeFileSync(OUT, header + rules.join('\n') + '\n');
console.log(`${rules.length} reglas generadas (${found.size} clases de color encontradas)`);
if (skipped.length) console.log('Sin traducir (variante no soportada):', skipped.join(', '));
