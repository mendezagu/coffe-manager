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

  constructor(
    private gestionService: GestionService,
    public dialogRef: MatDialogRef<MenuDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Table  // Se pasa la información de la mesa si es necesario
  ) {}

  ngOnInit(): void {
    this.loadMenu();
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

  // Cierra el diálogo y devuelve los items seleccionados
  assign(): void {
    this.dialogRef.close(this.selectedItems);
  }

  // Cancela la operación
  cancel(): void {
    this.dialogRef.close();
  }
}