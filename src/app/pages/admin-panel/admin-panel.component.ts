import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { CoffeService, MenuItem, Table, Waiter } from 'src/app/models/coffe.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss']
})
export class AdminPanelComponent {
  role$: Observable<string | null>;
  //TABLES
  tables: Table[] = [];
  newTableName: string = '';
  editTableId?: number;
  editTableName: string = '';
  editTableAvailability: boolean = true;
  //MENU 
  menuItems: MenuItem[] = [];
  newItemName: string = '';
  newItemPrice: number = 0;
  editItemId?: number;
  editItemName: string = '';
  editItemPrice: number = 0;

  //waiters 

  waiters: Waiter[] = [];
  newWaiterName: string = '';
  editWaiterId?: number;
  editWaiterName: string = '';

  constructor(private userService: UserService, private coffeService: CoffeService) {
    this.role$ = this.userService.getRoleState();
    this.tables = this.coffeService.getTables();
    this.menuItems = this.coffeService.getMenu();
    this.waiters = this.coffeService.getWaiters();
  }

  //TABLES

  addTable() {
    if (this.newTableName.trim()) {
      this.coffeService.addTable(this.newTableName.trim());
      this.tables = this.coffeService.getTables();
      this.newTableName = '';
    }
  }

  startEditingTable(table: Table) {
    this.editTableId = table.id;
    this.editTableName = table.name;
    this.editTableAvailability = table.available;
  }

  saveTableEdit() {
    if (this.editTableId !== undefined) {
      this.coffeService.editTable(this.editTableId, this.editTableName, this.editTableAvailability);
      this.tables = this.coffeService.getTables();
      this.editTableId = undefined;
    }
  }

  deleteTable(tableId: number) {
    this.coffeService.deleteTable(tableId);
    this.tables = this.coffeService.getTables();
  }

  //MENU

  addMenuItem() {
    if (this.newItemName.trim() && this.newItemPrice > 0) {
      this.coffeService.addMenuItem(this.newItemName.trim(), this.newItemPrice);
      this.menuItems = this.coffeService.getMenu();
      this.newItemName = '';
      this.newItemPrice = 0;
    }
  }

  startEditingMenu(item: MenuItem) {
    this.editItemId = item.id;
    this.editItemName = item.name;
    this.editItemPrice = item.price;
  }

  saveMenuItemEdit() {
    if (this.editItemId !== undefined) {
      this.coffeService.editMenuItem(this.editItemId, this.editItemName, this.editItemPrice);
      this.menuItems = this.coffeService.getMenu();
      this.editItemId = undefined;
    }
  }

  deleteMenuItem(itemId: number) {
    this.coffeService.deleteMenuItem(itemId);
    this.menuItems = this.coffeService.getMenu();
  }

  //waiters

  addWaiter() {
    if (this.newWaiterName.trim()) {
      this.coffeService.addWaiter(this.newWaiterName.trim());
      this.waiters = this.coffeService.getWaiters();
      this.newWaiterName = '';
    }
  }

  startEditingWaiter(waiter: Waiter) {
    this.editWaiterId = waiter.id;
    this.editWaiterName = waiter.name;
  }

  saveWaiterEdit() {
    if (this.editWaiterId !== undefined) {
      this.coffeService.editWaiter(this.editWaiterId, this.editWaiterName);
      this.waiters = this.coffeService.getWaiters();
      this.editWaiterId = undefined;
    }
  }

  deleteWaiter(waiterId: number) {
    this.coffeService.deleteWaiter(waiterId);
    this.waiters = this.coffeService.getWaiters();
  }

  formatPrice() {
    this.newItemPrice = Number(this.newItemPrice); // Convierte a número explícitamente
  }
}
