import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CashHistoryRow, CashRegisterSummary, CashService, CashState } from 'src/app/services/cash.service';
import { UserService } from 'src/app/services/user.service';

const METHOD_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  qr: 'Código QR',
  tarjeta: 'Tarjeta',
};

// Colores del gráfico por método de cobro (las clases van completas para que Tailwind las encuentre)
const METHOD_STYLES: Record<string, { stroke: string; dot: string }> = {
  efectivo: { stroke: 'text-cafe-green-700', dot: 'bg-cafe-green-700' },
  transferencia: { stroke: 'text-cafe-amber-500', dot: 'bg-cafe-amber-500' },
  qr: { stroke: 'text-cafe-green-300', dot: 'bg-cafe-green-300' },
  tarjeta: { stroke: 'text-cafe-red-500', dot: 'bg-cafe-red-500' },
};
const OTHER_STYLE = { stroke: 'text-sage-400', dot: 'bg-sage-400' };

export interface MethodRow {
  label: string;
  amount: number;
  count: number;
  pct: number;
  dash: string; // tramo del círculo (la circunferencia mide 100)
  offset: number;
  stroke: string;
  dot: string;
}

@Component({
  selector: 'app-cash',
  templateUrl: './cash.component.html',
})
export class CashComponent implements OnInit {
  state: CashState | null = null;
  loading = true;
  busy = false;
  isAdmin = false;

  // Abrir
  openingAmount: number | null = null;

  // Movimientos
  movement: { type: 'IN' | 'OUT'; amount: number | null; reason: string } = { type: 'OUT', amount: null, reason: '' };

  // Cerrar: el cajero cuenta el efectivo ANTES de ver cuánto "debería haber" (conteo a ciegas)
  closing = false;
  counted: number | null = null;
  closeNote = '';
  closedSummary: CashRegisterSummary | null = null;

  // Historial (solo admin)
  history: CashHistoryRow[] = [];
  expanded: Record<string, CashRegisterSummary | 'loading'> = {};

  constructor(private cash: CashService, private users: UserService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.isAdmin = this.users.currentRole() === 'admin';
    this.cash.refresh().subscribe({
      next: (s) => {
        this.state = s;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notify('No se pudo cargar la caja');
      },
    });
    if (this.isAdmin) this.loadHistory();
  }

  get register(): CashRegisterSummary | null {
    return this.state?.register ?? null;
  }

  // Conteo a ciegas: el servidor no manda el efectivo esperado (ni lo que permite deducirlo) a quien no es
  // admin mientras la caja está abierta. Acá solo se acomoda la pantalla a lo que llega.
  get blind(): boolean {
    return this.register?.cash.expected === null;
  }

  // Lo cobrado por método, con su porción del círculo. Vacío en el conteo a ciegas (no llegan los importes).
  get methodRows(): MethodRow[] {
    const rows = [...(this.register?.byMethod ?? [])].filter((m) => m.amount > 0).sort((a, b) => b.amount - a.amount);
    const total = rows.reduce((sum, m) => sum + m.amount, 0);
    if (total <= 0) return [];
    let used = 0;
    return rows.map((m) => {
      const pct = (m.amount / total) * 100;
      const style = METHOD_STYLES[m.method] ?? OTHER_STYLE;
      const row: MethodRow = {
        label: this.methodLabel(m.method),
        amount: m.amount,
        count: m.count,
        pct,
        dash: `${pct} ${100 - pct}`,
        offset: -used,
        ...style,
      };
      used += pct;
      return row;
    });
  }

  // Todo lo cobrado que no es efectivo (transferencia, QR, tarjeta)
  get nonCashTotal(): number {
    return (this.register?.byMethod ?? []).filter((m) => m.method !== 'efectivo').reduce((sum, m) => sum + m.amount, 0);
  }

  get nonCashPct(): number {
    const total = this.register?.sales.totalAmount ?? 0;
    return total > 0 ? (this.nonCashTotal / total) * 100 : 0;
  }

  get tipsPct(): number {
    const sales = this.register?.sales;
    return sales && sales.totalAmount && sales.tipsTotal !== null ? (sales.tipsTotal / sales.totalAmount) * 100 : 0;
  }

  // "Aylen Lupino" -> "AL"
  initials(name: string): string {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
  }

  methodLabel(method: string): string {
    return METHOD_LABELS[method] ?? method;
  }

  // ---- abrir ----

  open() {
    if (this.busy || this.openingAmount === null || this.openingAmount < 0) return;
    this.busy = true;
    this.cash.open(this.openingAmount).subscribe({
      next: () => {
        this.busy = false;
        this.openingAmount = null;
        this.closedSummary = null;
        this.reload('Caja abierta');
      },
      error: (err) => this.fail(err, 'No se pudo abrir la caja'),
    });
  }

  // ---- movimientos ----

  addMovement() {
    const m = this.movement;
    if (this.busy || !m.amount || m.amount <= 0 || !m.reason.trim()) return;
    this.busy = true;
    this.cash.addMovement({ type: m.type, amount: m.amount, reason: m.reason.trim() }).subscribe({
      next: () => {
        this.busy = false;
        this.movement = { type: m.type, amount: null, reason: '' };
        this.reload('Movimiento registrado');
      },
      error: (err) => this.fail(err, 'No se pudo registrar el movimiento'),
    });
  }

  // ---- cerrar ----

  startClose() {
    this.closing = true;
    this.counted = null;
    this.closeNote = '';
  }

  cancelClose() {
    this.closing = false;
  }

  confirmClose() {
    if (this.busy || this.counted === null || this.counted < 0) return;
    this.busy = true;
    this.cash.close({ countedAmount: this.counted, note: this.closeNote }).subscribe({
      next: (summary) => {
        this.busy = false;
        this.closing = false;
        this.closedSummary = summary;
        this.reload();
        if (this.isAdmin) this.loadHistory();
      },
      error: (err) => this.fail(err, 'No se pudo cerrar la caja'),
    });
  }

  dismissClosed() {
    this.closedSummary = null;
  }

  // ---- historial ----

  loadHistory() {
    this.cash.history().subscribe({ next: (rows) => (this.history = rows), error: () => {} });
  }

  toggleRow(row: CashHistoryRow) {
    if (this.expanded[row.id]) {
      delete this.expanded[row.id];
      return;
    }
    this.expanded[row.id] = 'loading';
    this.cash.detail(row.id).subscribe({
      next: (d) => (this.expanded[row.id] = d),
      error: () => {
        delete this.expanded[row.id];
        this.notify('No se pudo cargar el detalle');
      },
    });
  }

  detailOf(row: CashHistoryRow): CashRegisterSummary | null {
    const d = this.expanded[row.id];
    return d && d !== 'loading' ? d : null;
  }

  // ---- utilidades ----

  private reload(message?: string) {
    this.cash.refresh().subscribe({ next: (s) => (this.state = s), error: () => {} });
    if (message) this.notify(message);
  }

  private fail(err: any, fallback: string) {
    this.busy = false;
    const msg = err?.error?.message;
    this.notify((Array.isArray(msg) ? msg.join('. ') : msg) || fallback);
    this.reload();
  }

  private notify(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 3500 });
  }
}
