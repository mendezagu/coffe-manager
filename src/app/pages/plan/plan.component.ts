import { Component } from '@angular/core';
import { PLAN_INFO, PLAN_ORDER, PlanKey, PlanService } from 'src/app/services/plan.service';

// Ícono y tono de cada plan (el tono se usa en las clases de la plantilla)
const PLAN_ICON: Record<PlanKey, string> = { takeaway: 'takeout_dining', basic: 'storefront', pro: 'rocket_launch', benefits: 'diamond' };

// "Tu plan": los tres planes lado a lado, con el actual marcado y el pedido de cambio por WhatsApp
@Component({
  selector: 'app-plan-page',
  templateUrl: './plan.component.html',
})
export class PlanPageComponent {
  readonly info = PLAN_INFO;

  constructor(public plans: PlanService) {}

  icon(plan: PlanKey): string {
    return PLAN_ICON[plan];
  }

  isCurrent(plan: PlanKey): boolean {
    return this.plans.current === plan;
  }

  // Un negocio takeaway ve su plan y, aparte, los planes con salón (por si suma mesas); uno con salón ve solo los suyos
  get order(): PlanKey[] {
    return this.plans.current === 'takeaway' ? ['takeaway', ...PLAN_ORDER] : PLAN_ORDER;
  }

  get current(): PlanKey {
    return this.plans.current;
  }

  // Los planes a los que puede pasarse (los de arriba; un negocio takeaway ve los de salón)
  get others(): PlanKey[] {
    return this.order.filter((p) => this.isAbove(p));
  }

  isAbove(plan: PlanKey): boolean {
    if (this.plans.current === 'takeaway') return plan !== 'takeaway';
    return PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(this.plans.current);
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
