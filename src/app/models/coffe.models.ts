// Tipos de datos que comparten varias pantallas (antes vivían junto a un servicio viejo que ya no existe).
export interface MenuItem {
  _id: string;
  name: string;
  price: number;
  quantity?: number; // Opcional, ya que no siempre se proporciona
  isPromo?: boolean;
  isFavorite?: boolean; // fijado en la caja del mostrador
  imageUrl?: string | null; // foto del plato
  description?: string | null; // descripción corta para la carta
  badge?: string | null; // etiqueta sobre la foto ("Firma Casa")
  badgeColor?: string;
  featured?: boolean; // aparece en "Destacados"
  visibleInMenu?: boolean; // false = oculto de la carta online y del pedido por QR (undefined = visible)
  categoryId?: string | null;
  modifierGroupIds?: string[];
  // precio propio de algunas opciones en este plato: { idOpción: precio final }
  optionPrices?: Record<string, number>;
  availableUnits?: number | null;
}

export interface Table {
  id: any;
  name: any;
  available: boolean;
  orders: MenuItem[];
  linkedTables: any[];
  controlledBy?: any;
  waiterId?: any;
  waiterName?: any;
  waiter?: Waiter;
}

export interface Waiter {
  id: any;
  name: any;
}