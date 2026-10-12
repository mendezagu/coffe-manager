import { Component, TemplateRef, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CategoriesComponent } from '../categories/categories.component';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Observable } from 'rxjs';
import { CoffeService, MenuItem} from 'src/app/models/coffe.service';
import { GestionService } from 'src/app/services/gestionService';
import { UserService } from 'src/app/services/user.service';
import { Waiter } from 'src/app/services/gestionService';
import { Table } from 'src/app/services/gestionService';
import { Sector } from 'src/app/services/gestionService';
import { Category } from 'src/app/services/gestionService';

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
  newTableSectorId: string = ''; // '' = sin sector
  editTableSectorId: string = '';

  // SECTORS
  sectors: Sector[] = [];
  newSectorName: string = '';
  editSectorId?: string;
  editSectorName: string = '';

  // MENU
  menuItems: MenuItem[] = [];
  newItemName: string = '';
  newItemPrice: number = 0;
  newItemIsPromo: boolean = false;
  newItemCategoryId: string = '';
  categories: Category[] = [];
  editItemId?: string;
  editItemName: string = '';
  editItemPrice: number = 0;
  editItemIsPromo: boolean = false;
  editItemCategoryId: string = '';

  // WAITERS
  waiters: Waiter[] = [];
  newWaiterName: string = '';
  editWaiterId?: string;
  editWaiterName: string = '';


  // Panel que se abre al entrar (?panel=tables|sectors|menu|categories|waiters)
  openPanel: string | null = null;

  // Panel de categorías: se refresca cuando cambian los platos (cantidad de platos por categoría)
  @ViewChild(CategoriesComponent) categoriesPanel?: CategoriesComponent;

  // Para el buscador
  searchTerm: string

  // Diálogos de edición (templates definidos al final del HTML)
  @ViewChild('editTableDialog', { static: true }) editTableDialog!: TemplateRef<any>;
  @ViewChild('editMenuDialog', { static: true }) editMenuDialog!: TemplateRef<any>;
  @ViewChild('editWaiterDialog', { static: true }) editWaiterDialog!: TemplateRef<any>;
  @ViewChild('editSectorDialog', { static: true }) editSectorDialog!: TemplateRef<any>;
  private editDialogRef?: MatDialogRef<any>;

  constructor(
    private userService: UserService,
    private gestionService: GestionService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    route: ActivatedRoute
  ) {
    this.openPanel = route.snapshot.queryParamMap.get('panel');
    this.role$ = this.userService.getRoleState();
    this.loadTables();
    this.loadSectors();
    this.loadMenuItems();
    this.loadCategories();
    this.loadWaiters();
    
    this.searchTerm = '';
  }

  // TABLES
  loadTables() {
    this.gestionService.getTables().subscribe((tables) => {
      this.tables = tables;
    });
  }

   // Filtrar los ítems del menú según el término de búsqueda
  get filteredMenuItems() {
    if (!this.searchTerm) {
      return this.menuItems;
    }
    return this.menuItems.filter(item =>
      item.name.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }


  addTable() {
    if (this.newTableName.trim()) {
      this.gestionService.addTable(this.newTableName.trim(), this.newTableSectorId || null).subscribe(() => {
        this.loadTables();
        this.newTableName = '';
      });
    }
  }

  // SECTORS
  loadSectors() {
    this.gestionService.getSectors().subscribe((sectors) => {
      this.sectors = sectors;
    });
  }

  // Misma regla que el backend: sin tildes, sin mayúsculas y con espacios colapsados
  private normalizeName(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  isSectorNameTaken(name: string, excludeId?: string): boolean {
    const target = this.normalizeName(name);
    if (!target) return false;
    return this.sectors.some(s => s._id !== excludeId && this.normalizeName(s.name) === target);
  }

  get newSectorNameTaken(): boolean {
    return this.isSectorNameTaken(this.newSectorName);
  }

  get editSectorNameTaken(): boolean {
    return this.isSectorNameTaken(this.editSectorName, this.editSectorId);
  }

  tablesInSector(sectorId: string): number {
    return this.tables.filter(t => t.sectorId === sectorId).length;
  }

  private showError(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 4000 });
  }

  addSector() {
    const name = this.newSectorName.trim();
    if (!name || this.newSectorNameTaken) return;
    this.gestionService.addSector(name).subscribe({
      next: () => {
        this.newSectorName = '';
        this.loadSectors();
      },
      error: (err) => this.showError(err.message),
    });
  }

  // Reordena con drag & drop: se mueve en pantalla al instante y se guarda el nuevo orden;
  // si falla, se vuelve a pedir la lista para no mostrar un orden que no quedó guardado.
  dropSector(event: CdkDragDrop<Sector[]>) {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.sectors, event.previousIndex, event.currentIndex);
    this.gestionService.reorderSectors(this.sectors.map(s => s._id)).subscribe({
      error: () => {
        this.showError('No se pudo guardar el nuevo orden');
        this.loadSectors();
      },
    });
  }

  startEditingSector(sector: Sector) {
    this.editSectorId = sector._id;
    this.editSectorName = sector.name;
    this.openEditDialog(this.editSectorDialog, () => (this.editSectorId = undefined));
  }

  saveSectorEdit() {
    const name = this.editSectorName.trim();
    if (this.editSectorId === undefined || !name || this.editSectorNameTaken) return;
    this.gestionService.editSector(this.editSectorId, name).subscribe({
      next: () => {
        this.editSectorId = undefined;
        this.loadSectors();
        this.loadTables(); // las mesas muestran el nombre del sector
        this.closeEditDialog();
      },
      error: (err) => this.showError(err.message),
    });
  }

  deleteSector(sector: Sector) {
    const count = this.tablesInSector(sector._id);
    const detail = count > 0 ? ` Sus ${count} mesa(s) quedarán sin sector.` : '';
    if (!confirm(`¿Eliminar el sector "${sector.name}"?${detail}`)) return;
    this.gestionService.deleteSector(sector._id).subscribe(() => {
      this.loadSectors();
      this.loadTables();
    });
  }

  // Abre un template como diálogo; al cerrarse (por guardar, cancelar, Esc o clic afuera) ejecuta onClose
  private openEditDialog(template: TemplateRef<any>, onClose: () => void) {
    this.editDialogRef = this.dialog.open(template, {
      width: '440px',
      maxWidth: '95vw',
    });
    this.editDialogRef.afterClosed().subscribe(() => onClose());
  }

  closeEditDialog() {
    this.editDialogRef?.close();
  }

  startEditingTable(table: Table) {
    this.editTableId = table.id;
    this.editTableName = table.name;
    this.editTableAvailability = table.available;
    this.editTableSectorId = table.sectorId || '';
    this.openEditDialog(this.editTableDialog, () => (this.editTableId = undefined));
  }

  saveTableEdit() {
    if (this.editTableId !== undefined) {
      this.gestionService
        .editTable(this.editTableId, this.editTableName, this.editTableAvailability, this.editTableSectorId || null)
        .subscribe(() => {
          this.loadTables();
          this.editTableId = undefined;
          this.closeEditDialog();
        });
    }
  }

  deleteTable(tableId: string) {
    this.gestionService.deleteTable(tableId).subscribe(() => {
      this.loadTables();
    });
  }

  // MENU
  loadCategories() {
    this.gestionService.getCategories().subscribe({ next: (c) => (this.categories = c), error: () => {} });
  }

  categoryName(id?: string | null): string {
    return this.categories.find((c) => c._id === id)?.name ?? '';
  }

  loadMenuItems() {
    this.gestionService.getMenu().subscribe((menuItems) => {
      this.menuItems = menuItems;
    });
  }

  addMenuItem() {
    if (this.newItemName.trim() && this.newItemPrice > 0) {
      this.gestionService.addMenuItem(this.newItemName.trim(), this.newItemPrice, this.newItemIsPromo, this.newItemCategoryId || null).subscribe(() => {
        this.gestionService.refreshMenu().subscribe((menuItems) => {
          this.menuItems = menuItems;
        });
        this.newItemName = '';
        this.newItemPrice = 0;
        this.newItemIsPromo = false;
        this.newItemCategoryId = '';
        this.categoriesPanel?.load();
      });
    }
  }

  startEditingMenu(item: MenuItem) {
    this.editItemId = item._id;
    this.editItemName = item.name;
    this.editItemPrice = item.price;
    this.editItemIsPromo = !!item.isPromo;
    this.editItemCategoryId = item.categoryId ?? '';
    this.openEditDialog(this.editMenuDialog, () => (this.editItemId = undefined));
  }

  saveMenuItemEdit() {
    if (this.editItemId !== undefined) {
      this.gestionService.editMenuItem(this.editItemId, this.editItemName, this.editItemPrice, this.editItemIsPromo, this.editItemCategoryId || null).subscribe(() => {
        this.gestionService.refreshMenu().subscribe((menuItems) => {
          this.menuItems = menuItems;
        });
        this.editItemId = undefined;
        this.categoriesPanel?.load();
        this.closeEditDialog();
      });
    }
  }

  deleteMenuItem(itemId: string) {
    this.gestionService.deleteMenuItem(itemId).subscribe(() => {
      this.categoriesPanel?.load();
      this.gestionService.refreshMenu().subscribe((menuItems) => {
        this.menuItems = menuItems;
      });
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
    this.openEditDialog(this.editWaiterDialog, () => (this.editWaiterId = undefined));
  }

  saveWaiterEdit() {
    if (this.editWaiterId !== undefined) {
      this.gestionService.editWaiter(this.editWaiterId, this.editWaiterName).subscribe(() => {
        this.loadWaiters();
        this.editWaiterId = undefined;
        this.closeEditDialog();
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
