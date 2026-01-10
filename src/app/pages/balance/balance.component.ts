import { Component, OnInit, ViewChild, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { GestionService, Table } from 'src/app/services/gestionService';
import Chart from 'chart.js/auto';

interface BalanceEntry {
  tableName: string;
  waiterName: string;
  totalAmount: number;
  paymentMethod?: string;
}

@Component({
  selector: 'app-balance',
  templateUrl: './balance.component.html',
  styleUrls: ['./balance.component.scss']
})
export class BalanceComponent implements OnInit, AfterViewInit, OnDestroy {
  balanceData: BalanceEntry[] = [];
  totalRevenue: number = 0;
  @ViewChild('tableChart') tableChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('waiterChart') waiterChartRef!: ElementRef<HTMLCanvasElement>;

  private tableChart: Chart | null = null;
  private waiterChart: Chart | null = null;

  constructor(private gestionService: GestionService) {}

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
        this.balanceData = data.map(entry => ({
          ...entry,
          paymentMethod: entry.paymentMethod || 'efectivo' // Si el backend no lo trae, por defecto
        }));
        this.calculateTotalRevenue();
        this.renderCharts();
      },
      error: (error) => {
        console.error('Error al obtener el balance:', error);
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
  
  deleteBalance(): void {
    if (confirm('¿Estás seguro de que deseas eliminar todos los datos del balance?')) {
      this.gestionService.deleteAllBalances().subscribe({
        next: (response) => {
          console.log(response.message);
          this.balanceData = []; // Limpiar datos en el frontend
          this.totalRevenue = 0; // Reiniciar total recaudado
        },
        error: (error) => {
          console.error('Error al eliminar balance:', error);
        },
      });
    }
  }
}