import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GestionService, Waiter } from 'src/app/services/gestionService';
import { QrCall, QrRequest, QrService } from 'src/app/services/qr.service';
import { SettingsService } from 'src/app/services/settings.service';

export interface QrInboxData {
  tableId?: string; // solo los pedidos y avisos de esa mesa
}

const QUICK_REASONS = ['Se acabó', 'No lo tenemos hoy', 'La cocina está cerrada'];

// Bandeja del personal: pedidos que el cliente mandó desde su celular y avisos (mozo / cuenta).
@Component({
  selector: 'app-qr-inbox-dialog',
  templateUrl: './qr-inbox-dialog.component.html',
})
export class QrInboxDialogComponent implements OnInit {
  waiters: Waiter[] = [];
  waiterByRequest: Record<string, string> = {};
  busy = new Set<string>();

  // Pedido que se está rechazando (para pedir el motivo)
  rejecting: string | null = null;
  reason = '';
  quickReasons = QUICK_REASONS;

  constructor(
    public qr: QrService,
    private gestion: GestionService,
    private settings: SettingsService,
    private snackBar: MatSnackBar,
    private ref: MatDialogRef<QrInboxDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: QrInboxData | null,
  ) {}

  ngOnInit() {
    this.qr.refresh();
    this.gestion.getWaiters().subscribe({ next: (w) => (this.waiters = w), error: () => {} });
  }

  get requests(): QrRequest[] {
    const all = this.qr.value.requests;
    return this.data?.tableId ? all.filter((r) => r.tableId === this.data!.tableId) : all;
  }

  get calls(): QrCall[] {
    const all = this.qr.value.calls;
    return this.data?.tableId ? all.filter((c) => c.tableId === this.data!.tableId) : all;
  }

  get empty() {
    return this.requests.length === 0 && this.calls.length === 0;
  }

  callLabel(c: QrCall) {
    return c.type === 'BILL' ? 'Pide la cuenta' : 'Llama al mozo';
  }

  confirm(r: QrRequest) {
    if (this.busy.has(r.id)) return;
    this.busy.add(r.id);
    this.qr.confirm(r.id, this.waiterByRequest[r.id] || undefined).subscribe({
      next: () => {
        this.busy.delete(r.id);
        this.notify(`Pedido de ${r.tableName} confirmado${this.settings.value.kitchenEnabled ? ': ya está en la cocina' : ''}`);
        this.closeIfEmpty();
      },
      error: (err) => {
        this.busy.delete(r.id);
        this.notify(this.errorText(err, 'No se pudo confirmar el pedido'));
        this.qr.refresh();
      },
    });
  }

  startReject(r: QrRequest) {
    this.rejecting = r.id;
    this.reason = '';
  }

  reject(r: QrRequest) {
    if (this.busy.has(r.id)) return;
    this.busy.add(r.id);
    this.qr.reject(r.id, this.reason).subscribe({
      next: () => {
        this.busy.delete(r.id);
        this.rejecting = null;
        this.notify('Pedido rechazado: el cliente ve el motivo');
        this.closeIfEmpty();
      },
      error: (err) => {
        this.busy.delete(r.id);
        this.notify(this.errorText(err, 'No se pudo rechazar el pedido'));
        this.qr.refresh();
      },
    });
  }

  done(c: QrCall) {
    if (this.busy.has(c.id)) return;
    this.busy.add(c.id);
    this.qr.callDone(c.id).subscribe({
      next: () => {
        this.busy.delete(c.id);
        this.closeIfEmpty();
      },
      error: (err) => {
        this.busy.delete(c.id);
        this.notify(this.errorText(err, 'No se pudo marcar como atendido'));
      },
    });
  }

  close() {
    this.ref.close();
  }

  // En el diálogo de una sola mesa, al terminar con todo se cierra solo
  private closeIfEmpty() {
    setTimeout(() => {
      if (this.data?.tableId && this.empty) this.ref.close(true);
    }, 400);
  }

  private errorText(err: any, fallback: string) {
    const msg = err?.error?.message;
    return (Array.isArray(msg) ? msg.join('. ') : msg) || fallback;
  }

  private notify(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 4000 });
  }
}
