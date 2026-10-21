import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import Chart from 'chart.js/auto';
import { ReportsService, SalesReport } from 'src/app/services/reports.service';
import { SettingsService } from 'src/app/services/settings.service';

type Preset = 'today' | '7d' | '30d' | 'month' | 'custom';

// Colores de la marca (tailwind.config.js). Una sola tonalidad: en estos gráficos la longitud
// de la barra es el dato, y el nombre va en la etiqueta, no en el color.
const GREEN = '#1d5b3e';
const GREEN_HOVER = '#154630';
const INK = '#55655b'; // sage-600
const GRID = '#e0e7dc'; // sage-200

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  qr: 'Código QR',
  tarjeta: 'Tarjeta',
};

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit, OnDestroy {
  @ViewChild('dayChart') dayRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('itemsChart') itemsRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('waiterChart') waiterRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('paymentChart') paymentRef?: ElementRef<HTMLCanvasElement>;

  presets: { key: Preset; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: '7d', label: '7 días' },
    { key: '30d', label: '30 días' },
    { key: 'month', label: 'Este mes' },
    { key: 'custom', label: 'Otro rango' },
  ];
  preset: Preset = '30d';
  from = '';
  to = '';

  report: SalesReport | null = null;
  loading = false;
  error = '';
  showTables = false;

  // Ventas por hotel: con muchos hoteles se ven primero los que más vendieron y el resto se despliega
  readonly hotelsPreview = 5;
  hotelsExpanded = false;

  // La comisión se muestra si el negocio la tiene activa, o si hay comisión en el período (aunque ya la hayan apagado)
  get showCommission(): boolean {
    return !!this.report && (this.report.commission.enabled || this.report.summary.commissionTotal > 0);
  }

  get hotelRows() {
    const all = this.report?.byHotel ?? [];
    return this.hotelsExpanded ? all : all.slice(0, this.hotelsPreview);
  }
  itemsBy: 'amount' | 'quantity' | 'profit' = 'amount';

  private charts: Chart[] = [];

  constructor(private reports: ReportsService, public settings: SettingsService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.selectPreset('30d');
  }

  ngOnDestroy() {
    this.destroyCharts();
  }

  // ---- Rango ----

  selectPreset(preset: Preset) {
    this.preset = preset;
    if (preset === 'custom') return; // se aplica con las fechas elegidas
    const today = this.today();
    this.to = today;
    this.from =
      preset === 'today' ? today : preset === '7d' ? this.shift(today, -6) : preset === '30d' ? this.shift(today, -29) : `${today.slice(0, 8)}01`;
    this.load();
  }

  applyCustom() {
    if (this.from && this.to) this.load();
  }

  get rangeInvalid(): boolean {
    return !!this.from && !!this.to && this.from > this.to;
  }

  load() {
    if (this.rangeInvalid) return;
    this.loading = true;
    this.error = '';
    this.reports.sales(this.from, this.to).subscribe({
      next: (report) => {
        this.report = report;
        this.loading = false;
        this.cdr.detectChanges(); // los canvas existen recién cuando hay datos
        this.renderCharts();
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message;
        this.error = (Array.isArray(msg) ? msg.join('. ') : msg) || 'No se pudo cargar el reporte.';
      },
    });
  }

  setItemsBy(by: 'amount' | 'quantity' | 'profit') {
    this.itemsBy = by;
    this.renderCharts();
  }

  // ---- Datos derivados ----

  // Hay costos conocidos (inventario con recetas): se puede mostrar la ganancia
  get hasCosts(): boolean {
    return !!this.report && this.report.summary.costTotal > 0;
  }

  get hasSales(): boolean {
    return !!this.report && this.report.summary.salesCount > 0;
  }

  get topItems() {
    const list = [...(this.report?.items ?? [])];
    const value = (i: SalesReport['items'][number]) => (this.itemsBy === 'profit' ? i.profit ?? -Infinity : i[this.itemsBy]);
    return list.sort((a, b) => value(b) - value(a)).slice(0, 10);
  }

  paymentLabel(method: string): string {
    return PAYMENT_LABELS[method] ?? method;
  }

  dayLabel(iso: string): string {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  }

  // ---- Gráficos ----

  private renderCharts() {
    this.destroyCharts();
    const r = this.report;
    if (!r || !this.hasSales) return;
    const money = (v: number) => this.settings.format(v);

    this.bar(this.dayRef, r.byDay.map((d) => this.dayLabel(d.date)), r.byDay.map((d) => d.totalAmount), 'Ventas', money, {
      horizontal: false,
      afterLabel: (i) => `${r.byDay[i].salesCount} ${r.byDay[i].salesCount === 1 ? 'venta' : 'ventas'}`,
    });

    const items = this.topItems;
    const byQty = this.itemsBy === 'quantity';
    const byProfit = this.itemsBy === 'profit';
    this.bar(this.itemsRef, items.map((i) => i.name), items.map((i) => (byQty ? i.quantity : byProfit ? i.profit ?? 0 : i.amount)),
      byQty ? 'Unidades' : byProfit ? 'Ganancia' : 'Importe', byQty ? (v) => `${v} u.` : money, {
        horizontal: true,
        afterLabel: (i) => (byQty ? money(items[i].amount) : `${items[i].quantity} u.`),
      });

    this.bar(this.waiterRef, r.byWaiter.map((w) => w.name), r.byWaiter.map((w) => w.totalAmount), 'Ventas', money, {
      horizontal: true,
      afterLabel: (i) => `${r.byWaiter[i].salesCount} ${r.byWaiter[i].salesCount === 1 ? 'venta' : 'ventas'}`,
    });

    this.bar(this.paymentRef, r.byPayment.map((p) => this.paymentLabel(p.method)), r.byPayment.map((p) => p.totalAmount), 'Ventas', money, {
      horizontal: true,
      afterLabel: (i) => `${r.byPayment[i].salesCount} ${r.byPayment[i].salesCount === 1 ? 'venta' : 'ventas'}`,
    });
  }

  private bar(
    ref: ElementRef<HTMLCanvasElement> | undefined,
    labels: string[],
    data: number[],
    seriesName: string,
    format: (v: number) => string,
    opts: { horizontal: boolean; afterLabel: (index: number) => string },
  ) {
    const ctx = ref?.nativeElement.getContext('2d');
    if (!ctx) return;
    const horizontal = opts.horizontal;
    const valueAxis = {
      beginAtZero: true,
      grid: { color: GRID },
      border: { display: false },
      ticks: { color: INK, callback: (v: string | number) => format(Number(v)) },
    };
    const labelAxis = { grid: { display: false }, border: { color: GRID }, ticks: { color: INK, autoSkip: true, maxRotation: 0 } };

    this.charts.push(
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: seriesName,
              data,
              backgroundColor: GREEN,
              hoverBackgroundColor: GREEN_HOVER,
              // Barras finas con el extremo de datos redondeado, apoyadas en la línea base
              borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
              maxBarThickness: horizontal ? 18 : 28,
            },
          ],
        },
        options: {
          indexAxis: horizontal ? 'y' : 'x',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }, // una sola serie: el título de la tarjeta ya la nombra
            tooltip: {
              callbacks: {
                label: (c) => `${seriesName}: ${format(Number(c.parsed[horizontal ? 'x' : 'y']))}`,
                afterLabel: (c) => opts.afterLabel(c.dataIndex),
              },
            },
          },
          scales: horizontal ? { x: valueAxis, y: labelAxis } : { x: labelAxis, y: valueAxis },
        },
      }),
    );
  }

  private destroyCharts() {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }

  // ---- Fechas (calendario local del navegador, formato YYYY-MM-DD) ----

  private today(): string {
    return this.format(new Date());
  }

  private shift(day: string, days: number): string {
    const [y, m, d] = day.split('-').map(Number);
    return this.format(new Date(y, m - 1, d + days));
  }

  private format(date: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  }
}
