import { Component, Input } from '@angular/core';
import { FEATURE_LABELS, PLAN_INFO, PlanKey, PlanService } from 'src/app/services/plan.service';

// Pantalla que reemplaza a una sección que el plan del local no incluye: explica qué se gana y deja pedir el cambio
@Component({
  selector: 'app-upgrade-wall',
  templateUrl: './upgrade-wall.component.html',
})
export class UpgradeWallComponent {
  @Input() feature = '';
  // texto opcional de lo que se puede hacer con la sección (si no, se usa solo el nombre)
  @Input() benefit = '';

  constructor(public plans: PlanService) {}

  get title(): string {
    return FEATURE_LABELS[this.feature] ?? 'Esta función';
  }

  get needed(): PlanKey {
    return this.plans.needed(this.feature);
  }

  get neededLabel(): string {
    return PLAN_INFO[this.needed].label;
  }

  // Lo que suma el plan al que conviene pasarse (sin la línea "Todo lo de ...")
  get gains(): string[] {
    const target = this.plans.target(this.feature);
    return target ? PLAN_INFO[target].includes.filter((i) => !i.startsWith('Todo lo de')) : [];
  }

  get targetLabel(): string {
    const target = this.plans.target(this.feature);
    return target ? PLAN_INFO[target].label : '';
  }
}
