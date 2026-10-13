import { Component, OnInit } from '@angular/core';
import { InventoryService, StockItem, StockMovement, errorText } from 'src/app/services/inventory.service';
import { MOVEMENT_LABELS, formatQty } from 'src/app/utils/stock';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-inventory-movements',
  templateUrl: './inventory-movements.component.html',
})
export class InventoryMovementsComponent implements OnInit {
  movements: StockMovement[] = [];
  items: StockItem[] = [];
  stockItemId = '';
  loading = true;

  labels = MOVEMENT_LABELS;
  formatQty = formatQty;

  constructor(private inventory: InventoryService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.inventory.items().subscribe({ next: (i) => (this.items = i), error: () => {} });
    this.load();
  }

  load() {
    this.loading = true;
    this.inventory.movements({ stockItemId: this.stockItemId || undefined, limit: 200 }).subscribe({
      next: (m) => {
        this.movements = m;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.snackBar.open(errorText(err, 'No se pudieron cargar los movimientos'), 'Cerrar', { duration: 4000 });
      },
    });
  }
}
