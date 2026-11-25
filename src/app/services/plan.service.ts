import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { SettingsService } from './settings.service';

export type PlanKey = 'free' | 'free_takeaway' | 'takeaway' | 'basic' | 'pro' | 'benefits';
// Planes con salón, de menor a mayor. Takeaway va aparte: es para negocios que venden solo en mostrador.
export const PLAN_ORDER: PlanKey[] = ['basic', 'pro', 'benefits'];
// Los planes que hoy se ofrecen a los clientes: Gratis (el que ya tienen) y Pro. Los demás siguen existiendo para quien ya los tenga.
export const OFFERED_PLANS: PlanKey[] = ['pro'];

// Qué incluye cada plan (la lista que se le muestra al dueño del local)
export const PLAN_INFO: Record<PlanKey, { label: string; resume: string; includes: string[] }> = {
  free: {
    label: 'Gratis',
    resume: 'Para empezar sin costo',
    includes: ['Hasta 5 mesas', 'Hasta 30 platos en el menú', 'Pedido por QR en la mesa', 'Carta QR para ver el menú', 'Mostrador: hasta 20 ventas por mes', 'Hasta 3 mozos', 'Hasta 2 usuarios'],
  },
  free_takeaway: {
    label: 'Gratis Takeaway',
    resume: 'Para empezar a vender en mostrador, sin costo',
    includes: ['Mostrador: hasta 50 ventas por mes', 'Tienda online: hasta 20 pedidos por mes', 'Hasta 30 platos en el menú', 'Carta QR para ver el menú', 'Hasta 2 usuarios'],
  },
  takeaway: {
    label: 'Takeaway',
    resume: 'Para vender en mostrador, sin mesas',
    includes: ['Mostrador (venta sin mesa)', 'Caja con turnos', 'Carta QR para ver el menú', 'Modificadores y tamaños', 'Balance y reporte básico', 'Sin mesas, mozos ni reservas'],
  },
  basic: {
    label: 'Esencial',
    resume: 'Para trabajar todo el día',
    includes: ['Mesas, pedidos y cobro (varios métodos, dividir y cobro parcial)', 'Caja con turnos', 'Pantalla de cocina', 'Carta QR para ver el menú', 'Balance y reporte básico'],
  },
  pro: {
    label: 'Pro',
    resume: 'Ordená tu negocio y ahorrá plata',
    includes: ['Mesas, pedidos y cobro sin límites (dividir y cobro parcial)', 'Caja con turnos', 'Pantalla de cocina', 'Carta QR para ver el menú', 'Balance y reportes', 'Mostrador (venta sin mesa)', 'Separar cocina y barra', 'Pedido desde la mesa por QR', 'Inventario, recetas y ganancia', 'Modificadores y extras', 'Reportes completos', 'Comisión de mozos', 'Reservas de mesa', 'Historial de acciones (Logs)'],
  },
  benefits: {
    label: 'Beneficios',
    resume: 'Sumá clientes nuevos',
    includes: ['Todo lo de Pro', 'Hoteles aliados y vouchers', 'Cola de espera por QR (próximamente)'],
  },
};

export const FEATURE_LABELS: Record<string, string> = {
  tables: 'Salón: mesas, mozos y sectores',
  counter_sales: 'Mostrador (venta sin mesa)',
  kitchen_bar_split: 'Separar cocina y barra',
  inventory: 'Inventario y stock',
  qr_ordering: 'Pedido por QR en la mesa',
  online_store: 'Tienda online (pedidos por link)',
  modifiers: 'Modificadores y extras',
  advanced_reports: 'Reportes completos',
  commission: 'Comisión de mozos',
  reservations: 'Reservas de mesa',
  logs: 'Historial de acciones (Logs)',
  hotels: 'Hoteles aliados y vouchers',
};

// Cómo se llama cada función en la lista de lo que incluye cada plan (para resaltar la que se pidió)
export const FEATURE_GAIN: Record<string, string> = {
  counter_sales: 'Mostrador (venta sin mesa)',
  kitchen_bar_split: 'Separar cocina y barra',
  qr_ordering: 'Pedido desde la mesa por QR',
  online_store: 'Tienda online: pedidos por link para retirar o con envío',
  inventory: 'Inventario, recetas y ganancia',
  modifiers: 'Modificadores y extras',
  advanced_reports: 'Reportes completos',
  commission: 'Comisión de mozos',
  reservations: 'Reservas de mesa',
  logs: 'Historial de acciones (Logs)',
  hotels: 'Hoteles aliados y vouchers',
};

// Plan actual del local y cómo pedir un cambio: el botón abre WhatsApp con el mensaje ya escrito hacia Tavolapp
@Injectable({ providedIn: 'root' })
export class PlanService {
  constructor(private settings: SettingsService) {}

  // ¿Ya llegaron del servidor los datos del plan? (hasta entonces no se bloquea nada, para que no parpadee)
  get loaded(): boolean {
    return !!this.settings.value.featurePlans;
  }

  get current(): PlanKey {
    const plan = this.settings.value.plan as PlanKey;
    return plan === 'free' || plan === 'free_takeaway' || plan === 'takeaway' || PLAN_ORDER.includes(plan) ? plan : 'pro';
  }

  get currentLabel(): string {
    return PLAN_INFO[this.current].label;
  }

  // Tope de cantidad del plan (undefined = sin límite): tables, menuItems, users, counterSalesPerMonth, onlineOrdersPerMonth
  limit(kind: string): number | undefined {
    return this.settings.value.limits?.[kind];
  }

  has(feature: string): boolean {
    return (this.settings.value.features ?? []).includes(feature);
  }

  // Cómo vende el negocio (sin dato todavía se muestra todo, para que no parpadee)
  get salesMode(): 'both' | 'counter' | 'tables' {
    return this.settings.value.salesMode ?? 'both';
  }

  // ¿Se muestra el salón (Inicio con mesas, mozos, sectores, reservas)? Lo decide cómo vende el negocio: solo mesas o mesas y mostrador sí;
  // solo mostrador (takeaway) no. No depende de qué trae el plan: si el local vende por mesas, el Inicio tiene que estar.
  get showTables(): boolean {
    return this.salesMode !== 'counter';
  }

  // ¿Se muestra todo lo del Mostrador (menú, pestañas, reportes)? Solo si el negocio lo tiene (por su plan o un extra) y no vende solo en mesas
  get showCounter(): boolean {
    return this.loaded && this.salesMode !== 'tables' && this.has('counter_sales');
  }

  // Bloqueada = ya se sabe el plan y no incluye la función
  locked(feature: string): boolean {
    return this.loaded && !this.has(feature);
  }

  // Plan mínimo que incluye la función
  needed(feature: string): PlanKey {
    // Esencial no se ofrece: lo que antes venía desde Esencial se pide con Pro
    const plan = (this.settings.value.featurePlans?.[feature] as PlanKey) ?? 'pro';
    return plan === 'basic' ? 'pro' : plan;
  }

  // A qué plan conviene pasarse: el siguiente al actual, o el que pide la función si está más arriba
  target(_feature?: string): PlanKey | null {
    // Hoy se ofrece solo Pro: quien ya lo tiene (o algo superior) no tiene a qué pasarse
    return this.current === 'pro' || this.current === 'benefits' ? null : 'pro';
  }

  // Link de WhatsApp al número de Tavolapp con el pedido ya escrito. null si todavía no se cargó el número.
  whatsappUrl(target: PlanKey, feature?: string): string | null {
    const phone = String((environment as { salesWhatsapp?: string }).salesWhatsapp ?? '').replace(/\D/g, '');
    if (!phone) return null;
    const s = this.settings.value;
    const lines = [
      `¡Hola! Soy del local ${s.name || 'sin nombre'}${s.loginCode ? ` (código ${s.loginCode})` : ''}.`,
      `Hoy tenemos el plan ${this.currentLabel} y quiero pasarme al plan ${PLAN_INFO[target].label}.`,
    ];
    if (feature && FEATURE_LABELS[feature]) lines.push(`Lo necesito para: ${FEATURE_LABELS[feature]}.`);
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join(' '))}`;
  }
}
