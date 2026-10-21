// Color de marca de un restaurante para las pantallas que ven sus clientes (carta QR y reservas).
// El token `forest` de Tailwind lee estas variables; sin ellas rige el verde bosque de siempre.

export const DEFAULT_BRAND = '#1b2822';

// Colores sugeridos: todos oscuros, para que el texto blanco se lea bien encima
export const BRAND_SWATCHES: { label: string; value: string }[] = [
  { label: 'Verde bosque', value: '#1b2822' },
  { label: 'Verde', value: '#1d5b3e' },
  { label: 'Azul noche', value: '#1e3a5f' },
  { label: 'Violeta', value: '#4a3170' },
  { label: 'Bordó', value: '#7a1f2b' },
  { label: 'Ladrillo', value: '#8a2a1c' },
  { label: 'Café', value: '#5a3a28' },
  { label: 'Negro', value: '#1a1a1a' },
];

type Rgb = [number, number, number];

const parse = (hex: string): Rgb | null => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
};

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;

const luminance = ([r, g, b]: Rgb): number => {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

// Contraste con el texto blanco (4.5 es el mínimo recomendado para texto chico)
const contrastWithWhite = (c: Rgb): number => 1.05 / (luminance(c) + 0.05);

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

// Si el color elegido es muy claro para llevar texto blanco, se oscurece lo justo
export function legibleBrand(hex: string): string {
  let c = parse(hex) ?? (parse(DEFAULT_BRAND) as Rgb);
  for (let i = 0; i < 40 && contrastWithWhite(c) < 4.5; i++) c = mix(c, BLACK, 0.06);
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

const triple = (c: Rgb) => c.join(' ');

// Variables CSS (como "r g b") para el contenedor de la pantalla del cliente
export function brandStyle(hex: string | null | undefined): string {
  if (!hex || !parse(hex)) return '';
  const base = parse(legibleBrand(hex)) as Rgb;
  return [
    `--brand-rgb: ${triple(base)}`,
    `--brand-hover-rgb: ${triple(mix(base, BLACK, 0.25))}`,
    `--brand-light-rgb: ${triple(mix(base, WHITE, 0.1))}`,
    `--brand-soft-rgb: ${triple(mix(base, WHITE, 0.9))}`,
  ].join('; ');
}
