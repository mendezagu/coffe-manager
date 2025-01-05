import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CoffeService, MenuItem, Table } from 'src/app/models/coffe.service';


@Component({
  selector: 'app-menu-dialog',
  templateUrl: './menu-dialog.component.html',
  styleUrls: ['./menu-dialog.component.css']
})
export class MenuDialogComponent {
  searchTerm: string = '';
  menu: MenuItem[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public table: Table,
    private coffeService: CoffeService
  ) {
    this.menu = coffeService.getMenu();
  }

  filteredMenu() {
    return this.menu.filter(item => item.name.toLowerCase().includes(this.searchTerm.toLowerCase()));
  }

  addToTable(item: MenuItem) {
    this.table.orders.push(item);
    this.table.available = false;
  }
}