// Tipos de datos que comparten varias pantallas (antes vivían junto a un servicio viejo que ya no existe).
export interface MenuItem {
  _id: string;
  name: string;
  price: number;
  quantity?: number; // Opcional, ya que no siempre se proporciona
  isPromo?: boolean;
  categoryId?: string | null;
  modifierGroupIds?: string[];
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