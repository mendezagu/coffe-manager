import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DeliveryOrder, DeliveryService } from 'src/app/services/delivery.service';
import { PlanService } from 'src/app/services/plan.service';
import { SettingsService } from 'src/app/services/settings.service';

interface Column {
  key: string;
  title: string;
  icon: string;
  statuses: DeliveryOrder['status'][];
}

// Pantalla "Pedidos online" del local: los pedidos que llegan desde la tienda (/delivery/<local>), de nuevos a entregados.
@Component({
  selector: 'app-delivery-orders',
  templateUrl: './delivery-orders.component.html',
})
export class DeliveryOrdersComponent implements OnInit {
  readonly columns: Column[] = [
    { key: 'new', title: 'Nuevos', icon: 'notifications_active', statuses: ['PENDING'] },
    { key: 'prep', title: 'En preparación', icon: 'restaurant', statuses: ['ACCEPTED'] },
    { key: 'ready', title: 'Listos', icon: 'check_circle', statuses: ['READY'] },
  ];

  busy = new Set<string>();
  error = '';
  showClosed = false;
  // Forma de cobro elegida al entregar (por defecto, la que eligió el cliente)
  payChoice: Record<string, string> = {};

  constructor(
    public delivery: DeliveryService,
    public settings: SettingsService,
    public plans: PlanService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.delivery.refresh();
  }

  get locked(): boolean {
    return this.plans.locked('online_store');
  }

  get link(): string | null {
    const slug = this.settings.value.menuSlug;
    return slug ? `${window.location.origin}/delivery/${slug}` : null;
  }

  copyLink() {
    const link = this.link;
    if (!link) return;
    navigator.clipboard?.writeText(link).then(
      () => this.notify('Dirección copiada'),
      () => this.notify('No se pudo copiar'),
    );
  }

  inColumn(orders: DeliveryOrder[], col: Column): DeliveryOrder[] {
    return orders.filter((o) => col.statuses.includes(o.status));
  }

  closed(orders: DeliveryOrder[]): DeliveryOrder[] {
    return orders.filter((o) => o.status === 'COMPLETED' || o.status === 'REJECTED' || o.status === 'CANCELLED').reverse();
  }

  statusLabel(s: DeliveryOrder['status']): string {
    return s === 'COMPLETED' ? 'Entregado' : s === 'REJECTED' ? 'Rechazado' : s === 'CANCELLED' ? 'Cancelado por el cliente' : s;
  }

  payLabel(m: string): string {
    return m === 'transfer' ? 'Transferencia' : 'Efectivo';
  }

  // El teléfono como número de WhatsApp (solo dígitos); si falta el código de país, se asume Argentina
  waLink(o: DeliveryOrder): string {
    const digits = o.phone.replace(/\D/g, '');
    const full = digits.startsWith('54') ? digits : `54${digits.replace(/^0+/, '')}`;
    const text = `Hola ${o.customerName}! Te escribimos por tu pedido #${o.number}.`;
    return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
  }

  pause(paused: boolean) {
    this.settings.update({ deliveryPaused: paused }).subscribe({
      next: () => this.notify(paused ? 'Pausaste la tienda: no recibe pedidos' : 'La tienda vuelve a recibir pedidos'),
      error: (err) => (this.error = this.text(err)),
    });
  }

  accept(o: DeliveryOrder) {
    this.run(o, this.delivery.accept(o.id));
  }

  ready(o: DeliveryOrder) {
    this.run(o, this.delivery.ready(o.id));
  }

  reject(o: DeliveryOrder) {
    const reason = window.prompt('Motivo para el cliente (opcional). Ej: nos quedamos sin stock', '');
    if (reason === null) return;
    this.run(o, this.delivery.reject(o.id, reason));
  }

  complete(o: DeliveryOrder) {
    const method = this.payChoice[o.id];
    this.run(o, this.delivery.complete(o.id, method), `Pedido #${o.number} entregado y cobrado`);
  }

  private run(o: DeliveryOrder, call: { subscribe: (observer: { next: () => void; error: (e: any) => void }) => unknown }, done?: string) {
    if (this.busy.has(o.id)) return;
    this.busy.add(o.id);
    this.error = '';
    call.subscribe({
      next: () => {
        this.busy.delete(o.id);
        if (done) this.notify(done);
      },
      error: (err) => {
        this.busy.delete(o.id);
        this.error = this.text(err);
        this.delivery.refresh();
      },
    });
  }

  private text(err: any): string {
    const msg = err?.error?.message;
    return (Array.isArray(msg) ? msg.join('. ') : msg) || 'No se pudo completar. Probá de nuevo.';
  }

  private notify(text: string) {
    this.snackBar.open(text, 'OK', { duration: 3000 });
  }

  trackOrder = (_: number, o: DeliveryOrder) => o.id;
}
