import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { SettingsService } from './settings.service';

export type PlanKey = 'basic' | 'pro' | 'benefits';
export const PLAN_ORDER: PlanKey[] = ['basic', 'pro', 'benefits'];

// Qué incluye cada plan (la lista que se le muestra al dueño del local)
export const PLAN_INFO: Record<PlanKey, { label: string; resume: string; includes: string[] }> = {
  basic: {
    label: 'Esencial',
    resume: 'Para trabajar todo el día',
    includes: ['Mesas, pedidos y cobro (varios métodos, dividir y cobro parcial)', 'Mostrador (venta sin mesa)', 'Caja con turnos', 'Pantalla de cocina', 'Carta QR para ver el menú', 'Balance y reporte básico'],
  },
  pro: {
    label: 'Pro',
    resume: 'Ordená tu negocio y ahorrá plata',
    includes: ['Todo lo de Esencial', 'Separar cocina y barra', 'Pedido desde la mesa por QR', 'Inventario, recetas y ganancia', 'Modificadores y extras', 'Reportes completos', 'Comisión de mozos', 'Reservas de mesa', 'Historial de acciones (Logs)'],
  },
  benefits: {
    label: 'Beneficios',
    resume: 'Sumá clientes nuevos',
    includes: ['Todo lo de Pro', 'Hoteles aliados y vouchers', 'Cola de espera por QR (próximamente)'],
  },
};

export const FEATURE_LABELS: Record<string, string> = {
  kitchen_bar_split: 'Separar cocina y barra',
  inventory: 'Inventario y stock',
  qr_ordering: 'Pedido por QR en la mesa',
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
    return PLAN_ORDER.includes(plan) ? plan : 'pro';
  }

  get currentLabel(): string {
    return PLAN_INFO[this.current].label;
  }

  has(feature: string): boolean {
    return (this.settings.value.features ?? []).includes(feature);
  }

  // Bloqueada = ya se sabe el plan y no incluye la función
  locked(feature: string): boolean {
    return this.loaded && !this.has(feature);
  }

  // Plan mínimo que incluye la función
  needed(feature: string): PlanKey {
    return (this.settings.value.featurePlans?.[feature] as PlanKey) ?? 'pro';
  }

  // A qué plan conviene pasarse: el siguiente al actual, o el que pide la función si está más arriba
  target(feature?: string): PlanKey | null {
    const next = PLAN_ORDER[PLAN_ORDER.indexOf(this.current) + 1];
    if (!next) return null; // ya tiene el más completo
    if (!feature) return next;
    const needed = this.needed(feature);
    return PLAN_ORDER.indexOf(needed) > PLAN_ORDER.indexOf(next) ? needed : next;
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
