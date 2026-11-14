import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { OfflineService, PendingSale } from 'src/app/services/offline.service';
import { SettingsService } from 'src/app/services/settings.service';

// Franja arriba de la pantalla: avisa cuando no hay conexión, cuántas ventas esperan para enviarse y si alguna fue rechazada.
// No aparece cuando todo está en orden.
@Component({
  selector: 'app-connection-banner',
  template: `
    <div *ngIf="state as s" [attr.role]="s.tone === 'bad' ? 'alert' : 'status'" aria-live="polite"
      class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm font-medium"
      [ngClass]="s.tone === 'bad' ? 'bg-cafe-red-50 text-cafe-red-700' : s.tone === 'warn' ? 'bg-cafe-amber-50 text-cafe-amber-800' : 'bg-cafe-green-50 text-cafe-green-800'">
      <mat-icon class="!h-5 !w-5 !text-xl flex-none" aria-hidden="true">{{ s.icon }}</mat-icon>
      <span class="min-w-0 flex-1">{{ s.text }}</span>
      <button *ngIf="offline.queue$.value.length" type="button" (click)="open()" class="min-h-[36px] rounded-lg px-3 font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">Ver ventas pendientes</button>
    </div>
  `,
})
export class ConnectionBannerComponent {
  constructor(public offline: OfflineService, private dialog: MatDialog) {}

  get state(): { tone: 'warn' | 'info' | 'bad'; icon: string; text: string } | null {
    const pending = this.offline.pendingCount;
    const failed = this.offline.failedCount;
    if (failed > 0) {
      return { tone: 'bad', icon: 'error_outline', text: `${failed} ${failed === 1 ? 'venta no se pudo registrar' : 'ventas no se pudieron registrar'}. Revisalas para no perder el cobro.` };
    }
    if (!this.offline.online$.value) {
      return {
        tone: 'warn',
        icon: 'cloud_off',
        text:
          'Sin conexión. El Mostrador sigue cobrando en efectivo y se envía solo cuando vuelva internet.' +
          (pending ? ` Hay ${pending} ${pending === 1 ? 'venta' : 'ventas'} por enviar.` : ''),
      };
    }
    if (pending > 0) {
      return { tone: 'info', icon: 'sync', text: `Enviando ${pending} ${pending === 1 ? 'venta' : 'ventas'} hechas sin conexión…` };
    }
    return null;
  }

  open() {
    this.dialog.open(PendingSalesDialogComponent, { width: '520px', maxWidth: '95vw' });
  }
}

@Component({
  selector: 'app-pending-sales-dialog',
  template: `
    <div class="p-5">
      <div role="heading" aria-level="2" class="font-jakarta text-lg font-bold text-sage-900">Ventas sin enviar</div>
      <p class="m-0 mt-1 text-sm text-sage-600">Se guardaron en este equipo mientras no había conexión. Se envían solas apenas vuelva internet.</p>

      <p *ngIf="!offline.queue$.value.length" class="mt-6 text-center text-sm text-sage-600">No hay ventas pendientes.</p>

      <ul class="m-0 mt-4 flex list-none flex-col gap-2 p-0">
        <li *ngFor="let s of offline.queue$ | async; trackBy: track" class="rounded-xl border border-sage-200 p-3">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="m-0 font-jakarta text-base font-bold tabular-nums text-sage-900">{{ settings.format(s.total) }}</p>
              <p class="m-0 text-sm text-sage-600">{{ s.createdAt | date: 'dd/MM HH:mm' }} · {{ s.cashierName || 'Mostrador' }} · {{ s.takeaway ? 'para llevar' : 'en el local' }}</p>
            </div>
            <span class="flex-none rounded-full px-3 py-1 text-xs font-bold" [ngClass]="s.status === 'failed' ? 'bg-cafe-red-50 text-cafe-red-700' : 'bg-cafe-amber-50 text-cafe-amber-800'">
              {{ s.status === 'failed' ? 'Rechazada' : 'Por enviar' }}
            </span>
          </div>
          <p *ngIf="s.error" class="m-0 mt-2 text-sm text-cafe-red-700">{{ s.error }}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button type="button" (click)="offline.retry(s.id)" class="min-h-[40px] rounded-lg border border-sage-300 px-3 text-sm font-bold text-sage-800 hover:bg-sage-50">Reintentar ahora</button>
            <button type="button" (click)="askDiscard(s.id)" class="min-h-[40px] rounded-lg px-3 text-sm font-bold text-cafe-red-700 hover:bg-cafe-red-50">
              {{ confirming === s.id ? 'Tocá de nuevo para descartar' : 'Descartar' }}
            </button>
          </div>
        </li>
      </ul>

      <div class="mt-5 flex justify-end">
        <button type="button" mat-dialog-close class="min-h-[44px] rounded-xl border border-sage-300 px-4 text-sm font-bold text-sage-800 hover:bg-sage-50">Cerrar</button>
      </div>
    </div>
  `,
})
export class PendingSalesDialogComponent {
  confirming = '';
  constructor(public offline: OfflineService, public settings: SettingsService) {}

  track = (_: number, s: PendingSale) => s.id;

  // Descartar borra la venta: pide un segundo toque para evitar un error
  askDiscard(id: string) {
    if (this.confirming === id) {
      this.offline.discard(id);
      this.confirming = '';
    } else {
      this.confirming = id;
    }
  }
}
