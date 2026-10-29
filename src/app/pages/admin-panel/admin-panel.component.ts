import { Component, TemplateRef, ViewChild } from '@angular/core';
import { FilterTab } from 'src/app/components/filter-tabs/filter-tabs.component';
import { ActivatedRoute } from '@angular/router';
import { CategoriesComponent } from '../categories/categories.component';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Observable } from 'rxjs';
import { SettingsService } from 'src/app/services/settings.service';
import { MenuItem } from 'src/app/models/coffe.models';
import { GestionService } from 'src/app/services/gestionService';
import { AppUser, UserService } from 'src/app/services/user.service';
import { Waiter } from 'src/app/services/gestionService';
import { Table } from 'src/app/services/gestionService';
import { Sector } from 'src/app/services/gestionService';
import { Category, ModifierGroup } from 'src/app/services/gestionService';
import { PlanService } from 'src/app/services/plan.service';
import { MenuImageService } from 'src/app/services/menu-image.service';

export type AdminSection = 'tables' | 'sectors' | 'menu' | 'categories' | 'modifiers' | 'waiters' | 'users' | 'qr';

interface AdminSectionInfo {
  key: AdminSection;
  title: string;
  description: string;
  icon: string;
  singular: string;
  plural: string;
  // función del plan que usa esta sección (si no es del plan base, la tarjeta lleva su etiqueta)
  feature?: string;
}

interface SectionCard extends AdminSectionInfo {
  count: number;
  hint: string;
}

const SECTIONS: AdminSectionInfo[] = [
  { key: 'tables', title: 'Mesas', description: 'Agrega, edita o elimina tus mesas', icon: 'table_restaurant', singular: 'mesa', plural: 'mesas' },
  { key: 'sectors', title: 'Sectores', description: 'Agrupa tus mesas por zona (Salón, Terraza…)', icon: 'grid_view', singular: 'sector', plural: 'sectores' },
  { key: 'menu', title: 'Menú', description: 'Platos y bebidas, con su precio y categoría', icon: 'restaurant_menu', singular: 'plato', plural: 'platos' },
  { key: 'categories', title: 'Categorías', description: 'Ordena el menú en secciones (Cafés, Tortas…)', icon: 'category', singular: 'categoría', plural: 'categorías' },
  { key: 'modifiers', title: 'Modificadores', description: 'Tamaños, leches y extras con precio', icon: 'tune', singular: 'modificador', plural: 'modificadores', feature: 'modifiers' },
  { key: 'waiters', title: 'Mozos', description: 'Los nombres que se asignan a las mesas', icon: 'person', singular: 'mozo', plural: 'mozos' },
  { key: 'qr', title: 'Códigos QR', description: 'Imprimí el QR de cada mesa para que pidan desde el celular', icon: 'qr_code_2', singular: 'mesa con QR', plural: 'mesas con QR', feature: 'qr_ordering' },
  { key: 'users', title: 'Usuarios', description: 'Cuentas del personal y qué puede hacer cada una', icon: 'group', singular: 'usuario', plural: 'usuarios' },
];

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

  // Pestañas de las listas: mesas por sector y platos por categoría ('all' = todas)
  tableTab = 'all';
  menuTab = 'all';
  // Filtro de la lista del menú por visibilidad en la carta: todos, solo los que se ven o solo los ocultos
  menuVisibility: 'all' | 'visible' | 'hidden' = 'all';
  visFilterOpen = false; // menú desplegable del filtro
  readonly visOptions: { key: 'all' | 'visible' | 'hidden'; label: string; icon: string }[] = [
    { key: 'all', label: 'Todos', icon: 'list' },
    { key: 'visible', label: 'Visibles en la carta', icon: 'visibility' },
    { key: 'hidden', label: 'Ocultos de la carta', icon: 'visibility_off' },
  ];

  get tableTabs(): FilterTab[] {
    const tabs: FilterTab[] = [{ key: 'all', label: 'Todas', count: this.tables.length }];
    for (const s of this.sectors) tabs.push({ key: s._id, label: s.name, count: this.tables.filter((t) => t.sectorId === s._id).length });
    const without = this.tables.filter((t) => !t.sectorId).length;
    // "Sin sector" solo si hay sectores (si no hay ninguno, todas las mesas son "sin sector" y la pestaña sobra)
    if (this.sectors.length > 0 && without > 0) tabs.push({ key: 'none', label: 'Sin sector', count: without });
    return tabs;
  }

  // la pestaña elegida puede haber desaparecido (se borró el sector): en ese caso se muestran todas
  get activeTableTab(): string {
    return this.tableTabs.some((t) => t.key === this.tableTab) ? this.tableTab : 'all';
  }

  get visibleTables(): Table[] {
    const tab = this.activeTableTab;
    if (tab === 'all') return this.tables;
    return this.tables.filter((t) => (tab === 'none' ? !t.sectorId : t.sectorId === tab));
  }

  get menuTabsList(): FilterTab[] {
    const tabs: FilterTab[] = [{ key: 'all', label: 'Todo', count: this.menuItems.length }];
    for (const c of this.categories) tabs.push({ key: c._id, label: c.name, count: this.menuItems.filter((m) => m.categoryId === c._id).length });
    const without = this.menuItems.filter((m) => !m.categoryId).length;
    if (this.categories.length > 0 && without > 0) tabs.push({ key: 'none', label: 'Sin categoría', count: without });
    return tabs;
  }

  get activeMenuTab(): string {
    return this.menuTabsList.some((t) => t.key === this.menuTab) ? this.menuTab : 'all';
  }

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
  modifierGroups: ModifierGroup[] = [];
  editItemId?: string;
  // Datos de la carta del plato que se edita
  editItemDescription = '';
  editItemBadge = '';
  editItemBadgeColor = 'terracotta';
  editItemFeatured = false;
  editItemVisible = true;
  // Precio final de cada opción en este plato ("Chico" 3800, "Jarro" 4000…). Vacío = ese tamaño no se ofrece.
  // Solo para los grupos obligatorios de una opción (el tamaño) que el plato ofrece y tiene "precios propios" activados.
  showSizeImport = false; // panel de carga por planilla
  editOwnGroups = new Set<string>();
  editOptionPrices: Record<string, number | null> = {};
  readonly badgeColors: { key: string; label: string; swatch: string }[] = [
    { key: 'terracotta', label: 'Terracota', swatch: 'bg-[#c2703d]' },
    { key: 'green', label: 'Verde', swatch: 'bg-[#1f6f4a]' },
    { key: 'red', label: 'Rojo', swatch: 'bg-[#d62f2f]' },
    { key: 'blue', label: 'Azul', swatch: 'bg-[#2f6fd6]' },
    { key: 'amber', label: 'Ámbar', swatch: 'bg-[#d98a14]' },
    { key: 'dark', label: 'Oscuro', swatch: 'bg-[#22322a]' },
  ];
  editItemName: string = '';
  editItemPrice: number = 0;
  editItemIsPromo: boolean = false;
  editItemCategoryId: string = '';
  editItemGroupIds: string[] = [];

  // WAITERS
  waiters: Waiter[] = [];
  newWaiterName: string = '';
  editWaiterId?: string;
  editWaiterName: string = '';


  // Usuarios (solo se cuentan acá; se gestionan en <app-users>)
  users: AppUser[] = [];

  // Sección abierta (ruta /admin/:section); null = pantalla de inicio con las tarjetas
  section: AdminSection | null = null;

  // Tarjetas del inicio. El contador sale de los datos que ya carga este componente.
  get cards(): SectionCard[] {
    const uncategorized = this.categories.length > 0 ? this.menuItems.filter((m) => !m.categoryId).length : 0;
    return SECTIONS.filter((s) => this.plans.showTables || !['tables', 'sectors', 'waiters', 'qr'].includes(s.key)).map((s) => {
      const count = { tables: this.tables.length, sectors: this.sectors.length, menu: this.menuItems.length, categories: this.categories.length, modifiers: this.modifierGroups.length, waiters: this.waiters.length, users: this.users.length, qr: this.tables.length }[s.key];
      return { ...s, count, hint: s.key === 'menu' && uncategorized > 0 ? `${uncategorized} sin categoría` : s.key === 'qr' && !this.settings.value.qrActive ? 'Desactivado' : '' };
    });
  }

  // La lista se recalcula en cada ciclo: sin esto Angular recrea las tarjetas entre que se aprieta y se suelta el mouse,
  // y el clic se pierde
  trackCard = (_: number, c: SectionCard) => c.key;

  get current(): AdminSectionInfo | null {
    return SECTIONS.find((s) => s.key === this.section) ?? null;
  }

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
    private settings: SettingsService,
    public plans: PlanService,
    private menuImages: MenuImageService,
    route: ActivatedRoute
  ) {
    route.paramMap.subscribe((params) => {
      const key = params.get('section');
      this.section = SECTIONS.some((s) => s.key === key) ? (key as AdminSection) : null;
    });
    this.role$ = this.userService.getRoleState();
    this.loadTables();
    this.loadSectors();
    this.loadMenuItems();
    this.loadCategories();
    this.loadModifierGroups();
    this.loadUsers();
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
    const tab = this.activeMenuTab;
    const inTab = tab === 'all' ? this.menuItems : this.menuItems.filter((item) => (tab === 'none' ? !item.categoryId : item.categoryId === tab));
    const byVisibility = inTab.filter((item) => this.menuVisibility === 'all' || (this.menuVisibility === 'visible') === this.isVisible(item));
    if (!this.searchTerm) {
      return byVisibility;
    }
    return byVisibility.filter(item =>
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
  loadUsers() {
    this.userService.listUsers().subscribe({ next: (u) => (this.users = u), error: () => {} });
  }

  loadModifierGroups() {
    this.gestionService.getModifiers().subscribe({ next: (g) => (this.modifierGroups = g), error: () => {} });
  }

  // Marca o desmarca un modificador en el plato que se está editando
  toggleEditGroup(id: string) {
    this.editItemGroupIds = this.editItemGroupIds.includes(id)
      ? this.editItemGroupIds.filter((g) => g !== id)
      : [...this.editItemGroupIds, id];
  }

  // Grupos que pueden tener precio propio por plato: obligatorios y de una sola opción (el tamaño)
  isSizeGroup(g: ModifierGroup): boolean {
    return g.required && g.selection === 'SINGLE';
  }

  // Activa o desactiva los precios propios de un grupo; al activar, parte de lo que hoy cuesta cada opción
  toggleOwnPrices(g: ModifierGroup) {
    if (this.editOwnGroups.has(g._id)) {
      this.editOwnGroups.delete(g._id);
      g.options.forEach((o) => delete this.editOptionPrices[o._id]);
      return;
    }
    this.editOwnGroups.add(g._id);
    g.options.filter((o) => o.active).forEach((o) => (this.editOptionPrices[o._id] = Math.round(((Number(this.editItemPrice) || 0) + o.priceDelta) * 100) / 100));
  }

  // Los precios que se guardan: solo los de grupos ofrecidos con precios propios, y sin los vacíos
  private ownPricesToSave(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const g of this.modifierGroups) {
      if (!this.editOwnGroups.has(g._id) || !this.editItemGroupIds.includes(g._id)) continue;
      for (const o of g.options) {
        const v = this.editOptionPrices[o._id];
        if (v !== null && v !== undefined && (v as unknown) !== '' && Number.isFinite(Number(v))) out[o._id] = Number(v);
      }
    }
    return out;
  }

  // El precio base del plato pasa a ser el más bajo de sus tamaños (es el "Desde" de la carta)
  get ownPricesMin(): number | null {
    const v = Object.values(this.ownPricesToSave());
    return v.length ? Math.min(...v) : null;
  }

  // Después de cargar una planilla: platos, tamaños y categorías pueden haber cambiado
  onSizesImported() {
    this.showSizeImport = false;
    this.loadModifierGroups();
    this.loadCategories();
    this.gestionService.refreshMenu().subscribe((menuItems) => (this.menuItems = menuItems));
    this.categoriesPanel?.load();
  }

  hasOwnPrices(item: MenuItem): boolean {
    return !!item.optionPrices && Object.keys(item.optionPrices).length > 0;
  }

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

  // ¿Se ve en la carta online y en el pedido por QR? (los platos de antes no tienen el dato: se ven)
  isVisible(item: MenuItem): boolean {
    return item.visibleInMenu !== false;
  }

  // Cierra el menú del filtro (clic afuera o Escape). Es un método que no devuelve nada: una expresión que da false en el template cancela el clic (rompía todos los checkboxes)
  closeVisFilter(event?: Event, host?: HTMLElement): void {
    if (this.visFilterOpen && (!event || !host || !host.contains(event.target as Node))) this.visFilterOpen = false;
  }

  setVisibility(v: 'all' | 'visible' | 'hidden') {
    this.menuVisibility = v;
    this.visFilterOpen = false;
  }

  visCountOf(v: 'all' | 'visible' | 'hidden'): number {
    return v === 'all' ? this.menuItems.length : v === 'visible' ? this.visibleCount : this.hiddenCount;
  }

  get visFilterLabel(): string {
    return this.visOptions.find((o) => o.key === this.menuVisibility)?.label ?? 'Todos';
  }

  get visibleCount(): number {
    return this.menuItems.filter((m) => this.isVisible(m)).length;
  }

  get hiddenCount(): number {
    return this.menuItems.length - this.visibleCount;
  }

  // Interruptor de cada fila: cambia al instante y vuelve atrás si el servidor no lo guarda
  toggleVisibility(item: MenuItem) {
    const next = !this.isVisible(item);
    item.visibleInMenu = next;
    this.gestionService.setMenuVisibility(item._id, next).subscribe({
      next: () => this.snackBar.open(next ? 'Visible en la carta' : 'Oculto de la carta', 'Cerrar', { duration: 2000 }),
      error: () => {
        item.visibleInMenu = !next;
        this.snackBar.open('No se pudo cambiar. Probá de nuevo.', 'Cerrar', { duration: 3500 });
      },
    });
  }

  // Foto del plato: id del que se está subiendo o quitando (para mostrar "Subiendo…")
  imageBusy: string | null = null;

  // El plato que se está editando en el diálogo (para mostrar y cambiar su foto)
  get editItem(): MenuItem | undefined {
    return this.menuItems.find((m) => m._id === this.editItemId);
  }

  badgeSwatch(key: string): string {
    return this.badgeColors.find((c) => c.key === key)?.swatch ?? 'bg-[#c2703d]';
  }

  get imagesAvailable(): boolean {
    return !!this.settings.value.imagesAvailable;
  }

  async onImagePicked(item: MenuItem, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite volver a elegir la misma foto
    if (!file) return;
    this.imageBusy = item._id;
    try {
      const updated = await this.menuImages.upload(item._id, file);
      item.imageUrl = updated.imageUrl ?? null;
      this.gestionService.refreshMenu().subscribe({ error: () => {} });
      this.snackBar.open('Foto guardada', 'Cerrar', { duration: 2500 });
    } catch (e: any) {
      const msg = e?.error?.message ?? e?.message;
      this.snackBar.open(Array.isArray(msg) ? msg.join('. ') : msg || 'No se pudo guardar la foto', 'Cerrar', { duration: 5000 });
    } finally {
      this.imageBusy = null;
    }
  }

  removeImage(item: MenuItem) {
    this.imageBusy = item._id;
    this.menuImages.remove(item._id).subscribe({
      next: () => {
        item.imageUrl = null;
        this.imageBusy = null;
        this.gestionService.refreshMenu().subscribe({ error: () => {} });
      },
      error: () => {
        this.imageBusy = null;
        this.snackBar.open('No se pudo quitar la foto', 'Cerrar', { duration: 4000 });
      },
    });
  }

  startEditingMenu(item: MenuItem) {
    this.editItemId = item._id;
    this.editItemName = item.name;
    this.editItemPrice = item.price;
    this.editItemIsPromo = !!item.isPromo;
    this.editItemCategoryId = item.categoryId ?? '';
    this.editItemGroupIds = [...(item.modifierGroupIds ?? [])];
    this.editItemDescription = item.description ?? '';
    this.editItemBadge = item.badge ?? '';
    this.editItemBadgeColor = item.badgeColor ?? 'terracotta';
    this.editItemFeatured = !!item.featured;
    this.editItemVisible = item.visibleInMenu !== false;
    this.editOptionPrices = { ...(item.optionPrices ?? {}) };
    this.editOwnGroups = new Set(this.modifierGroups.filter((g) => g.options.some((o) => o._id in this.editOptionPrices)).map((g) => g._id));
    this.openEditDialog(this.editMenuDialog, () => (this.editItemId = undefined));
  }

  saveMenuItemEdit() {
    if (this.editItemId !== undefined) {
      const optionPrices = this.ownPricesToSave();
      const lowest = Object.values(optionPrices).length ? Math.min(...Object.values(optionPrices)) : null;
      this.gestionService.editMenuItem(this.editItemId, this.editItemName, lowest ?? this.editItemPrice, this.editItemIsPromo, this.editItemCategoryId || null, this.editItemGroupIds, {
        optionPrices,
        description: this.editItemDescription,
        badge: this.editItemBadge,
        badgeColor: this.editItemBadgeColor,
        featured: this.editItemFeatured,
        visibleInMenu: this.editItemVisible,
      }).subscribe(() => {
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
