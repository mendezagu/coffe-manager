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
  filterText: string = '';
  waiterName: string = '';

  // Objeto auxiliar para rastrear menús agregados temporalmente
  addedItems: { [key: string]: boolean } = {};

  constructor(
    private gestionService: GestionService,
    public dialogRef: MatDialogRef<MenuDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Table  // Se pasa la información de la mesa si es necesario
  ) {}

  ngOnInit(): void {
    this.loadMenu();
    // Verificamos si 'this.data.waiter' es un objeto de tipo Waiter y accedemos al nombre del mozo
  if (this.data && this.data.waiter) {
    if (typeof this.data.waiter === 'object' && this.data.waiter.name) {
      this.waiterName = this.data.waiter.name;  // Accedemos al nombre del mozo
    } else {
      this.waiterName = 'Desconocido';  // Si no tiene la propiedad 'name', asignamos un valor por defecto
    }
  } else {
    this.waiterName = 'Desconocido';  // Si no hay 'waiter' en los datos, asignamos un valor por defecto
  }

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
  get filteredMenuItems(): MenuItem[] {
    return this.menuItems.filter(menu => 
      menu.name.toLowerCase().includes(this.filterText.toLowerCase())
    );
  }

  toggleSelection(menu: MenuItem, event: any): void {
    const index = this.selectedItems.findIndex(item => item._id === menu._id);
    if (event.target.checked) {
      if (index === -1) {
        this.selectedItems.push({ ...menu, quantity: 1 });
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

  

  // Cierra el diálogo y devuelve los items seleccionados
   // Cierra el diálogo después de imprimir el ticket
   printTicket(): void {
    if (!this.selectedItems.length) {
      alert("No hay ítems seleccionados para imprimir.");
      return;
    }
  
    this.gestionService.addItemsToTable(this.data.id, this.selectedItems).subscribe(
      (updatedTable) => {
        this.data.orders = updatedTable.orders;
        this.data.available = false; // Marcamos la mesa como ocupada
        this.canPrint = false; // 🔴 Deshabilitamos el botón de imprimir
  
        const printContent = `
          <html>
            <head>
              <title>Ticket</title>
              <style>
                @page { size: 58mm landscape; margin: 0; }
                body { font-family: 'Courier New', monospace; font-size: 14px; font-weight: bold; margin: 0; padding: 0; text-align: left; }
                .ticket { width: 58mm; padding: 5px; }
                .header { text-align: left; margin-bottom: 5px; }
                .order-list { text-align: left; word-wrap: break-word; }
                .order-item { display: flex; justify-content: space-between; width: 100%; }
                .order-item p { margin: 0; padding-right: 5px; }
                .totals { margin-top: 5px; text-align: left; }
                .line { border-top: 1px dashed #000; margin: 3px 0; }
                .logo { text-align: center; margin-bottom: 10px; }
                .logo img { width: 70px; max-width: 58mm; height: auto; }
              </style>
            </head>
            <body>
              <div class="ticket">
                <div class="logo"><img src="
                data:image/jpeg;base64,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

                " alt="Logo"></div>
                <div class="header">
                  <h2 style="font-size: 14px;">🍽️ NUOVO CAFFE</h2>
                  <p style="font-size: 14px;">Mesa: <strong>${this.data.name}</strong></p>
                  <p>${new Date().toLocaleString()}</p>
                </div>
                <div class="line"></div>
                <div class="order-list">
                  ${this.selectedItems.map(item => `
                    <div class="order-item">
                      <p>${item.name}</p>
                      <p>x${item.quantity}</p>
                    </div>
                  `).join('')}
                </div>
                <div class="line"></div>
                <div class="totals"><p>Aclaracion:</p></div>
                <div class="line"></div>
                <br><br>
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
  
        // Imprimir dos veces
        for (let i = 0; i < 3; i++) {
          const printWindow = window.open('', '', 'width=900,height=900');
          if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
          }
        }
      },
      (error) => {
        console.error("Error al actualizar la mesa:", error);
        alert("Ocurrió un error al actualizar la mesa antes de imprimir.");
      }
    );
  }


  addItem(menu: MenuItem): void {
    const index = this.selectedItems.findIndex(item => item._id === menu._id);
    
    if (index === -1) {
      // Si el ítem no está en la lista, lo agregamos con cantidad mínima 1
      this.selectedItems.push({ ...menu, quantity: menu.quantity ?? 1 });
    } else {
      // Si ya está en la lista, incrementamos la cantidad asegurándonos de que no sea undefined
      this.selectedItems[index].quantity = (this.selectedItems[index].quantity ?? 0) + 1;
    }

    // Marcar el botón como "agregado" en el objeto auxiliar
    this.addedItems[menu._id] = true;

    // Restaurar el color después de 2 segundos
    setTimeout(() => {
      this.addedItems[menu._id] = false;
    }, 2000);

    this.canPrint = this.selectedItems.length > 0; // Habilitar botón de imprimir si hay elementos
  }


  // Cancela la operación
  cancel(): void {
    this.dialogRef.close();
  }
}