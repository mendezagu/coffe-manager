// Opción elegida al pedir un plato. En las órdenes viene guardada con el nombre y el precio
// del momento del pedido.
export interface OrderModifier {
  groupId?: string;
  group: string;
  optionId?: string;
  name: string;
  priceDelta: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Lo que suman (o restan) las opciones al precio de una unidad
export function modifiersTotal(modifiers: OrderModifier[] | null | undefined): number {
  return round2((modifiers ?? []).reduce((sum, m) => sum + (Number(m.priceDelta) || 0), 0));
}

// "Grande, Leche de almendras"
export function modifiersText(modifiers: OrderModifier[] | null | undefined): string {
  return (modifiers ?? []).map((m) => m.name).join(', ');
}

// Identifica un plato con sus opciones: el mismo plato con otras opciones es otra línea
export function lineKey(itemId: string, modifiers: OrderModifier[] | null | undefined): string {
  const ids = (modifiers ?? []).map((m) => m.optionId ?? m.name).sort();
  return ids.length ? `${itemId}|${ids.join('|')}` : itemId;
}
