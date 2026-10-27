import { Component } from '@angular/core';
import { PLAN_INFO, PLAN_ORDER, PlanKey, PlanService } from 'src/app/services/plan.service';

// "Tu plan": los tres planes lado a lado, con el actual marcado y el pedido de cambio por WhatsApp
@Component({
  selector: 'app-plan-page',
  templateUrl: './plan.component.html',
})
export class PlanPageComponent {
  readonly order = PLAN_ORDER;
  readonly info = PLAN_INFO;

  constructor(public plans: PlanService) {}

  isCurrent(plan: PlanKey): boolean {
    return this.plans.current === plan;
  }

  isAbove(plan: PlanKey): boolean {
    return PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(this.plans.current);
  }

  url(plan: PlanKey): string | null {
    return this.plans.whatsappUrl(plan);
  }
}
