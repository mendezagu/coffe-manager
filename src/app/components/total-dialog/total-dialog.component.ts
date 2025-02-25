import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GestionService } from 'src/app/services/gestionService';

@Component({
  selector: 'app-total-dialog',
  templateUrl: './total-dialog.component.html',
  styleUrls: ['./total-dialog.component.scss']
})
export class TotalDialogComponent implements OnInit {
  total: number = 0;
  discountedTotal: number = 0; // Total con descuento
  discountPercentage: number = 0; // Porcentaje de descuento aplicado
  orders: any[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<TotalDialogComponent>,
    private gestionService: GestionService
  ) {
    this.orders = data.orders || []; // Asignamos orders de 'data' (lo que pasa al componente)
    this.calculateTotal();
  }

  ngOnInit(): void {
    this.printMenuItems();
    console.log(this.orders, 'ORDENES EN TOTAL');
  }

  printMenuItems(): void {
    let pricesAssignedCount = 0; // Variable para contar cuántos precios han sido asignados
  
    this.orders.forEach(order => {
      if (order && order.menuItem && order.quantity !== undefined) {
        this.gestionService.getMenu().subscribe(menuItems => {
          const menuItem = menuItems.find(item => item._id === order.menuItem);
          if (menuItem) {
            order.name = menuItem.name; // Asignar el nombre directamente a la orden
            order.price = menuItem.price; // Asignar el precio
          } else {
            order.name = 'No encontrado';
            order.price = 0; // Si no se encuentra el producto, el precio es 0
          }
  
          pricesAssignedCount++; // Incrementar contador cada vez que se asigna un precio
  
          // Cuando todos los precios hayan sido asignados, calcular el total
          if (pricesAssignedCount === this.orders.length) {
            this.calculateTotal(); // Calcular el total solo después de que todos los precios estén asignados
          }
        });
      }
    });
  }

  calculateTotal() {
    if (this.orders.length === 0) {
      console.warn('No hay órdenes disponibles.');
      this.total = 0;
      this.discountedTotal = 0;
      return;
    }

    // Imprimir las órdenes en consola
    console.log("Datos de las órdenes:");
    this.orders.forEach(order => {
      console.log(`Producto: ${order.name}, Cantidad: ${order.quantity || 1}, Precio: ${order.price}`);
    });

    // Calcular el total sumando el precio por cantidad de cada item
    this.total = this.orders.reduce((sum, item) => {
      const qty = item.quantity ?? 1; // Si quantity no está definido, se asigna 1 como valor por defecto
      const subtotal = item.price * qty; // Calcular el subtotal (precio * cantidad)
      return sum + subtotal; // Sumar el subtotal
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
    if (!this.data.tableId) {
      console.log(this.data.tableId, 'ID DE MESA ENCONTRADO');
      
      console.error('No se pudo liberar la mesa: ID de la mesa no encontrado.');
      return;
    }
  
    this.gestionService.resetTable(this.data.tableId).subscribe({
      next: (response) => {
        console.log('Mesa liberada correctamente:', response);
  
        // 🔄 Notificar al componente padre que la mesa fue liberada
        this.dialogRef.close({
          status: 'mesa_liberada',
          tableId: this.data.tableId
        });
      },
      error: (error) => {
        console.error('Error al liberar la mesa:', error);
        alert('Hubo un error al liberar la mesa. Inténtalo nuevamente.');
      }
    });
  }

  printTicket() {
    const printContent = `
      <html>
        <head>
          <title>Ticket</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; }
            .ticket { width: 250px; padding: 10px; }
            .order-item { display: flex; justify-content: space-between; }
            .totals { margin-top: 10px; font-weight: bold; }
            p { margin: 2px 0; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <br>
            <h2>Detalle de Orden</h2>
            <div class="order-list">
              ${
                this.orders.map(order => {
                  const qty = order.quantity ?? 1;
                  const subtotal = order.price * qty;
                  return `
                    <div class="order-item">
                      <p>${order.name}(x${qty})---------- ${subtotal.toFixed(2)}</p>
                    </div>
                  `;
                }).join('') // Unir todos los items con un salto de línea
              }
            </div>
            <div class="totals">
              <p><strong>Total:</strong> ${this.total.toFixed(2)}</p>
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

    const printWindow = window.open('', '', 'width=300,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
    }
  }
}