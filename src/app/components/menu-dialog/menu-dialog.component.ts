import { Component, Inject, Input } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CoffeService, MenuItem, Table } from 'src/app/models/coffe.service';
import { MatSnackBar } from '@angular/material/snack-bar';


@Component({
  selector: 'app-menu-dialog',
  templateUrl: './menu-dialog.component.html',
  styleUrls: ['./menu-dialog.component.scss']
})
export class MenuDialogComponent {
  @Input() menuItem!: MenuItem; 
  filteredMenu: MenuItem[] = [];
  searchTerm: string = '';
  selectedItems: MenuItem[] = []; // Almacena los ítems seleccionados

  constructor(
    public dialogRef: MatDialogRef<MenuDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { menu: MenuItem[] },
    private snackBar: MatSnackBar
  ) {
    this.filteredMenu = this.data.menu; 
  }
  
  // Filtrar menú por nombre
// Filtrar el menú en base al término de búsqueda
filterMenu(): void {
  const lowerCaseSearchTerm = this.searchTerm.toLowerCase();
  this.filteredMenu = this.data.menu.filter(item =>
    item.name.toLowerCase().includes(lowerCaseSearchTerm)
  );
}

  // Cerrar el diálogo sin hacer nada
  onNoClick(): void {
    this.dialogRef.close();
  }

  addSelectedItems(selectedOptions: { value: MenuItem }[]): void {
    selectedOptions.forEach(option => {
      const item = option.value;
      for (let i = 0; i < (item.quantity || 1); i++) {
        this.selectedItems.push({ ...item });
      }
    });

    // Mostrar snack bar
    this.snackBar.open('Agregado correctamente', 'Cerrar', {
      duration: 2000, // Duración del mensaje en milisegundos
    });
  }

  printComanda(selectedOptions: { value: MenuItem }[]): void {
    const selectedItems = selectedOptions.map(option => option.value);
  
    if (selectedItems.length === 0) {
      this.snackBar.open('No hay ítems seleccionados', 'Cerrar', { duration: 2000 });
      return;
    }
  
    let printContent = `
      <html>
        <head>
          <title>Comanda</title>
          <style>
            body { font-family: "Courier New", monospace; text-align: center; width: 58mm; margin: 0; }
            .ticket { padding: 10px; }
            .title { font-size: 16px; font-weight: bold; }
            .item { display: flex; justify-content: space-between; font-size: 12px; border-bottom: 1px dashed black; padding: 5px 0; }
            .footer { margin-top: 10px; font-size: 10px; border-top: 1px solid black; padding-top: 5px; }
            @media print { body { margin: 0; padding: 0; } }
          </style>
        </head>
        <body>
          <div class="ticket">
          <br>
            <div class="title">COMANDA</div>
            <hr />
    `;
  
    selectedItems.forEach(item => {
      printContent += `<div class="item"><span>${item.name}--------</span><span>x${item.quantity || 1}</span></div>`;
    });
  
    printContent += `
            <hr />
            <div class="footer">Gracias por su pedido</div>
          </div>
        </body>
      </html>
    `;
  
    const printWindow = window.open('', '', 'width=800,height=900');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  
    this.dialogRef.close(selectedItems); // Cierra el diálogo y envía los datos seleccionados
  }

}