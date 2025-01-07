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
    //this.addSelectedItems(selectedOptions); // Asegúrate de agregar los ítems seleccionados
    console.log('Imprimiendo comanda:', this.selectedItems);
    this.dialogRef.close(this.selectedItems); // Cierra el diálogo y envía los datos seleccionados
  }

}