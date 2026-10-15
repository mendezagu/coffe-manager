import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';

export const PAYMENT_METHODS = [
  { value: 'efectivo', label: '💵 Efectivo' },
  { value: 'transferencia', label: '🏦 Transferencia' },
  { value: 'qr', label: '📱 Código QR' },
  { value: 'tarjeta', label: '💳 Tarjeta' },
];

// Una fila = una persona o un método (según cómo se arme el pago)
interface PayRow {
  method: string;
  amount: number;
  tendered: number | null; // solo efectivo: lo que entrega el cliente
}

// Lo que el cobro necesita saber de este panel
export interface PaymentValue {
  tip: number;
  due: number; // cuenta + propina: lo que hay que cobrar en total
  payments: { method: string; amount: number; tendered?: number }[];
  valid: boolean;
  remaining: number; // lo que falta (>0) o sobra (<0) respecto de lo que hay que cobrar
  change: number; // vuelto total en efectivo
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Propina, método(s) de pago, vuelto y división en partes iguales.
// Nunca decide el importe de la cuenta: eso lo calcula el servidor; acá solo se arma cómo se paga.
@Component({
  selector: 'app-payment-panel',
  templateUrl: './payment-panel.component.html',
})
export class PaymentPanelComponent implements OnInit, OnChanges {
  @Input() total = 0; // la cuenta, ya con descuentos y sin propina
  @Input() tipEnabled = false;
  @Input() tipSuggestedPct = 10;
  @Output() valueChange = new EventEmitter<PaymentValue>();

  methods = PAYMENT_METHODS;
  rows: PayRow[] = [{ method: 'efectivo', amount: 0, tendered: null }];

  // Propina: ninguna, un porcentaje de la cuenta, o un monto libre
  tipMode: 'none' | 'pct' | 'custom' = 'none';
  tipPct = 0;
  tipCustom: number | null = null;

  // Partes iguales: cantidad de personas (1 = no se divide)
  splitN = 1;

  ngOnInit() {
    this.sync();
  }

  ngOnChanges() {
    this.sync();
  }

  // ---- propina ----

  get tipPresets(): number[] {
    // el sugerido primero, y algunos más para elegir rápido
    return [...new Set([this.tipSuggestedPct, 10, 15, 20])].filter((p) => p > 0).sort((a, b) => a - b);
  }

  get tip(): number {
    if (!this.tipEnabled) return 0;
    if (this.tipMode === 'pct') return round2((this.total * this.tipPct) / 100);
    if (this.tipMode === 'custom') return round2(Math.max(0, Number(this.tipCustom) || 0));
    return 0;
  }

  get due(): number {
    return round2(this.total + this.tip);
  }

  setNoTip() {
    this.tipMode = 'none';
    this.tipPct = 0;
    this.sync();
  }

  setTipPct(pct: number) {
    this.tipMode = 'pct';
    this.tipPct = pct;
    this.sync();
  }

  setTipCustom() {
    this.tipMode = 'custom';
    this.sync();
  }

  // ---- filas de pago ----

  addRow() {
    const used = new Set(this.rows.map((r) => r.method));
    const method = this.methods.find((m) => !used.has(m.value))?.value ?? 'efectivo';
    this.splitN = 1;
    this.rows.push({ method, amount: 0, tendered: null });
    this.fillLast();
    this.emit();
  }

  removeRow(index: number) {
    if (this.rows.length <= 1) return;
    this.rows.splice(index, 1);
    if (this.splitN > 1) this.splitN = this.rows.length;
    this.sync();
  }

  // index: la fila cuyo importe se tocó. El resto se acomoda: la última fila toma lo que falta.
  onRowChange(index?: number) {
    if (index !== undefined) this.fillLast(index);
    this.emit();
  }

  // Con varios métodos, la última fila se completa sola con lo que falta cobrar
  private fillLast(changedIndex = -1) {
    if (this.splitN > 1 || this.rows.length < 2) return;
    const last = this.rows.length - 1;
    if (changedIndex === last) return; // si la toca la persona, se respeta lo que escribió
    const others = round2(this.rows.slice(0, last).reduce((s, r) => s + (Number(r.amount) || 0), 0));
    this.rows[last].amount = Math.max(0, round2(this.due - others));
  }

  // Al cambiar el método de una fila, el "recibido" deja de tener sentido si ya no es efectivo
  onMethodChange(row: PayRow) {
    if (row.method !== 'efectivo') row.tendered = null;
    this.emit();
  }

  // ---- partes iguales ----

  setSplit(n: number) {
    const count = Math.max(1, Math.min(20, Math.floor(Number(n) || 1)));
    this.splitN = count;
    this.rows = Array.from({ length: count }, (_, i) => this.rows[i] ?? { method: 'efectivo', amount: 0, tendered: null });
    this.rows.forEach((r) => (r.tendered = null));
    this.sync();
  }

  // Reparte `total` en `n` partes que suman exacto: los centavos sobrantes van a las primeras personas
  private shares(total: number, n: number): number[] {
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / n);
    const extra = cents - base * n;
    return Array.from({ length: n }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
  }

  // ---- cálculo ----

  get paid(): number {
    return round2(this.rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0));
  }

  get remaining(): number {
    return round2(this.due - this.paid);
  }

  // Vuelto de una fila de efectivo (lo entregado menos lo que corresponde)
  changeOf(row: PayRow): number {
    if (row.method !== 'efectivo' || row.tendered === null || row.tendered === undefined) return 0;
    return round2(Math.max(0, Number(row.tendered) - Number(row.amount)));
  }

  cashShort(row: PayRow): boolean {
    return row.method === 'efectivo' && row.tendered !== null && row.tendered !== undefined && Number(row.tendered) < Number(row.amount);
  }

  // Con una sola fila o con partes iguales, los importes se acomodan solos a lo que hay que cobrar
  private sync() {
    if (this.splitN > 1) {
      const shares = this.shares(this.due, this.rows.length);
      this.rows.forEach((r, i) => (r.amount = shares[i]));
    } else if (this.rows.length === 1) {
      this.rows[0].amount = this.due;
    } else {
      this.rebalance();
    }
    this.emit();
  }

  // Con varios métodos, si lo que hay que cobrar cambia (ej: se tocó un descuento), las filas de arriba conservan lo
  // que se les cargó solo hasta donde alcanza, y la última toma el resto. Así los pagos nunca quedan con un importe
  // viejo (antes el efectivo seguía mostrando la cuenta de antes del descuento).
  private rebalance() {
    let left = this.due;
    const last = this.rows.length - 1;
    for (let i = 0; i < last; i++) {
      const kept = Math.min(Math.max(0, round2(Number(this.rows[i].amount) || 0)), left);
      this.rows[i].amount = kept;
      left = round2(left - kept);
    }
    this.rows[last].amount = Math.max(0, left);
  }

  private emit() {
    // El servidor admite un solo pago por método: las filas del mismo método se suman
    const byMethod = new Map<string, { amount: number; tendered: number | null; anyTendered: boolean }>();
    for (const r of this.rows) {
      const amount = round2(Number(r.amount) || 0);
      if (amount <= 0) continue;
      const entry = byMethod.get(r.method) ?? { amount: 0, tendered: 0, anyTendered: false };
      entry.amount = round2(entry.amount + amount);
      if (r.method === 'efectivo' && r.tendered !== null && r.tendered !== undefined) {
        entry.anyTendered = true;
        entry.tendered = round2((entry.tendered ?? 0) + Number(r.tendered));
      } else {
        entry.tendered = round2((entry.tendered ?? 0) + amount); // sin dato: se asume el importe exacto
      }
      byMethod.set(r.method, entry);
    }

    const payments = [...byMethod.entries()].map(([method, e]) => ({
      method,
      amount: e.amount,
      ...(method === 'efectivo' && e.anyTendered ? { tendered: e.tendered as number } : {}),
    }));

    const sum = round2(payments.reduce((s, p) => s + p.amount, 0));
    const due = this.due;
    const noShort = !this.rows.some((r) => this.cashShort(r));
    const valid = noShort && (due === 0 ? payments.length === 0 || sum === 0 : payments.length > 0 && sum === due);

    const value: PaymentValue = {
      tip: this.tip,
      due,
      payments,
      valid,
      remaining: round2(due - sum),
      change: round2(this.rows.reduce((s, r) => s + this.changeOf(r), 0)),
    };
    // Se emite después del ciclo de detección de cambios actual: así el diálogo que contiene este
    // panel no recibe un valor nuevo mientras ya está evaluando su propia plantilla.
    queueMicrotask(() => this.valueChange.emit(value));
  }
}
