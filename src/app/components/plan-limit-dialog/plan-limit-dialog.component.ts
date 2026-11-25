import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { OFFERED_PLANS, PLAN_INFO, PlanKey, PlanService } from 'src/app/services/plan.service';

export type LimitKind = 'tables' | 'menuItems' | 'waiters' | 'users';

export interface PlanLimitData {
  kind: LimitKind;
}

const NOUN: Record<LimitKind, string> = {
  tables: 'mesas',
  menuItems: 'platos en el menú',
  waiters: 'mozos',
  users: 'usuarios',
};

const ICON: Record<LimitKind, string> = {
  tables: 'table_restaurant',
  menuItems: 'restaurant_menu',
  waiters: 'person',
  users: 'group',
};

// Instagram de Tavolapp: la vía de contacto si no hay un WhatsApp de ventas configurado
const INSTAGRAM = 'https://instagram.com/tavolapp.app';

// ¿El error del servidor es por haber llegado a un tope del plan?
export const isPlanLimitError = (e: any): boolean => {
  const msg = e?.error?.message ?? e?.message ?? '';
  return /límite de tu plan|no incluye (mesas|mozos)/i.test(Array.isArray(msg) ? msg.join(' ') : String(msg));
};

// Se abre cuando alguien quiere crear algo que su plan no permite: explica el tope, muestra los planes y deja pedir el cambio.
@Component({
  selector: 'app-plan-limit-dialog',
  templateUrl: './plan-limit-dialog.component.html',
})
export class PlanLimitDialogComponent {
  static open(dialog: MatDialog, kind: LimitKind) {
    return dialog.open<PlanLimitDialogComponent, PlanLimitData>(PlanLimitDialogComponent, {
      data: { kind },
      width: '480px',
      maxWidth: '94vw',
      maxHeight: '92vh',
      panelClass: ['custom-dialog-container'],
      autoFocus: false,
    });
  }

  readonly instagram = INSTAGRAM;

  constructor(
    public plans: PlanService,
    private ref: MatDialogRef<PlanLimitDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PlanLimitData,
  ) {}

  get noun(): string {
    return NOUN[this.data.kind];
  }

  get icon(): string {
    return ICON[this.data.kind];
  }

  get max(): number | undefined {
    return this.plans.limit(this.data.kind);
  }

  // Los planes que hoy se ofrecen
  get options(): PlanKey[] {
    return OFFERED_PLANS;
  }

  info(plan: PlanKey) {
    return PLAN_INFO[plan];
  }

  // Las primeras líneas de cada plan, sin el "Todo lo de..."
  highlights(plan: PlanKey): string[] {
    return PLAN_INFO[plan].includes.filter((i) => !i.startsWith('Todo lo de')).slice(0, 8);
  }

  everything(plan: PlanKey): string {
    return PLAN_INFO[plan].includes.find((i) => i.startsWith('Todo lo de')) ?? '';
  }

  contactUrl(plan: PlanKey): string {
    return this.plans.whatsappUrl(plan) ?? INSTAGRAM;
  }

  close() {
    this.ref.close();
  }
}
