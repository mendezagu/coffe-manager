import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DishRecipe, InventoryService, OptionRecipe, StockItem, errorText } from 'src/app/services/inventory.service';
import { unitShort } from 'src/app/utils/stock';

interface Row {
  stockItemId: string;
  quantity: number | null;
  replacesStockItemId?: string; // solo en opciones
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

@Component({
  selector: 'app-inventory-recipes',
  templateUrl: './inventory-recipes.component.html',
})
export class InventoryRecipesComponent implements OnInit {
  mode: 'dishes' | 'options' = 'dishes';
  loading = true;
  busy = false;

  dishes: DishRecipe[] = [];
  options: OptionRecipe[] = [];
  items: StockItem[] = [];

  search = '';
  filter: 'all' | 'with' | 'without' = 'all';

  // Plato o extra que se está editando
  dishId: string | null = null;
  optionId: string | null = null;
  rows: Row[] = [];

  unitShort = unitShort;

  // Para vincular un producto que se vende tal cual con un insumo que ya existe
  simpleItemId = '';

  constructor(private inventory: InventoryService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.load();
  }

  load() {
    let pending = 3;
    const done = () => {
      if (--pending === 0) this.loading = false;
    };
    const fail = (err: any) => {
      done();
      this.notify(errorText(err, 'No se pudo cargar'));
    };
    this.inventory.recipes().subscribe({ next: (d) => { this.dishes = d; done(); }, error: fail });
    this.inventory.options().subscribe({ next: (o) => { this.options = o; done(); }, error: fail });
    this.inventory.items().subscribe({ next: (i) => { this.items = i.filter((x) => x.active); done(); }, error: fail });
  }

  setMode(mode: 'dishes' | 'options') {
    this.mode = mode;
    this.dishId = null;
    this.optionId = null;
    this.rows = [];
  }

  // ---- platos ----

  get filteredDishes(): DishRecipe[] {
    const q = normalize(this.search);
    return this.dishes.filter(
      (d) =>
        (!q || normalize(d.name).includes(q)) &&
        (this.filter === 'all' || (this.filter === 'with' ? d.ingredients.length > 0 : d.ingredients.length === 0)),
    );
  }

  get withRecipe(): number {
    return this.dishes.filter((d) => d.ingredients.length > 0).length;
  }

  get selectedDish(): DishRecipe | undefined {
    return this.dishes.find((d) => d.menuItemId === this.dishId);
  }

  editDish(d: DishRecipe) {
    this.dishId = d.menuItemId;
    this.simpleItemId = '';
    this.rows = d.ingredients.map((i) => ({ stockItemId: i.stockItemId, quantity: i.quantity }));
  }

  // Costo de la receta que se está armando, con los costos actuales
  get previewCost(): number {
    return this.rows.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (this.item(r.stockItemId)?.costPerUnit ?? 0), 0);
  }

  get previewMargin(): number | null {
    const d = this.selectedDish;
    return d && this.rows.length ? d.price - this.previewCost : null;
  }

  saveDish() {
    const d = this.selectedDish;
    if (!d || this.busy) return;
    const ingredients = this.cleanRows();
    if (!ingredients) return;
    this.busy = true;
    this.inventory.setRecipe(d.menuItemId, ingredients).subscribe({
      next: () => {
        this.busy = false;
        this.load();
        this.notify(ingredients.length ? 'Receta guardada' : 'Receta borrada');
      },
      error: (err) => this.fail(err, 'No se pudo guardar la receta'),
    });
  }

  // Insumos que se cuentan por unidad (candidatos a "producto que se vende tal cual")
  get unitItems(): StockItem[] {
    return this.items.filter((i) => i.unit === 'unidad');
  }

  // Vincula el plato con un insumo que ya existe: cada venta descuenta 1 unidad de ese insumo
  linkSimple(d: DishRecipe) {
    if (!this.simpleItemId || this.busy) return;
    this.busy = true;
    this.inventory.setRecipe(d.menuItemId, [{ stockItemId: this.simpleItemId, quantity: 1 }]).subscribe({
      next: () => {
        this.busy = false;
        this.load();
        this.notify('Listo: ahora cada venta descuenta 1 unidad');
      },
      error: (err) => this.fail(err, 'No se pudo guardar la receta'),
    });
  }

  // Producto que se vende tal cual (una gaseosa): su "receta" es 1 unidad de un insumo con su mismo nombre
  makeSimple(d: DishRecipe) {
    if (this.busy) return;
    const existing = this.items.find((i) => normalize(i.name) === normalize(d.name) && i.unit === 'unidad');
    this.busy = true;
    const finish = (stockItemId: string) =>
      this.inventory.setRecipe(d.menuItemId, [{ stockItemId, quantity: 1 }]).subscribe({
        next: () => {
          this.busy = false;
          this.load();
          this.notify(existing ? 'Listo' : 'Listo: se creó el insumo. Cargá cuántas unidades tenés en Stock.');
        },
        error: (err) => this.fail(err, 'No se pudo guardar la receta'),
      });
    if (existing) {
      finish(existing._id);
      return;
    }
    this.inventory.createItem({ name: d.name, unit: 'unidad' }).subscribe({
      next: (created) => finish(created._id),
      error: (err) => this.fail(err, 'No se pudo crear el insumo'),
    });
  }

  // ---- extras (opciones de un modificador) ----

  get selectedOption(): OptionRecipe | undefined {
    return this.options.find((o) => o.optionId === this.optionId);
  }

  editOption(o: OptionRecipe) {
    this.optionId = o.optionId;
    this.rows = o.ingredients.map((i) => ({ stockItemId: i.stockItemId, quantity: i.quantity, replacesStockItemId: i.replacesStockItemId ?? '' }));
  }

  saveOption() {
    const o = this.selectedOption;
    if (!o || this.busy) return;
    const lines = this.cleanRows(true);
    if (!lines) return;
    this.busy = true;
    this.inventory
      .setOptionIngredients(
        o.optionId,
        lines.map((l) => ({ stockItemId: l.stockItemId, quantity: l.quantity, replacesStockItemId: l.replacesStockItemId || null })),
      )
      .subscribe({
        next: () => {
          this.busy = false;
          this.load();
          this.notify('Guardado');
        },
        error: (err) => this.fail(err, 'No se pudo guardar'),
      });
  }

  // ---- filas del editor ----

  addRow() {
    const used = new Set(this.rows.map((r) => r.stockItemId));
    const next = this.items.find((i) => !used.has(i._id));
    if (!next) {
      this.notify('No quedan insumos para agregar. Creá uno nuevo en Stock.');
      return;
    }
    this.rows.push({ stockItemId: next._id, quantity: null, ...(this.mode === 'options' ? { replacesStockItemId: '' } : {}) });
  }

  removeRow(index: number) {
    this.rows.splice(index, 1);
  }

  item(id: string): StockItem | undefined {
    return this.items.find((i) => i._id === id);
  }

  // Insumos que todavía no están en el editor (más el que tiene la fila, para poder mostrarlo)
  choices(row: Row): StockItem[] {
    const used = new Set(this.rows.filter((r) => r !== row).map((r) => r.stockItemId));
    return this.items.filter((i) => !used.has(i._id));
  }

  private cleanRows(allowZero = false) {
    for (const r of this.rows) {
      const q = Number(r.quantity);
      if (!Number.isFinite(q) || q < 0 || (!allowZero && q === 0) || r.quantity === null) {
        this.notify('Completá la cantidad de cada insumo');
        return null;
      }
    }
    return this.rows.map((r) => ({ stockItemId: r.stockItemId, quantity: Number(r.quantity), replacesStockItemId: r.replacesStockItemId }));
  }

  private fail(err: any, fallback: string) {
    this.busy = false;
    this.notify(errorText(err, fallback));
  }

  private notify(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 4000 });
  }
}
