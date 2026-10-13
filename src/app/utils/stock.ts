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
