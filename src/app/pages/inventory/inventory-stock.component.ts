import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { InventoryService, StockItem, STOCK_UNITS, errorText } from 'src/app/services/inventory.service';
import { STATUS_LABELS, costUnitLabel, formatQty, toShownCost, toStoredCost, unitShort } from 'src/app/utils/stock';

type PanelMode = 'purchase' | 'waste' | 'adjust' | 'edit';

@Component({
  selector: 'app-inventory-stock',
  templateUrl: './inventory-stock.component.html',
})
export class InventoryStockComponent implements OnInit {
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
