import { Component, OnInit, ViewChild, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { GestionService, Table } from 'src/app/services/gestionService';
import Chart from 'chart.js/auto';
import { ConfirmService } from 'src/app/components/confirm-dialog/confirm-dialog.component';

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

const SHIFT_KEY = 'balance_shift_start';

@Component({
  selector: 'app-balance',
  templateUrl: './balance.component.html',
  styleUrls: ['./balance.component.scss']
})
export class BalanceComponent implements OnInit, AfterViewInit, OnDestroy {
  // Todo el historial; balanceData es lo que se ve (todo, o solo lo cobrado desde que se comenzó el turno)
  private allData: BalanceEntry[] = [];
  balanceData: BalanceEntry[] = [];
  // Cuándo se comenzó el turno actual (en este dispositivo). Solo cambia lo que se muestra: el historial no se borra.
  shiftStart: Date | null = this.readShiftStart();
  totalRevenue: number = 0;
  @ViewChild('tableChart') tableChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('waiterChart') waiterChartRef!: ElementRef<HTMLCanvasElement>;

  private tableChart: Chart | null = null;
  private waiterChart: Chart | null = null;

  constructor(private gestionService: GestionService, private confirmDialog: ConfirmService) {}

  ngOnInit(): void {
    // Limpiar cualquier rastro antiguo de localBalances
    localStorage.removeItem('localBalances');
    this.loadBalance();
  }

  ngAfterViewInit(): void {
    // Intentar renderizar charts si los datos ya están cargados
    if (this.balanceData && this.balanceData.length) {
      this.renderCharts();
    }
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

  calculateTotalRevenue(): void {
    this.totalRevenue = this.balanceData.reduce((sum, entry) => sum + entry.totalAmount, 0);
  }

  private renderCharts(): void {
    // Preparar conteos
    const tableCounts: Record<string, number> = {};
    const waiterCounts: Record<string, number> = {};

    this.balanceData.forEach(entry => {
      const t = entry.tableName || 'Sin mesa';
      const w = entry.waiterName || 'Sin mozo';
      tableCounts[t] = (tableCounts[t] || 0) + 1;
      waiterCounts[w] = (waiterCounts[w] || 0) + 1;
    });

    const sortByCount = (obj: Record<string, number>) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // top 10

    const topTables = sortByCount(tableCounts);
    const topWaiters = sortByCount(waiterCounts);

    const tableLabels = topTables.map(t => t[0]);
    const tableData = topTables.map(t => t[1]);

    const waiterLabels = topWaiters.map(w => w[0]);
    const waiterData = topWaiters.map(w => w[1]);

    // Destruir charts previos si existen
    if (this.tableChart) {
      this.tableChart.destroy();
      this.tableChart = null;
    }
    if (this.waiterChart) {
      this.waiterChart.destroy();
      this.waiterChart = null;
    }

    // Crear gráficos (si hay datos)
    try {
      const tableCtx = this.tableChartRef?.nativeElement?.getContext?.('2d');
      if (tableCtx && tableLabels.length) {
        this.tableChart = new Chart(tableCtx, {
          type: 'bar',
          data: {
            labels: tableLabels,
            datasets: [
              {
                label: 'Mesas más ocupadas',
                data: tableData,
                backgroundColor: 'rgba(34,197,94,0.8)'
              }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } }
          }
        });
      }
      const waiterCtx = this.waiterChartRef?.nativeElement?.getContext?.('2d');
      if (waiterCtx && waiterLabels.length) {
        this.waiterChart = new Chart(waiterCtx, {
          type: 'bar',
          data: {
            labels: waiterLabels,
            datasets: [
              {
                label: 'Mozos (mesas atendidas)',
                data: waiterData,
                backgroundColor: 'rgba(59,130,246,0.8)'
              }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } }
          }
        });
      }
    } catch (err) {
      console.error('Error al renderizar charts:', err);
    }
  }

  ngOnDestroy(): void {
    if (this.tableChart) this.tableChart.destroy();
    if (this.waiterChart) this.waiterChart.destroy();
  }
  
  // Comenzar un turno nuevo: las ventas anteriores dejan de contarse en pantalla, pero siguen guardadas
  startNewShift(): void {
    this.confirmDialog
      .ask({
        title: '¿Comenzar un turno nuevo?',
        message: 'El balance va a mostrar solo lo que se cobre desde ahora. No se borra nada: el historial y los reportes se conservan, y podés volver a ver todo cuando quieras.',
        confirmText: 'Comenzar turno',
        icon: 'restart_alt',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.shiftStart = new Date();
        try {
          localStorage.setItem(SHIFT_KEY, this.shiftStart.toISOString());
        } catch {}
        this.applyShift();
      });
  }

  showAllHistory(): void {
    this.shiftStart = null;
    try {
      localStorage.removeItem(SHIFT_KEY);
    } catch {}
    this.applyShift();
  }

  private applyShift(): void {
    const from = this.shiftStart?.getTime();
    this.balanceData = from === undefined ? this.allData : this.allData.filter((e) => !!e.date && new Date(e.date).getTime() >= from);
    this.calculateTotalRevenue();
    this.renderCharts();
  }

  private readShiftStart(): Date | null {
    try {
      const raw = localStorage.getItem(SHIFT_KEY);
      const d = raw ? new Date(raw) : null;
      return d && !isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
}