import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CountResult, InventoryService, StockItem, errorText } from 'src/app/services/inventory.service';
import { formatQty } from 'src/app/utils/stock';

@Component({
  selector: 'app-inventory-count',
  templateUrl: './inventory-count.component.html',
})
export class InventoryCountComponent implements OnInit {
  items: StockItem[] = [];
  counted: Record<string, number | null> = {};
  note = '';
  loading = true;
  busy = false;
  search = '';
  result: CountResult | null = null;

  formatQty = formatQty;

  constructor(private inventory: InventoryService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.inventory.items().subscribe({
      next: (items) => {
        this.items = items.filter((i) => i.active);
        this.counted = {};
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
    return this.items.filter((i) => !q || i.name.toLowerCase().includes(q));
  }

  // Solo se ajustan los insumos que se contaron
  get filled(): { stockItemId: string; counted: number }[] {
    return this.items
      .filter((i) => this.counted[i._id] !== null && this.counted[i._id] !== undefined && Number(this.counted[i._id]) >= 0)
      .map((i) => ({ stockItemId: i._id, counted: Number(this.counted[i._id]) }));
  }

  difference(item: StockItem): number | null {
    const c = this.counted[item._id];
    return c === null || c === undefined ? null : Math.round((Number(c) - item.onHand) * 10000) / 10000;
  }

  confirm() {
    if (this.busy || this.filled.length === 0) return;
    const diffs = this.items.filter((i) => (this.difference(i) ?? 0) !== 0).length;
    const msg = diffs
      ? `Se van a corregir ${diffs} ${diffs === 1 ? 'insumo' : 'insumos'} con la cantidad que contaste. ¿Confirmás?`
      : 'Lo que contaste coincide con el sistema. ¿Registrar el conteo?';
    if (!window.confirm(msg)) return;

    this.busy = true;
    this.inventory.count({ counts: this.filled, note: this.note }).subscribe({
      next: (result) => {
        this.busy = false;
        this.result = result;
        this.note = '';
        this.load();
      },
      error: (err) => {
        this.busy = false;
        this.notify(errorText(err, 'No se pudo registrar el conteo'));
      },
    });
  }

  private notify(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 4000 });
  }
}
