import { Component, OnInit } from '@angular/core';
import { CoffeService, MenuItem } from 'src/app/models/coffe.service';
import { GestionService, Table } from 'src/app/services/gestionService';
import { PrintService } from 'src/app/services/printService';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit{
  
  tables: Table[] = [];
  refreshLinkedTables: boolean = false;

  constructor(
    private coffeService: CoffeService,
    private gestionService: GestionService,
    private printService: PrintService
  ) {}

  ngOnInit(): void {
    this.loadTables();
  }

  loadTables(): void {
    this.gestionService.getTables().subscribe((tables) => {
      this.tables = tables;
      console.log(tables,'MESAS DESDE');
      
    });
  }

  handleAddOrder(event: { tableId: string; menuItem: MenuItem }): void {
    console.log('Añadiendo orden a la mesa:', event.tableId);
  }

  handleRemoveOrder(event: { tableId: string; orderId: number }): void {
    console.log('Removiendo orden', event.orderId, 'de la mesa', event.tableId);
  }

  handleLinkTables(): void {
    this.refreshLinkedTables = !this.refreshLinkedTables;
  }


 /* printReceipt() {
    const printWindow = window.open('', '', 'width=400,height=600');
    printWindow?.document.write(`
      <html>
        <head>
          <title>Ticket de Compra</title>
          <style>
            body {
              font-family: "Courier New", Courier, monospace;
              text-align: center;
              width: 58mm;
              margin: 0;
            }
            .ticket {
              font-size: 12px;
              padding: 10px;
            }
            .title {
              font-size: 16px;
              font-weight: bold;
            }
            .item {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              border-bottom: 1px dashed black;
              padding: 5px 0;
            }
            .total {
              font-size: 14px;
              font-weight: bold;
              margin-top: 10px;
            }
            .footer {
              margin-top: 10px;
              font-size: 10px;
              border-top: 1px solid black;
              padding-top: 5px;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="title">TIENDA XYZ</div>
            <div>Fecha: ${new Date().toLocaleDateString()}</div>
            <hr/>
            <div class="item">
              <span>Producto 1</span><span>$10.00</span>
            </div>
            <div class="item">
              <span>Producto 2</span><span>$5.50</span>
            </div>
            <hr/>
            <div class="total">Total: $15.50</div>
            <div class="footer">¡Gracias por su compra!</div>
          </div>
        </body>
      </html>
    `);
  
    printWindow?.document.close();
    printWindow?.print();
  } */
  
}
