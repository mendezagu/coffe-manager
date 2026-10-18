import { Component, OnInit } from '@angular/core';
import { HotelsService, Partnership, apiMessage } from 'src/app/services/hotels.service';

// Los hoteles a los que el negocio está adherido. El administrador ajusta su descuento o pausa la alianza.
@Component({
  selector: 'app-hotel-partnerships',
  template: `
    <section *ngIf="rows.length" class="bg-white rounded-card shadow-soft p-4 mt-4" data-testid="partnerships">
      <h2 class="font-bold text-sage-800 mb-1">Hoteles aliados</h2>
      <p class="text-xs text-sage-500 mb-3">Los huéspedes de estos hoteles reciben un voucher con el descuento que fijes acá. Si pausás una alianza, deja de ofrecerse (los vouchers ya emitidos conservan su descuento).</p>
      <p *ngIf="error" role="alert" class="mb-3 px-3 py-2 rounded-lg bg-cafe-red-50 text-cafe-red-700 text-sm font-medium">{{ error }}</p>
      <ul class="m-0 p-0 list-none divide-y divide-sage-100">
        <li *ngFor="let p of rows" class="py-3 flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <p class="m-0 font-bold text-sage-900 truncate">{{ p.hotelName }}</p>
            <p class="m-0 text-xs" [ngClass]="p.active ? 'text-cafe-green-700' : 'text-sage-500'">{{ p.active ? 'Activa' : 'Pausada' }}</p>
          </div>
          <label class="flex items-center gap-2 text-sm text-sage-700">
            Descuento
            <input type="number" min="1" max="100" step="1" [ngModel]="p.discountPct" (ngModelChange)="draft[p.id] = $event"
              class="w-20 px-2 py-1.5 border border-sage-200 rounded-lg text-sm text-center" [attr.aria-label]="'Descuento para ' + p.hotelName" />
            %
          </label>
          <button type="button" (click)="saveDiscount(p)" [disabled]="busy === p.id || !changed(p)"
            class="px-3 py-1.5 bg-cafe-green-700 hover:bg-cafe-green-800 text-white font-bold text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Guardar</button>
          <button type="button" (click)="toggle(p)" [disabled]="busy === p.id"
            class="px-3 py-1.5 bg-white text-sage-700 font-bold text-xs rounded-lg border border-sage-200 disabled:opacity-50">{{ p.active ? 'Pausar' : 'Reactivar' }}</button>
        </li>
      </ul>
    </section>
  `,
})
export class HotelPartnershipsComponent implements OnInit {
  rows: Partnership[] = [];
  draft: Record<string, number> = {};
  busy: string | null = null;
  error = '';

  constructor(private hotels: HotelsService) {}

  ngOnInit() {
    this.hotels.partnerships().subscribe({ next: (r) => (this.rows = r), error: () => (this.rows = []) });
  }

  changed(p: Partnership): boolean {
    const v = Number(this.draft[p.id]);
    return this.draft[p.id] !== undefined && v > 0 && v <= 100 && v !== p.discountPct;
  }

  saveDiscount(p: Partnership) {
    this.update(p, { discountPct: Number(this.draft[p.id]) });
  }

  toggle(p: Partnership) {
    this.update(p, { active: !p.active });
  }

  private update(p: Partnership, body: { discountPct?: number; active?: boolean }) {
    this.busy = p.id;
    this.error = '';
    this.hotels.updatePartnership(p.id, body).subscribe({
      next: (updated) => {
        this.rows = this.rows.map((r) => (r.id === p.id ? updated : r));
        delete this.draft[p.id];
        this.busy = null;
      },
      error: (err) => {
        this.error = apiMessage(err, 'No se pudo guardar el cambio');
        this.busy = null;
      },
    });
  }
}
