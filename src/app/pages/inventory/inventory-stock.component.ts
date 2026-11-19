import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { InventoryService, StockItem, STOCK_UNITS, errorText } from 'src/app/services/inventory.service';
import { MAX_BULK_LINES, ParsedStockLine, STATUS_LABELS, costUnitLabel, formatQty, parseStockLines, toShownCost, toStoredCost, unitShort } from 'src/app/utils/stock';
import { of } from 'rxjs';
import { catchError, concatMap, toArray } from 'rxjs/operators';
import { from } from 'rxjs';

type PanelMode = 'purchase' | 'waste' | 'adjust' | 'edit';

@Component({
  selector: 'app-inventory-stock',
  templateUrl: './inventory-stock.component.html',
})
export class InventoryStockComponent implements OnInit {
  // Avisa a Inventario cuando cambian los insumos (para actualizar la guía de arranque)
  @Output() changed = new EventEmitter<void>();

  items: StockItem[] = [];
  loading = true;
  busy = false;
  search = '';
  onlyAlerts = false;

  units = STOCK_UNITS;
  formatQty = formatQty;
  unitShort = unitShort;
  costUnitLabel = costUnitLabel;
  toShownCost = toShownCost;
  statusLabels = STATUS_LABELS;

  // Alta de insumo
  creating = false;
  private autoOpened = false;
  newItem = { name: '', unit: 'unidad', minStock: null as number | null, cost: null as number | null, initial: null as number | null };

  // Panel de una fila (entrada, merma, ajuste o edición)
  panel: { id: string; mode: PanelMode } | null = null;
  form = { quantity: null as number | null, cost: null as number | null, supplier: '', note: '', reason: '', counted: null as number | null, name: '', minStock: null as number | null, active: true };

  constructor(private inventory: InventoryService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.inventory.items().subscribe({
      next: (items) => {
        this.items = items;
        this.loading = false;
        // Sin ningún insumo, la carga de varios ya viene abierta: lo más rápido para empezar
        if (items.length === 0 && !this.autoOpened) {
          this.autoOpened = true;
          this.bulk = true;
        }
        this.changed.emit();
      },
      error: (err) => {
        this.loading = false;
        this.notify(errorText(err, 'No se pudo cargar el inventario'));
      },
    });
  }

  get filtered(): StockItem[] {
    const q = this.search.trim().toLowerCase();
    return this.items.filter((i) => (!q || i.name.toLowerCase().includes(q)) && (!this.onlyAlerts || i.status !== 'ok'));
  }

  get alertCount(): number {
    return this.items.filter((i) => i.active && i.status !== 'ok').length;
  }

  // ---- alta de varios a la vez ----

  bulk = false;
  bulkText = '';
  bulkBusy = false;
  readonly bulkExample = 'Café en grano 5 kg\nLeche 20 litros\nAzúcar 10 kg\nVasos 200\nCoca-Cola 1.25L 24';
  readonly maxBulk = MAX_BULK_LINES;

  // La vista previa se recalcula en cada ciclo: sin esto el botón "Crear igual" se recrea y el clic se pierde
  trackBulk = (index: number, r: { name: string }) => index + "|" + r.name;

  toggleCreating() {
    this.creating = !this.creating;
    if (this.creating) this.bulk = false;
  }

  toggleBulk() {
    this.bulk = !this.bulk;
    if (this.bulk) this.creating = false;
  }

  useExample() {
    this.bulkText = this.bulkExample;
  }

  private norm(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  // Palabras que cuentan de un nombre ("Granos de café" y "Café en grano" comparten café y grano)
  private tokens(name: string): string[] {
    const stop = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'con', 'y', 'x']);
    return this.norm(name)
      .split(' ')
      .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
      .filter((w) => w && !stop.has(w));
  }

  // Un nombre "se parece" a otro si todas las palabras del más corto están en el más largo
  private similarTo(name: string, pool: string[]): string | null {
    const mine = this.tokens(name);
    if (!mine.length) return null;
    for (const other of pool) {
      const theirs = this.tokens(other);
      if (!theirs.length) continue;
      const [small, big] = mine.length <= theirs.length ? [mine, theirs] : [theirs, mine];
      if (small.every((w) => big.includes(w))) return other;
    }
    return null;
  }

  // Los parecidos que el usuario decidió crear igual (por nombre)
  private forced = new Set<string>();

  toggleForce(r: { name: string }) {
    const key = this.norm(r.name);
    if (this.forced.has(key)) this.forced.delete(key);
    else this.forced.add(key);
  }

  // Lo que se entiende de la lista, marcando los que ya existen, están repetidos o se parecen a uno que ya tenés
  get bulkRows(): (ParsedStockLine & { dup: boolean; similar: string | null; forced: boolean })[] {
    const pool = this.items.map((i) => i.name);
    const seen = new Set(pool.map((n) => this.norm(n)));
    return parseStockLines(this.bulkText).map((r) => {
      const key = this.norm(r.name);
      const dup = r.ok && seen.has(key);
      const similar = r.ok && !dup ? this.similarTo(r.name, pool) : null;
      const forced = !!similar && this.forced.has(key);
      if (r.ok && !dup) {
        seen.add(key);
        // si se crea, los siguientes de la lista se comparan también con este
        if (!similar || forced) pool.push(r.name);
      }
      return { ...r, dup, similar, forced };
    });
  }

  get bulkReady(): ParsedStockLine[] {
    return this.bulkRows.filter((r) => r.ok && !r.dup && (!r.similar || r.forced));
  }

  createMany() {
    const rows = this.bulkReady;
    if (this.bulkBusy || !rows.length) return;
    this.bulkBusy = true;
    // de a uno y en orden: si alguno falla, los demás se crean igual y se avisa cuáles faltaron
    from(rows)
      .pipe(
        concatMap((r) =>
          this.inventory.createItem({ name: r.name, unit: r.unit, minStock: 0, costPerUnit: 0, initialQuantity: r.quantity }).pipe(
            concatMap(() => of({ row: r, ok: true })),
            catchError(() => of({ row: r, ok: false })),
          ),
        ),
        toArray(),
      )
      .subscribe((results) => {
        this.bulkBusy = false;
        const failed = results.filter((x) => !x.ok).map((x) => x.row.line);
        const created = results.length - failed.length;
        this.bulkText = failed.join('\n'); // lo que no se pudo crear queda para reintentar
        if (!failed.length) this.bulk = false;
        this.load();
        this.notify(
          failed.length
            ? `Se crearon ${created}. No se pudieron crear ${failed.length}: revisalos abajo.`
            : created === 1 ? 'Se creó 1 insumo' : `Se crearon ${created} insumos`,
        );
      });
  }

  // ---- alta ----

  create() {
    const n = this.newItem;
    if (this.busy || !n.name.trim()) return;
    this.busy = true;
    this.inventory
      .createItem({
        name: n.name.trim(),
        unit: n.unit,
        minStock: n.minStock ?? 0,
        costPerUnit: n.cost === null ? 0 : toStoredCost(n.cost, n.unit),
        initialQuantity: n.initial ?? 0,
      })
      .subscribe({
        next: () => {
          this.busy = false;
          this.newItem = { name: '', unit: n.unit, minStock: null, cost: null, initial: null };
          this.creating = false;
          this.load();
          this.notify('Insumo creado');
        },
        error: (err) => this.fail(err, 'No se pudo crear el insumo'),
      });
  }

  // ---- panel de fila ----

  open(item: StockItem, mode: PanelMode) {
    if (this.panel?.id === item._id && this.panel.mode === mode) {
      this.panel = null;
      return;
    }
    this.panel = { id: item._id, mode };
    this.form = {
      quantity: null,
      cost: null,
      supplier: '',
      note: '',
      reason: '',
      counted: item.onHand,
      name: item.name,
      minStock: item.minStock,
      active: item.active,
    };
  }

  isOpen(item: StockItem, mode: PanelMode): boolean {
    return this.panel?.id === item._id && this.panel.mode === mode;
  }

  submit(item: StockItem) {
    if (!this.panel || this.busy) return;
    const f = this.form;
    let request;
    let done = 'Listo';

    switch (this.panel.mode) {
      case 'purchase':
        if (!f.quantity || f.quantity <= 0) return;
        request = this.inventory.purchase(item._id, {
          quantity: f.quantity,
          unitCost: f.cost === null ? undefined : toStoredCost(f.cost, item.unit),
          supplier: f.supplier,
          note: f.note,
        });
        done = 'Entrada registrada';
        break;
      case 'waste':
        if (!f.quantity || f.quantity <= 0 || !f.reason.trim()) return;
        request = this.inventory.waste(item._id, { quantity: f.quantity, reason: f.reason.trim() });
        done = 'Merma registrada';
        break;
      case 'adjust':
        if (f.counted === null || f.counted < 0) return;
        request = this.inventory.adjust(item._id, { counted: f.counted, note: f.note || 'Ajuste manual' });
        done = 'Stock ajustado';
        break;
      default:
        if (!f.name.trim()) return;
        request = this.inventory.updateItem(item._id, {
          name: f.name.trim(),
          minStock: f.minStock ?? 0,
          active: f.active,
        });
        done = 'Cambios guardados';
    }

    this.busy = true;
    request.subscribe({
      next: () => {
        this.busy = false;
        this.panel = null;
        this.load();
        this.notify(done);
      },
      error: (err) => this.fail(err, 'No se pudo completar la operación'),
    });
  }

  // Cambiar el costo por kilo/litro (se guarda por gramo/mililitro)
  saveCost(item: StockItem, shown: number | null) {
    if (shown === null || shown < 0) return;
    this.inventory.updateItem(item._id, { costPerUnit: toStoredCost(shown, item.unit) }).subscribe({
      next: () => {
        this.load();
        this.notify('Costo actualizado');
      },
      error: (err) => this.fail(err, 'No se pudo actualizar el costo'),
    });
  }

  remove(item: StockItem) {
    if (!window.confirm(`¿Eliminar el insumo "${item.name}"?`)) return;
    this.inventory.deleteItem(item._id).subscribe({
      next: () => {
        this.load();
        this.notify('Insumo eliminado');
      },
      error: (err) => this.notify(errorText(err, 'No se pudo eliminar el insumo')),
    });
  }

  trackById = (_: number, i: StockItem) => i._id;

  private fail(err: any, fallback: string) {
    this.busy = false;
    this.notify(errorText(err, fallback));
  }

  private notify(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 3500 });
  }
}
