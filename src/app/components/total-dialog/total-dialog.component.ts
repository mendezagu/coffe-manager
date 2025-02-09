import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Table } from 'src/app/models/coffe.service';


@Component({
  selector: 'app-total-dialog',
  templateUrl: './total-dialog.component.html',
  styleUrls: ['./total-dialog.component.scss']
})
export class TotalDialogComponent {
  total: number = 0;
  discountedTotal: number = 0; // Total con descuento
  discountPercentage: number = 0; // Porcentaje de descuento aplicado

  constructor(
    @Inject(MAT_DIALOG_DATA) public table: Table,
    private dialogRef: MatDialogRef<TotalDialogComponent>
  ) {
    this.calculateTotal();
  }

  calculateTotal() {
    this.total = this.table.orders.reduce((sum, item) => {
      const qty = item.quantity ?? 1; // usa 1 como predeterminado si quantity está indefinido
      return sum + (item.price * qty);
    }, 0);
    this.calculateDiscountedTotal(); // Actualiza el total con descuento
  }

  applyDiscount(discount: number) {
    this.discountPercentage = discount;
    this.calculateDiscountedTotal();
  }

  calculateDiscountedTotal() {
    this.discountedTotal = this.total - (this.total * this.discountPercentage / 100);
  }

  liberarMesa() {
    this.dialogRef.close('liberar'); // Notifica al componente padre
  }

  printTicket() {
    // Generamos el HTML que se va a imprimir
    const printContent = `
      <html>
        <head>
          <title>Ticket</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              font-size: 12px;
            }
            .ticket {
              width: 250px;
              padding: 10px;
            }
            .order-item {
              display: flex
              justify-content: space-between;
            }
            .totals {
              margin-top: 10px;
              font-weight: bold;
            }
            p {
              margin: 2px 0;
            }
          </style>
        </head>
        <body>
          <div class="ticket">
          <br>
            <h2>Detalle de Orden</h2>
            <div class="order-list">
              ${
                this.table.orders.map(order => {
                  const qty = order.quantity ?? 1;
                  const subtotal = order.price * qty;
                  return `
                    <div class="order-item">
                      <p>${order.name}(x${qty})---------- ${subtotal.toFixed(2)}</p>
                    </div>
                  `;
                }).join('')
              }
            </div>
            <div class="totals">
        
              <p><strong>Total:</strong> ${this.total}</p>
            </div>
            <p style="margin-top:10px; font-size:10px;">${new Date().toLocaleString()}</p>
          </div>
          <script>
            window.print();
            window.onafterprint = function(){
              window.close();
            }
          </script>
        </body>
      </html>
    `;

    // Abrimos una ventana para la impresión
    const printWindow = window.open('', '', 'width=300,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
    }
  }

 /* generatePdfWithTable() {
    const doc = new jsPDF();

    // Datos de ejemplo
    const head = [['Producto', 'Unit', 'Subtotal']];
    const body = [
      ['Café (x3)', '2.00', '6.00'],
      ['Té (x2)', '1.50', '3.00']
      // ...
    ];

    // Usamos el plugin autoTable
    (doc as any).autoTable({
      head: head,
      body: body,
      startY: 20 // posición Y donde empieza la tabla
    });

    doc.output('dataurlnewwindow');
  }*/
}