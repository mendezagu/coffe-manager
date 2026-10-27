import { Component } from '@angular/core';
import { PLAN_INFO, PLAN_ORDER, PlanKey, PlanService } from 'src/app/services/plan.service';

// Ícono y tono de cada plan (el tono se usa en las clases de la plantilla)
const PLAN_ICON: Record<PlanKey, string> = { basic: 'storefront', pro: 'rocket_launch', benefits: 'diamond' };

// "Tu plan": los tres planes lado a lado, con el actual marcado y el pedido de cambio por WhatsApp
@Component({
  selector: 'app-plan-page',
  templateUrl: './plan.component.html',
})
export class PlanPageComponent {
  readonly order = PLAN_ORDER;
  readonly info = PLAN_INFO;

  constructor(public plans: PlanService) {}

  icon(plan: PlanKey): string {
    return PLAN_ICON[plan];
  }

  isCurrent(plan: PlanKey): boolean {
    return this.plans.current === plan;
  }

  isAbove(plan: PlanKey): boolean {
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
