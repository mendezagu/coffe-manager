import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { CoffeService } from 'src/app/models/coffe.service';

interface TableRevenue {
  date: number;
  tableName: string;
  waiterName: string;
  revenue: number;
}

@Component({
  selector: 'app-balance',
  templateUrl: './balance.component.html',
  styleUrls: ['./balance.component.scss']
})
export class BalanceComponent implements OnInit {
  occupiedTables: TableRevenue[] = [];
  totalRevenue: number = 0;

  constructor(private firestore: AngularFirestore, private coffeService: CoffeService) {}

  ngOnInit(): void {
    this.loadOccupiedTables();
  }

  loadOccupiedTables(): void {
    this.firestore.collection<TableRevenue>('daily_statistics').valueChanges().subscribe(data => {
      this.occupiedTables = data;
      this.totalRevenue = this.occupiedTables.reduce((sum, table) => sum + table.revenue, 0);
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


