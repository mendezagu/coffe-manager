import { Component, Input } from '@angular/core';
import { OFFERED_PLANS, PLAN_INFO, PlanKey, PlanService } from 'src/app/services/plan.service';

// Ícono y tono de cada plan (el tono se usa en las clases de la plantilla)
const PLAN_ICON: Record<PlanKey, string> = { free: 'redeem', free_takeaway: 'redeem', takeaway: 'takeout_dining', basic: 'storefront', pro: 'rocket_launch', benefits: 'diamond' };

// "Tu plan": el plan actual y Pro lado a lado, con el pedido de cambio por WhatsApp
@Component({
  selector: 'app-plan-page',
  templateUrl: './plan.component.html',
})
export class PlanPageComponent {
  // Dentro de otra pantalla (Mi negocio): sin encabezado ni fondo propios
  @Input() embedded = false;

  readonly info = PLAN_INFO;

  constructor(public plans: PlanService) {}

  icon(plan: PlanKey): string {
    return PLAN_ICON[plan];
  }

  isCurrent(plan: PlanKey): boolean {
    return this.plans.current === plan;
  }

  get current(): PlanKey {
    return this.plans.current;
  }

  // Dos tarjetas: la del plan que tiene hoy (Gratis) y Pro. Quien ya es Pro ve Gratis y Pro; Beneficios, Pro y Beneficios
  get cards(): PlanKey[] {
    const c = this.plans.current;
    if (c === 'pro') return ['free', 'pro'];
    if (c === 'benefits') return ['pro', 'benefits'];
    return [c, 'pro'];
  }

  // La tarjeta con marco destacado: Pro (o el plan actual si es superior a Pro)
  featured(plan: PlanKey): boolean {
    return this.plans.current === 'benefits' ? plan === 'benefits' : plan === 'pro';
  }

  // Solo se ofrece pasar a Pro, y no a quien ya tiene algo igual o superior
  canSwitchTo(plan: PlanKey): boolean {
    const c = this.plans.current;
    return OFFERED_PLANS.includes(plan) && c !== 'pro' && c !== 'benefits';
  }

  // Los gratis cuestan $0; el precio de los pagos todavía no está publicado
  price(plan: PlanKey): { amount: string; per: string } {
    return plan === 'free' || plan === 'free_takeaway' ? { amount: '$0', per: '/mes' } : { amount: 'A consultar', per: '' };
  }

  // Cuántos puntos se ven antes de tocar "+" (así todas las tarjetas quedan de la misma altura)
  readonly shownCount = 6;
  expanded = false;

  long(plan: PlanKey): boolean {
    return this.items(plan).length > this.shownCount + 1;
  }

  visibleItems(plan: PlanKey): string[] {
    return this.long(plan) && !this.expanded ? this.items(plan).slice(0, this.shownCount) : this.items(plan);
  }

  trackPlan(_i: number, plan: PlanKey) {
    return plan;
  }

  // "Todo lo de Esencial" no se muestra como un ítem más: va como subtítulo de la lista
  base(plan: PlanKey): string {
    return PLAN_INFO[plan].includes.find((i) => i.startsWith('Todo lo de')) ?? '';
  }

  items(plan: PlanKey): string[] {
    return PLAN_INFO[plan].includes.filter((i) => !i.startsWith('Todo lo de'));
  }

  url(plan: PlanKey): string | null {
    return this.plans.whatsappUrl(plan);
  }
}
