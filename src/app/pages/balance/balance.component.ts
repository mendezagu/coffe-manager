import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { GestionService } from 'src/app/services/gestionService';
import Chart from 'chart.js/auto';
import { ConfirmService } from 'src/app/components/confirm-dialog/confirm-dialog.component';
import { ShiftService } from 'src/app/services/shift.service';
import { PlanService } from 'src/app/services/plan.service';
import { SettingsService } from 'src/app/services/settings.service';
import { Subscription } from 'rxjs';

interface SaleItem {
  name: string;
  unitPrice: number;
  quantity: number;
  note: string;
  isPromo: boolean;
  discountPct: number;
  lineTotal: number;
  modifiers?: { group: string; name: string; priceDelta: number }[];
}

interface BalanceEntry {
  _id?: string;
  tableName: string;
  waiterName: string;
  totalAmount: number;
  paymentMethod?: string;
  source?: string; // mostrador | mesa
  takeaway?: boolean;
  date?: string;
  cashierName?: string;
  grossTotal?: number;
  discountTotal?: number;
  globalDiscountPct?: number;
  items?: SaleItem[];
  tipAmount?: number;
  payments?: { method: string; amount: number; tendered: number | null; change: number }[];
  // solo de pantalla
  expanded?: boolean;
  loadingDetail?: boolean;
  detailError?: boolean;
}

type BalanceView = 'mesas' | 'takeaway';

const GREEN = '#2e7a57';
const AMBER = '#d49a12';
const BLUE = '#3b82a8';
const GRID = { color: 'rgba(128,128,128,.18)' };

@Component({
  selector: 'app-balance',
  templateUrl: './balance.component.html',
  styleUrls: ['./balance.component.scss']
})
export class BalanceComponent implements OnInit, OnDestroy {
  // allData es todo lo guardado; balanceData es lo que se ve: solo lo cobrado desde que se comenzó el turno.
  // Las ventas no se borran: el historial completo está en Reportes.
  private allData: BalanceEntry[] = [];
  balanceData: BalanceEntry[] = [];
  shiftStart: Date | null = this.shift.start;
  totalRevenue: number = 0;

  // Lo que se lista y se suma en la pestaña activa (mesas o takeaway)
  rows: BalanceEntry[] = [];
  countMesas = 0;
  countTakeaway = 0;
  trackEntry = (_: number, e: BalanceEntry) => e._id ?? e.date;

  @ViewChild('tableChart') tableChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('waiterChart') waiterChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('methodChart') methodChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('hourChart') hourChartRef!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  // Pestaña elegida (solo cuando el negocio vende por mesas y por takeaway)
  view: BalanceView = 'mesas';

  constructor(
    private gestionService: GestionService,
    private confirmDialog: ConfirmService,
    private shift: ShiftService,
    public plans: PlanService,
    private settings: SettingsService,
  ) {}

  private shiftSub?: Subscription;
  private settingsSub?: Subscription;

  // ---- Qué se muestra según cómo vende el negocio ----

  // ¿Ya se sabe el plan? (hasta entonces no se arma nada, para que no parpadee la vista equivocada)
  get ready(): boolean {
    return this.plans.loaded;
  }

  private get hasSalon(): boolean {
    return this.plans.showTables;
  }

  private get hasCounter(): boolean {
    return this.plans.showCounter && this.plans.has('counter_sales');
  }

  // Mesas y takeaway a la vez: dos pestañas
  get hasTabs(): boolean {
    return this.hasSalon && this.hasCounter;
  }

  // Un negocio sin salón (solo mostrador) ve solo el balance de takeaway
  get activeView(): BalanceView {
    if (!this.hasSalon && this.hasCounter) return 'takeaway';
    return this.hasTabs ? this.view : 'mesas';
  }

  setView(view: BalanceView): void {
    if (this.view === view) return;
    this.view = view;
    this.recompute();
  }

  ngOnInit(): void {
    // Limpiar cualquier rastro antiguo de localBalances
    localStorage.removeItem('localBalances');
    this.loadBalance();
    // El turno es del negocio: si otro dispositivo comienza uno nuevo, esta pantalla se pone en cero sola
    this.shiftSub = this.shift.start$.subscribe((s) => {
      this.shiftStart = s;
      this.applyShift();
    });
    this.shift.refresh();
    // el plan y el modo de venta llegan del servidor: al saberlos se arma la vista que corresponde
    this.settingsSub = this.settings.settings$.subscribe(() => this.recompute());
  }

  loadBalance(): void {
    // Solo cargar desde el backend para evitar duplicados
    this.gestionService.getBalance().subscribe({
      next: (data: BalanceEntry[]) => {
        this.allData = data.map(entry => ({
          ...entry,
          paymentMethod: entry.paymentMethod || 'efectivo' // Si el backend no lo trae, por defecto
        }));
        this.applyShift();
      },
      error: (error) => {
        console.error('Error al obtener el balance:', error);
      },
    });
  }

  methodLabel(method: string): string {
    return ({ efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'Código QR', tarjeta: 'Tarjeta', mixto: 'Mixto' } as Record<string, string>)[method] ?? method;
  }

  modifierNames(item: SaleItem): string {
    return (item.modifiers ?? []).map((m) => m.name).join(', ');
  }

  // Cómo salió una venta de takeaway
  howLabel(entry: BalanceEntry): string {
    return entry.takeaway ? 'Para llevar' : 'Lo consume acá';
  }

  // Abre o cierra el detalle de una venta (se pide al servidor la primera vez)
  toggleDetail(entry: BalanceEntry): void {
    entry.expanded = !entry.expanded;
    if (!entry.expanded || entry.items || entry.loadingDetail || !entry._id) return;
    entry.loadingDetail = true;
    entry.detailError = false;
    this.gestionService.getBalanceDetail(entry._id).subscribe({
      next: (sale) => {
        entry.items = sale.items ?? [];
        entry.payments = sale.payments ?? [];
        entry.loadingDetail = false;
      },
      error: () => {
        entry.loadingDetail = false;
        entry.detailError = true;
      },
    });
  }

  // Recalcula lo que se ve según la pestaña: las ventas de mostrador son el takeaway; el resto, mesas
  private recompute(): void {
    const tabs = this.hasTabs;
    const takeaway = this.balanceData.filter((e) => e.source === 'mostrador');
    const mesas = this.balanceData.filter((e) => e.source !== 'mostrador');
    this.countMesas = mesas.length;
    this.countTakeaway = takeaway.length;

    const view = this.activeView;
    const shown = tabs ? (view === 'takeaway' ? takeaway : mesas) : this.balanceData;
    // en takeaway, lo último primero
    this.rows = view === 'takeaway' ? [...shown].reverse() : shown;
    this.totalRevenue = shown.reduce((sum, entry) => sum + entry.totalAmount, 0);
    this.renderCharts();
  }

  private destroyCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }

  private renderCharts(): void {
    // después de que Angular arme la vista: un gráfico creado en un recuadro que todavía no se muestra sale con tamaño cero
    setTimeout(() => {
      this.destroyCharts();
      try {
        if (this.activeView === 'takeaway') this.renderSalesCharts();
        else this.renderTableCharts();
      } catch (err) {
        console.error('Error al renderizar charts:', err);
      }
    });
  }

  // Mesas: qué mesas se usaron más y cuántas atendió cada mozo
  private renderTableCharts(): void {
    const tableCounts: Record<string, number> = {};
    const waiterCounts: Record<string, number> = {};
    this.rows.forEach((entry) => {
      const t = entry.tableName || 'Sin mesa';
      const w = entry.waiterName || 'Sin mozo';
      tableCounts[t] = (tableCounts[t] || 0) + 1;
      waiterCounts[w] = (waiterCounts[w] || 0) + 1;
    });
    const top = (obj: Record<string, number>) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const tables = top(tableCounts);
    const waiters = top(waiterCounts);
    const options = {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: GRID }, x: { grid: { display: false } } },
    };

    const tableCtx = this.tableChartRef?.nativeElement?.getContext?.('2d');
    if (tableCtx && tables.length) {
      this.charts.push(new Chart(tableCtx, { type: 'bar', data: { labels: tables.map((t) => t[0]), datasets: [{ label: 'Mesas más ocupadas', data: tables.map((t) => t[1]), backgroundColor: AMBER, borderRadius: 6 }] }, options }));
    }
    const waiterCtx = this.waiterChartRef?.nativeElement?.getContext?.('2d');
    if (waiterCtx && waiters.length) {
      this.charts.push(
        new Chart(waiterCtx, {
          type: 'doughnut',
          data: { labels: waiters.map((w) => w[0]), datasets: [{ data: waiters.map((w) => w[1]), backgroundColor: [GREEN, AMBER, BLUE, '#b5533c', '#7a4a28', '#7a6bb5'], borderWidth: 0 }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed} ${Number(c.parsed) === 1 ? 'mesa' : 'mesas'}` } } },
          },
        }),
      );
    }
  }

  // Takeaway: cómo pagan y a qué hora se vende
  private renderSalesCharts(): void {
    const palette = [GREEN, AMBER, BLUE, '#b5533c', '#7a4a28', '#7a6bb5'];

    const byMethod = new Map<string, number>();
    this.rows.forEach((e) => {
      const label = this.methodLabel(e.paymentMethod || 'efectivo');
      byMethod.set(label, (byMethod.get(label) ?? 0) + e.totalAmount);
    });
    const mCtx = this.methodChartRef?.nativeElement?.getContext?.('2d');
    if (mCtx && byMethod.size) {
      this.charts.push(
        new Chart(mCtx, {
          type: 'doughnut',
          data: { labels: [...byMethod.keys()], datasets: [{ data: [...byMethod.values()], backgroundColor: palette, borderWidth: 0 }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
              legend: { position: 'bottom' },
              tooltip: { callbacks: { label: (c) => ` ${c.label}: ${this.settings.format(Number(c.parsed))}` } },
            },
          },
        }),
      );
    }

    // por hora: solo entre la primera y la última hora con ventas
    const byHour = new Map<number, number>();
    this.rows.forEach((e) => {
      if (!e.date) return;
      const h = new Date(e.date).getHours();
      byHour.set(h, (byHour.get(h) ?? 0) + 1);
    });
    const hCtx = this.hourChartRef?.nativeElement?.getContext?.('2d');
    if (hCtx && byHour.size) {
      const hours = [...byHour.keys()];
      const from = Math.min(...hours);
      const to = Math.max(...hours);
      const labels: string[] = [];
      const data: number[] = [];
      for (let h = from; h <= to; h++) {
        labels.push(`${h}h`);
        data.push(byHour.get(h) ?? 0);
      }
      this.charts.push(
        new Chart(hCtx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Ventas', data, backgroundColor: AMBER, borderRadius: 6 }] },
          options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: GRID }, x: { grid: { display: false } } } },
        }),
      );
    }
  }

  ngOnDestroy(): void {
    this.shiftSub?.unsubscribe();
    this.settingsSub?.unsubscribe();
    this.destroyCharts();
  }

  // Comenzar un turno nuevo: las ventas anteriores dejan de contarse en pantalla, pero siguen guardadas
  startNewShift(): void {
    this.confirmDialog
      .ask({
        title: '¿Comenzar un turno nuevo?',
        message: 'El Balance y el Inicio van a arrancar en cero y a contar solo lo que se cobre desde ahora. No se borra nada: todo el historial queda en Reportes.',
        confirmText: 'Comenzar turno',
        icon: 'restart_alt',
      })
      .subscribe((ok) => {
        if (!ok) return;
        // El turno queda guardado en el servidor: todos los dispositivos del negocio arrancan en cero
        this.shift.begin().subscribe({
          next: (d) => {
            this.shiftStart = d;
            this.applyShift();
          },
          error: () => alert('No se pudo comenzar el turno. Revisá la conexión e intentá de nuevo.'),
        });
      });
  }

  private applyShift(): void {
    const from = this.shiftStart?.getTime();
    this.balanceData = from === undefined ? this.allData : this.allData.filter((e) => !!e.date && new Date(e.date).getTime() >= from);
    this.recompute();
  }

}
