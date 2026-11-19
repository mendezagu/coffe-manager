// Cantidades y costos de inventario, tal como se muestran y se cargan.

export const unitShort = (unit: string): string =>
  ({ unidad: 'u.', g: 'g', kg: 'kg', ml: 'ml', l: 'l' } as Record<string, string>)[unit] ?? unit;

// 1.234,5 g  /  12 u.
export function formatQty(n: number | null | undefined, unit: string): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '';
  const text = Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  return `${text} ${unitShort(unit)}`;
}

// El costo se guarda por la unidad de medida del insumo (por gramo, por mililitro). Pero nadie piensa
// "$0,02 el gramo": se carga y se muestra por kilo o por litro.
export const costFactor = (unit: string): number => (unit === 'g' || unit === 'ml' ? 1000 : 1);

export const costUnitLabel = (unit: string): string =>
  unit === 'g' ? 'kg' : unit === 'ml' ? 'litro' : unit === 'unidad' ? 'unidad' : unit === 'kg' ? 'kg' : 'litro';

// de lo que escribe la persona (por kilo) a lo que se guarda (por gramo)
export const toStoredCost = (shown: number, unit: string): number => Math.round((Number(shown) / costFactor(unit)) * 1e6) / 1e6;

// de lo guardado a lo que se muestra
export const toShownCost = (stored: number, unit: string): number => Math.round(stored * costFactor(unit) * 100) / 100;

export const STATUS_LABELS: Record<string, string> = { ok: 'Normal', low: 'Stock bajo', out: 'Agotado' };

export const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE: 'Entrada',
  SALE: 'Venta',
  WASTE: 'Merma',
  ADJUSTMENT: 'Ajuste',
};

// ---- Carga de varios insumos de una vez ----
// Una línea por insumo: "Café en grano 5 kg", "Leche 20 litros", "Vasos 200". Sin unidad, se cuenta en unidades; sin cantidad, queda en cero.
export interface ParsedStockLine {
  line: string;
  name: string;
  quantity: number;
  unit: string;
  ok: boolean;
  problem?: string;
}

const UNIT_ALIASES: Record<string, string> = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg',
  g: 'g', gr: 'g', grs: 'g', grm: 'g', gramo: 'g', gramos: 'g',
  l: 'l', lt: 'l', lts: 'l', litro: 'l', litros: 'l',
  // "mll" y "mls" son errores comunes de tipeo de ml
  ml: 'ml', mll: 'ml', mls: 'ml', cc: 'ml', mililitro: 'ml', mililitros: 'ml',
  u: 'unidad', un: 'unidad', unid: 'unidad', unidad: 'unidad', unidades: 'unidad',
};

export const MAX_BULK_LINES = 100;

export function parseStockLines(text: string): ParsedStockLine[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_BULK_LINES)
    .map((line) => {
      // Cantidad primero, como se habla: "200 g de harina", "200g de filet de merluza", "2 huevos"
      const first = line.match(/^(\d+(?:[.,]\d+)?)\s*([a-záéíóúñ]+)\s+(?:de\s+|del\s+)?(.+)$/i);
      if (first && UNIT_ALIASES[first[2].toLowerCase()]) {
        const name = first[3].replace(/[\s,:;\-–]+$/, '').trim();
        return { line, name, quantity: Number(first[1].replace(',', '.')), unit: UNIT_ALIASES[first[2].toLowerCase()], ok: true };
      }
      const counted = line.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
      if (counted) {
        return { line, name: counted[2].replace(/[\s,:;\-–]+$/, '').trim(), quantity: Number(counted[1].replace(',', '.')), unit: 'unidad', ok: true };
      }
      const m = line.match(/^(.*\S)(?:\s+|\s*[:;\-–]\s*)(\d+(?:[.,]\d+)?)\s*([a-záéíóúñ]+)?\.?$/i);
      // sin cantidad al final: es solo el nombre
      if (!m) return { line, name: line.replace(/[\s,:;\-–]+$/, ''), quantity: 0, unit: 'unidad', ok: true };
      const unitText = (m[3] || '').toLowerCase();
      const unit = unitText ? UNIT_ALIASES[unitText] : 'unidad';
      const name = m[1].replace(/(\s+[x×]\s*|[\s,:;\-–])+$/i, '').trim();
      if (!unit) return { line, name: line, quantity: 0, unit: 'unidad', ok: false, problem: `No entendí la unidad "${m[3]}". Usá kg, g, l, ml o unidades.` };
      if (!name) return { line, name: line, quantity: 0, unit, ok: false, problem: 'Falta el nombre.' };
      return { line, name, quantity: Number(m[2].replace(',', '.')), unit, ok: true };
    });
}

// ---- Nombres parecidos y unidades compatibles (recetas escritas en texto) ----
export const normalizeName = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

// Palabras que cuentan de un nombre ("Granos de café" y "Café en grano" comparten café y grano)
export function nameTokens(name: string): string[] {
  const stop = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'con', 'y', 'x']);
  return normalizeName(name)
    .split(' ')
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    .filter((w) => w && !stop.has(w));
}

// Un nombre "se parece" a otro si todas las palabras del más corto están en el más largo
export function namesSimilar(a: string, b: string): boolean {
  const x = nameTokens(a);
  const y = nameTokens(b);
  if (!x.length || !y.length) return false;
  const [small, big] = x.length <= y.length ? [x, y] : [y, x];
  return small.every((w) => big.includes(w));
}

// De lo escrito (en la unidad que puso la persona) a la unidad del insumo. null si no se pueden convertir (ej: ml de algo que se cuenta en kg).
export function convertQty(quantity: number, shownUnit: string, itemUnit: string): number | null {
  if (shownUnit === itemUnit) return quantity;
  const family = (u: string) => (u === 'l' || u === 'ml' ? 'volumen' : u === 'kg' || u === 'g' ? 'peso' : 'unidad');
  if (family(shownUnit) !== family(itemUnit)) return null;
  const big = ['l', 'kg'];
  const converted = big.includes(itemUnit) && !big.includes(shownUnit) ? quantity / 1000 : !big.includes(itemUnit) && big.includes(shownUnit) ? quantity * 1000 : quantity;
  return Math.round(converted * 1e4) / 1e4;
}

// Cómo se escribe la cantidad de un insumo, para los avisos
export const unitHint = (unit: string): string => (unit === 'l' || unit === 'ml' ? 'litros: escribila en l o ml' : unit === 'kg' || unit === 'g' ? 'kilos: escribila en kg o g' : 'unidades: escribila sin unidad (ej: 1)');
