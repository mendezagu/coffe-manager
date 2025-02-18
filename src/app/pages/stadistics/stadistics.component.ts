import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { CoffeService, Table } from 'src/app/models/coffe.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);
//import jsPDF from 'jspdf';
//import 'jspdf-autotable';

interface Statistic {
  date: number;
  tableName: string;
  waiterName: string;
  revenue: number;
}

@Component({
  selector: 'app-stadistics',
  templateUrl: './stadistics.component.html',
  styleUrls: ['./stadistics.component.scss']
})
export class StadisticsComponent implements OnInit{
  statistics: Statistic[] = [];
  totalRevenue: number = 0;

   // Referencias a los gráficos
   tableChart!: Chart;
   waiterChart!: Chart;
   salesChart!: Chart;

  constructor(private firestore: AngularFirestore) {}

  ngOnInit(): void {
    this.loadStatistics();
    this.cleanupOldStatistics();
  }

  loadStatistics(): void {
    this.firestore.collection<Statistic>('daily_statistics').valueChanges().subscribe(data => {
      this.statistics = data;
      this.calculateTotalRevenue();
      this.generateCharts();
    });
  }

  calculateTotalRevenue(): void {
    this.totalRevenue = this.statistics.reduce((sum, stat) => sum + stat.revenue, 0);
  }

  generateCharts(): void {
    setTimeout(() => {
      this.createTableRevenueChart();
      this.createWaiterChart();
      this.createSalesByDayChart();
    }, 500); // Espera medio segundo para que el HTML cargue los canvas
  }

  createTableRevenueChart(): void {
    const tableRevenue: { [key: string]: number } = {};
    
    this.statistics.forEach(stat => {
      tableRevenue[stat.tableName] = (tableRevenue[stat.tableName] || 0) + stat.revenue;
    });

    const tableNames = Object.keys(tableRevenue);
    const revenues = Object.values(tableRevenue);

    if (this.tableChart) this.tableChart.destroy();
    
    this.tableChart = new Chart('tableRevenueChart', {
      type: 'bar',
      data: {
        labels: tableNames,
        datasets: [{
          label: 'Ingresos por Mesa ($)',
          data: revenues,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
          barThickness: 48
        }]
      }
    });
  }

  createWaiterChart(): void {
    const waiterStats: { [key: string]: number } = {};

    this.statistics.forEach(stat => {
      waiterStats[stat.waiterName] = (waiterStats[stat.waiterName] || 0) + 1;
    });

    const waiters = Object.keys(waiterStats);
    const assignedTables = Object.values(waiterStats);

    if (this.waiterChart) this.waiterChart.destroy();

    this.waiterChart = new Chart('waiterChart', {
      type: 'bar',
      data: {
        labels: waiters,
        datasets: [{
          label: 'Mesas Atendidas',
          data: assignedTables,
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
          barThickness: 48
        }]
      }
    });
  }

  createSalesByDayChart(): void {
    const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const salesByDay: { [key: string]: number } = {};

    this.statistics.forEach(stat => {
      const date = new Date(stat.date);
      const dayName = daysOfWeek[date.getDay()];
      salesByDay[dayName] = (salesByDay[dayName] || 0) + stat.revenue;
    });

    const days = Object.keys(salesByDay);
    const sales = Object.values(salesByDay);

    if (this.salesChart) this.salesChart.destroy();

    this.salesChart = new Chart('salesByDayChart', {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Ingresos por Día ($)',
          data: sales,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
          barThickness: 48
        }]
      }
    });
  }


  cleanupOldStatistics(): void {
    const oneWeekAgo = new Date().getTime() - (7 * 24 * 60 * 60 * 1000);

    this.firestore.collection('daily_statistics').get().subscribe(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data() as any;
        if (data.date < oneWeekAgo) {
          this.firestore.collection('daily_statistics').doc(doc.id).delete();
        }
      });
    });
  }

 /* exportToPDF(): void {
    const doc = new jsPDF();
    doc.text('Estadísticas del Restaurante', 10, 10);

    const tableData = this.occupiedTables.map(table => [
      table.name,
      table.waiterName || 'Desconocido',
      table.orders.reduce((sum, order) => sum + (order.price * (order.quantity || 1)), 0)
    ]);

    doc.autoTable({
      head: [['Mesa', 'Moz@', 'Ingresos']],
      body: tableData,
      startY: 20
    });

    doc.text(`Total Ingresos: $${this.totalRevenue.toFixed(2)}`, 10, doc.autoTable.previous.finalY + 10);

    doc.save('estadisticas.pdf');
  }*/

}