import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GestionService, MenuItem, Table } from 'src/app/services/gestionService';

@Component({
  selector: 'app-menu-dialog',
  templateUrl: './menu-dialog.component.html',
  styleUrls: ['./menu-dialog.component.scss']
})
export class MenuDialogComponent {

  menuItems: MenuItem[] = [];
  selectedItems: MenuItem[] = [];
  canPrint: boolean = false;

  constructor(
    private gestionService: GestionService,
    public dialogRef: MatDialogRef<MenuDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Table  // Se pasa la información de la mesa
  ) {}

  ngOnInit(): void {
    this.loadMenu();

    // Escuchar el mensaje de cierre desde la ventana de impresión
    window.addEventListener('message', (event) => {
      if (event.data === 'closeDialog') {
        this.dialogRef.close(this.selectedItems); // Cerrar el diálogo
      }
    });
  }

  loadMenu(): void {
    this.gestionService.getMenu().subscribe((menus) => {
      this.menuItems = menus;
    });
  }

  toggleSelection(menu: MenuItem, event: any): void {
    const index = this.selectedItems.findIndex(item => item._id === menu._id);
    if (event.target.checked) {
      if (index === -1) {
        this.selectedItems.push({ ...menu, quantity: menu.quantity || 1 });
      }
    } else {
      if (index > -1) {
        this.selectedItems.splice(index, 1);
      }
    }
  }

  updateQuantity(menu: MenuItem, event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const quantity = parseInt(inputElement.value, 10);
    menu.quantity = quantity;
    const index = this.selectedItems.findIndex(item => item._id === menu._id);
    if (index > -1) {
      this.selectedItems[index].quantity = quantity;
    }
  }

  // Cierra el diálogo después de imprimir el ticket
  printTicket(): void {
    const printContent = `
      <html>
        <head>
          <title>Ticket</title>
          <style>
            @page { size: 58mm landscape; margin: 0; } /* Modo horizontal */
            
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 14px; 
              font-weight: bold;
              margin: 0;
              padding: 0;
              text-align: left;
            }
            .ticket { 
              width: 58mm; 
              padding: 5px;
            }
            .header { text-align: left; margin-bottom: 5px; }
            .order-list { text-align: left; word-wrap: break-word; }
            .order-item { display: flex; justify-content: space-between; width: 100%; }
            .order-item p { margin: 0; padding-right: 5px; }
            .totals { margin-top: 5px; text-align: left; }
            .line { border-top: 1px dashed #000; margin: 3px 0; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">
              <h2 style="font-size: 12px;">🍽️ NUOVO CAFFE</h2>
              <p>Mesa: <strong>${this.data.name}</strong></p>
              <p>${new Date().toLocaleString()}</p>
            </div>
            <div class="line"></div>
            <div class="order-list">
              ${
                this.selectedItems.map(item => ` 
                  <div class="order-item">
                    <p>${item.name}</p>
                    <p>x${item.quantity}</p>
                  </div>
                `).join('')
              }
            </div>
            <div class="line"></div>
            <div class="totals">
              <p>Muchas gracias!</p>
            </div>
            <div class="line"></div>
            <p style="text-align:center; font-size:8px;"><br></p>
          </div>
          <script>
            window.print();
            window.onafterprint = function() {
              window.close();
              window.opener.postMessage('closeDialog', '*');
            }
          </script>
        </body>
      </html>
    `;
  
    const printWindow = window.open('', '', 'width=600,height=400');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
    }
  }

  // Asigna los ítems seleccionados a la mesa y marca la mesa como ocupada
  assign(): void {
    this.canPrint = true;

    // Si los ítems seleccionados no están vacíos, agregar ítems a la mesa y marcarla como ocupada
    if (this.selectedItems.length > 0) {
      this.gestionService.addItemsToTable(this.data.id, this.selectedItems).subscribe(() => {
        // Después de agregar los ítems, actualizamos el estado de la mesa
        this.gestionService.editTable(this.data.id, this.data.name, false).subscribe(() => {
          console.log('Mesa marcada como ocupada');
        });
      });
    }
  }

  // Cancela la operación
  cancel(): void {
    this.dialogRef.close();
  }
}