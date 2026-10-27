import { Component, Input } from '@angular/core';
import { PLAN_INFO, PlanKey, PlanService } from 'src/app/services/plan.service';

// Botón "Quiero pasarme a Pro / Beneficios": abre WhatsApp con el pedido ya escrito para el dueño de Tavolapp.
// Si el local ya tiene el plan más completo, no muestra nada.
@Component({
  selector: 'app-upgrade-button',
  templateUrl: './upgrade-button.component.html',
})
export class UpgradeButtonComponent {
  // Función por la que se pide el cambio (para que el mensaje diga qué necesita); sin ella se pide el plan siguiente
  @Input() feature = '';
  // compacto = botón chico para usar dentro de una línea de texto
  @Input() compact = false;

  constructor(private plans: PlanService) {}

  get target(): PlanKey | null {
    return this.plans.target(this.feature || undefined);
  }

  get label(): string {
    return this.target ? PLAN_INFO[this.target].label : '';
  }

  get url(): string | null {
    return this.target ? this.plans.whatsappUrl(this.target, this.feature || undefined) : null;
  }
}
