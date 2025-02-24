import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { CoffeService, MenuItem} from 'src/app/models/coffe.service';
import { GestionService } from 'src/app/services/gestionService';
import { UserService } from 'src/app/services/user.service';
import { Waiter } from 'src/app/services/gestionService';
import { Table } from 'src/app/services/gestionService';

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss']
})
export class AdminPanelComponent {
  role$: Observable<string | null>;

  // TABLES
  tables: Table[] = [];
  newTableName: string = '';
  editTableId?: string;
  editTableName: string = '';
  editTableAvailability: boolean = true;

  // MENU
  menuItems: MenuItem[] = [];
  newItemName: string = '';
  newItemPrice: number = 0;
  editItemId?: string;
  editItemName: string = '';
  editItemPrice: number = 0;

  // WAITERS
  waiters: Waiter[] = [];
  newWaiterName: string = '';
  editWaiterId?: string;
  editWaiterName: string = '';

  constructor(
    private userService: UserService,
    private gestionService: GestionService
  ) {
    this.role$ = this.userService.getRoleState();
    this.loadTables();
    this.loadMenuItems();
    this.loadWaiters();
  }

  // TABLES
  loadTables() {
    this.gestionService.getTables().subscribe((tables) => {
      this.tables = tables;
    });
  }

  addTable() {
    if (this.newTableName.trim()) {
      this.gestionService.addTable(this.newTableName.trim()).subscribe(() => {
        this.loadTables();
        this.newTableName = '';
      });
    }
  }

  startEditingTable(table: Table) {
    this.editTableId = table.id;
    this.editTableName = table.name;
    this.editTableAvailability = table.available;
  }

  saveTableEdit() {
    if (this.editTableId !== undefined) {
      this.gestionService
        .editTable(this.editTableId, this.editTableName, this.editTableAvailability)
        .subscribe(() => {
          this.loadTables();
          this.editTableId = undefined;
        });
    }
  }

  deleteTable(tableId: string) {
    this.gestionService.deleteTable(tableId).subscribe(() => {
      this.loadTables();
    });
  }

  // MENU
  loadMenuItems() {
    this.gestionService.getMenu().subscribe((menuItems) => {
      this.menuItems = menuItems;
    });
  }

  addMenuItem() {
    if (this.newItemName.trim() && this.newItemPrice > 0) {
      this.gestionService.addMenuItem(this.newItemName.trim(), this.newItemPrice).subscribe(() => {
        this.loadMenuItems();
        this.newItemName = '';
        this.newItemPrice = 0;
      });
    }
  }

  startEditingMenu(item: MenuItem) {
    this.editItemId = item._id;
    this.editItemName = item.name;
    this.editItemPrice = item.price;
  }

  saveMenuItemEdit() {
    if (this.editItemId !== undefined) {
      this.gestionService.editMenuItem(this.editItemId, this.editItemName, this.editItemPrice).subscribe(() => {
        this.loadMenuItems();
        this.editItemId = undefined;
      });
    }
  }

  deleteMenuItem(itemId: string) {
    this.gestionService.deleteMenuItem(itemId).subscribe(() => {
      this.loadMenuItems();
    });
  }

  // WAITERS
  loadWaiters() {
    this.gestionService.getWaiters().subscribe((waiters) => {
      this.waiters = waiters;
    });
  }

  addWaiter() {
    if (this.newWaiterName.trim()) {
      this.gestionService.addWaiter(this.newWaiterName.trim()).subscribe(() => {
        this.loadWaiters();
        this.newWaiterName = '';
      });
    }
  }

  startEditingWaiter(waiter: Waiter) {
    this.editWaiterId = waiter._id;
    this.editWaiterName = waiter.name;
  }

  saveWaiterEdit() {
    if (this.editWaiterId !== undefined) {
      this.gestionService.editWaiter(this.editWaiterId, this.editWaiterName).subscribe(() => {
        this.loadWaiters();
        this.editWaiterId = undefined;
      });
    }
  }

  deleteWaiter(waiterId: string) {
    this.gestionService.deleteWaiter(waiterId).subscribe(() => {
      this.loadWaiters();
    });
  }

  // Format price input
  formatPrice() {
    this.newItemPrice = Number(this.newItemPrice);
  }
}
