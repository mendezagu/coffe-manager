import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DishRecipe, InventoryService, OptionRecipe, StockItem, errorText } from 'src/app/services/inventory.service';
import { convertQty, nameTokens, namesSimilar, normalizeName, parseStockLines, unitHint, unitShort } from 'src/app/utils/stock';

interface Row {
  stockItemId: string;
  quantity: number | null;
  // unidad en la que se escribe la cantidad (ej: ml aunque el insumo se cuente en litros)
  unit?: string;
  replacesStockItemId?: string; // solo en opciones
}

// Una línea de la receta escrita y lo que se entendió de ella
interface RecipeLine {
  key: string;
  line: string;
  name: string;
  quantity: number;
  unit: string;
  status: 'ok' | 'missing' | 'problem';
  item?: StockItem;
  qtyItem?: number; // en la unidad del insumo
  problem?: string;
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

@Component({
  selector: 'app-inventory-recipes',
  templateUrl: './inventory-recipes.component.html',
})
export class InventoryRecipesComponent implements OnInit {
  // Avisa a Inventario cuando cambian las recetas (para actualizar la guía de arranque)
  @Output() changed = new EventEmitter<void>();

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

  // ---- receta escrita en texto ----
  // 'text': se escribe una línea por ingrediente ("Leche 100 ml"). 'rows': se arma de a uno, eligiendo de la lista.
  recipeMode: 'text' | 'rows' = 'text';
  recipeText = '';
  // Insumo elegido a mano para una línea que no se encontró por nombre (clave = nombre escrito)
  private picked: Record<string, string> = {};
  creatingLine = false;

  // Las líneas se recalculan en cada ciclo: sin esto Angular recrea los botones y un clic que los cruza se pierde
  trackLine = (index: number, l: { key: string }) => index + "|" + l.key;

  // Qué se entendió de cada línea
  get textLines(): RecipeLine[] {
    return parseStockLines(this.recipeText).map((p) => {
      const key = normalizeName(p.name);
      const base = { key, line: p.line, name: p.name, quantity: p.quantity, unit: p.unit };
      if (!p.ok) return { ...base, status: 'problem' as const, problem: p.problem };
      if (!(p.quantity > 0)) return { ...base, status: 'problem' as const, problem: `Falta la cantidad. Escribila así: «100 g de ${p.name}» o «${p.name} 100 g».` };
      const item = this.picked[key] ? this.item(this.picked[key]) : this.findItem(p.name);
      if (!item) return { ...base, status: 'missing' as const };
      const qtyItem = convertQty(p.quantity, p.unit, item.unit);
      if (qtyItem === null) return { ...base, status: 'problem' as const, item, problem: `«${item.name}» se cuenta en ${unitHint(item.unit)}.` };
      return { ...base, status: 'ok' as const, item, qtyItem };
    });
  }

  // El insumo que más se parece al nombre escrito: primero el igual, después el parecido más cercano
  private findItem(name: string): StockItem | undefined {
    const n = normalizeName(name);
    const exact = this.items.find((i) => normalizeName(i.name) === n);
    if (exact) return exact;
    const mine = nameTokens(name).length;
    return this.items
      .filter((i) => namesSimilar(i.name, name))
      .sort((a, b) => Math.abs(nameTokens(a.name).length - mine) - Math.abs(nameTokens(b.name).length - mine))[0];
  }

  get canSaveText(): boolean {
    const lines = this.textLines;
    return lines.length > 0 && lines.every((l) => l.status === 'ok');
  }

  pick(line: RecipeLine, itemId: string) {
    if (itemId) this.picked = { ...this.picked, [line.key]: itemId };
  }

  // Crea el insumo que falta, ahí mismo: si la receta lo pide en ml o g, se cuenta en litros o kilos (como se compra)
  createFromLine(line: RecipeLine) {
    if (this.creatingLine) return;
    this.creatingLine = true;
    const unit = line.unit === 'ml' ? 'l' : line.unit === 'g' ? 'kg' : line.unit;
    this.inventory.createItem({ name: line.name, unit, minStock: 0, costPerUnit: 0, initialQuantity: 0 }).subscribe({
      next: (created) => {
        this.creatingLine = false;
        this.items = [...this.items, created];
        this.notify(`Se creó «${created.name}». Cargá cuánto tenés y su costo en Stock.`);
      },
      error: (err) => {
        this.creatingLine = false;
        this.notify(errorText(err, 'No se pudo crear el insumo'));
      },
    });
  }

  setRecipeMode(mode: 'text' | 'rows') {
    if (mode === this.recipeMode) return;
    if (mode === 'rows') {
      // lo ya entendido pasa a filas
      const ok = this.textLines.filter((l) => l.status === 'ok');
      if (ok.length) this.rows = ok.map((l) => ({ stockItemId: l.item!._id, quantity: l.quantity, unit: l.unit }));
    } else {
      this.recipeText = this.rows
        .map((r) => {
          const it = this.item(r.stockItemId);
          return it ? `${it.name} ${Number(r.quantity) || ''} ${unitShort(r.unit ?? it.unit)}`.replace(/\s+/g, ' ').trim() : '';
        })
        .filter(Boolean)
        .join('\n');
    }
    this.recipeMode = mode;
  }

  // Receta escrita: se guarda como las demás, con las cantidades ya pasadas a la unidad de cada insumo
  private saveFromText() {
    const d = this.selectedDish;
    if (!d || this.busy) return;
    if (!this.canSaveText) {
      this.notify('Resolvé las líneas marcadas antes de guardar');
      return;
    }
    const totals = new Map<string, number>();
    for (const l of this.textLines) totals.set(l.item!._id, Math.round(((totals.get(l.item!._id) ?? 0) + l.qtyItem!) * 1e4) / 1e4);
    const ingredients = [...totals.entries()].map(([stockItemId, quantity]) => ({ stockItemId, quantity }));
    this.busy = true;
    this.inventory.setRecipe(d.menuItemId, ingredients).subscribe({
      next: () => {
        this.busy = false;
        this.load();
        this.notify('Receta guardada');
      },
      error: (err) => this.fail(err, 'No se pudo guardar la receta'),
    });
  }

  // Hay algo que mostrar en el costo y la ganancia
  get hasPreview(): boolean {
    return this.recipeMode === 'text' ? this.textLines.some((l) => l.status === 'ok') : this.rows.length > 0;
  }

  // El plato todavía no tiene ingredientes escritos ni elegidos
  get noIngredients(): boolean {
    return this.recipeMode === 'text' ? !this.recipeText.trim() : this.rows.length === 0;
  }

  constructor(private inventory: InventoryService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.load();
  }

  load() {
    let pending = 3;
    const done = () => {
      if (--pending === 0) {
        this.loading = false;
        this.changed.emit();
      }
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
    // Un plato sin receta arranca escribiéndola; uno con receta se ve en filas
    this.recipeMode = d.ingredients.length ? 'rows' : 'text';
    this.recipeText = '';
    this.picked = {};
    this.rows = d.ingredients.map((i) => ({ stockItemId: i.stockItemId, ...this.shown(i.quantity, i.unit) }));
  }

  // Costo de la receta que se está armando, con los costos actuales
  get previewCost(): number {
    if (this.recipeMode === 'text') {
      return this.textLines.reduce((sum, l) => sum + (l.status === 'ok' ? l.qtyItem! * l.item!.costPerUnit : 0), 0);
    }
    return this.rows.reduce((sum, r) => sum + this.inItemUnit(r) * (this.item(r.stockItemId)?.costPerUnit ?? 0), 0);
  }

  get previewMargin(): number | null {
    const d = this.selectedDish;
    return d && this.hasPreview ? d.price - this.previewCost : null;
  }

  saveDish() {
    if (this.recipeMode === 'text') return this.saveFromText();
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
    this.rows = o.ingredients.map((i) => ({ stockItemId: i.stockItemId, ...this.shown(i.quantity, i.unit), replacesStockItemId: i.replacesStockItemId ?? '' }));
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
    this.rows.push({ stockItemId: next._id, quantity: null, unit: this.defaultUnit(next.unit), ...(this.mode === 'options' ? { replacesStockItemId: '' } : {}) });
  }

  removeRow(index: number) {
    this.rows.splice(index, 1);
  }

  // ---- unidades de la receta ----
  // Un insumo que se cuenta en litros se puede escribir en ml (y en kilos, en gramos): una receta usa 100 ml de leche,
  // no 0,1 litros. Se guarda siempre en la unidad del insumo.
  private readonly unitFamily: Record<string, string[]> = { l: ['ml', 'l'], ml: ['ml', 'l'], kg: ['g', 'kg'], g: ['g', 'kg'] };
  private readonly bigUnits = ['l', 'kg'];

  unitOptions(r: Row): string[] {
    const u = this.item(r.stockItemId)?.unit;
    return u ? this.unitFamily[u] ?? [u] : [];
  }

  private defaultUnit(itemUnit: string): string {
    return itemUnit === 'l' ? 'ml' : itemUnit === 'kg' ? 'g' : itemUnit;
  }

  // Al elegir otro insumo, la unidad vuelve a la más cómoda para ese insumo
  onItemChange(r: Row) {
    const it = this.item(r.stockItemId);
    if (it) r.unit = this.defaultUnit(it.unit);
  }

  // De lo escrito (en la unidad elegida) a la unidad del insumo
  private inItemUnit(r: Row): number {
    const q = Number(r.quantity) || 0;
    const itemUnit = this.item(r.stockItemId)?.unit;
    const shown = r.unit ?? itemUnit;
    if (!itemUnit || !shown || shown === itemUnit) return q;
    const itemBig = this.bigUnits.includes(itemUnit);
    const shownBig = this.bigUnits.includes(shown);
    const converted = itemBig && !shownBig ? q / 1000 : !itemBig && shownBig ? q * 1000 : q;
    return Math.round(converted * 1e4) / 1e4;
  }

  // De lo guardado a lo que se muestra: 0,1 l pasa a "100 ml"
  private shown(quantity: number, itemUnit: string): { quantity: number; unit: string } {
    if (this.bigUnits.includes(itemUnit) && quantity > 0 && quantity < 1) {
      return { quantity: Math.round(quantity * 1000 * 100) / 100, unit: this.defaultUnit(itemUnit) };
    }
    return { quantity, unit: itemUnit };
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
    return this.rows.map((r) => ({ stockItemId: r.stockItemId, quantity: this.inItemUnit(r), replacesStockItemId: r.replacesStockItemId }));
  }

  private fail(err: any, fallback: string) {
    this.busy = false;
    this.notify(errorText(err, fallback));
  }

  private notify(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 4000 });
  }
}
