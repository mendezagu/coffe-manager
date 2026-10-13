import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DishRecipe, InventoryService, errorText } from 'src/app/services/inventory.service';

// Por debajo de este margen se marca el plato (el costo se come casi todo el precio)
const LOW_MARGIN_PCT = 40;

@Component({
  selector: 'app-inventory-profit',
  templateUrl: './inventory-profit.component.html',
})
export class InventoryProfitComponent implements OnInit {
  dishes: DishRecipe[] = [];
  loading = true;
  sortBy: 'marginPct' | 'margin' | 'name' = 'marginPct';
  lowMargin = LOW_MARGIN_PCT;

  constructor(private inventory: InventoryService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.inventory.recipes().subscribe({
      next: (d) => {
        this.dishes = d;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.snackBar.open(errorText(err, 'No se pudo cargar'), 'Cerrar', { duration: 4000 });
      },
    });
  }

  // Solo los platos con receta tienen costo: el resto no entra en el cálculo
  get rows(): DishRecipe[] {
    const list = this.dishes.filter((d) => d.cost !== null);
    return [...list].sort((a, b) =>
      this.sortBy === 'name' ? a.name.localeCompare(b.name, 'es') : ((b[this.sortBy] ?? -Infinity) as number) - ((a[this.sortBy] ?? -Infinity) as number),
    );
  }

  get withoutRecipe(): number {
    return this.dishes.filter((d) => d.cost === null).length;
  }

  get averageMargin(): number | null {
    const withPct = this.rows.filter((r) => r.marginPct !== null);
    return withPct.length ? withPct.reduce((s, r) => s + (r.marginPct as number), 0) / withPct.length : null;
  }
}
