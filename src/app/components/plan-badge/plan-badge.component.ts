import { Component, Input } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SettingsService } from 'src/app/services/settings.service';

type PlanKey = 'basic' | 'pro' | 'benefits';

const FALLBACK_LABELS: Record<PlanKey, string> = { basic: 'Esencial', pro: 'Pro', benefits: 'Beneficios' };
const ORDER: PlanKey[] = ['basic', 'pro', 'benefits'];

interface BadgeView {
  label: string;
  plan: PlanKey;
  locked: boolean; // el plan del negocio no la incluye
}

// Etiqueta con el plan al que pertenece una función. Si el plan del negocio no la incluye, muestra un candado.
// Uso: <app-plan-badge feature="reservations"></app-plan-badge>  ·  <app-plan-badge plan="basic"></app-plan-badge>
@Component({
  selector: 'app-plan-badge',
  templateUrl: './plan-badge.component.html',
})
export class PlanBadgeComponent {
  @Input() feature = '';
  @Input() plan: PlanKey | '' = '';

  view$: Observable<BadgeView | null>;

  constructor(settings: SettingsService) {
    this.view$ = settings.settings$.pipe(
      map((s) => {
        const featurePlans = (s as any).featurePlans as Record<string, PlanKey> | undefined;
        const labels = ((s as any).planLabels as Record<PlanKey, string> | undefined) ?? FALLBACK_LABELS;
        const needed: PlanKey | undefined = this.plan || (featurePlans ? featurePlans[this.feature] : undefined);
        // Lo que trae el plan base no se etiqueta: las etiquetas marcan solo lo que suma Pro o Beneficios
        if (!needed || needed === 'basic') return null;
        const current = ORDER.indexOf(s.plan as PlanKey);
        return { label: labels[needed] ?? FALLBACK_LABELS[needed], plan: needed, locked: current >= 0 && ORDER.indexOf(needed) > current };
      }),
    );
  }

  styleOf(plan: PlanKey): string {
    return plan === 'benefits' ? 'plan-pill plan-pill--benefits' : 'plan-pill plan-pill--pro';
  }
}
