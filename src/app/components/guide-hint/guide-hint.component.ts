import { Component, Input } from '@angular/core';
import { OnboardingService } from 'src/app/services/onboarding.service';

// Cartel de la guía de la primera venta: dice qué hacer en el paso actual. Solo se ve mientras la guía está activa
// (administrador, con menú, mesas y mozo cargados y ninguna venta todavía).
@Component({
  selector: 'app-guide-hint',
  template: `
    <div *ngIf="onboarding.guideActive$ | async" role="note"
      class="flex items-start gap-2.5 rounded-xl border border-cafe-amber-300 bg-cafe-amber-50 p-2.5 text-left shadow-sm">
      <span class="grid h-7 w-7 flex-none place-items-center rounded-full bg-cafe-amber-700 text-xs font-extrabold text-white" aria-hidden="true">{{ step }}</span>
      <p class="m-0 min-w-0 text-xs leading-snug text-cafe-amber-900">
        <strong class="block text-[11px] font-bold uppercase tracking-wide text-cafe-amber-700">Paso {{ step }} de 5 · {{ title }}</strong>
        {{ text }}
      </p>
    </div>
  `,
})
export class GuideHintComponent {
  @Input() step = 1;
  @Input() title = '';
  @Input() text = '';

  constructor(public onboarding: OnboardingService) {}
}
