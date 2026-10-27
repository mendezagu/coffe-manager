import { Component, OnInit } from '@angular/core';
import { SettingsService } from 'src/app/services/settings.service';
import { PlanService } from 'src/app/services/plan.service';

type Tab = 'stock' | 'recipes' | 'count' | 'movements' | 'profit';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
})
export class InventoryComponent implements OnInit {
  tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'stock', label: 'Stock', icon: 'inventory_2' },
    { key: 'recipes', label: 'Recetas', icon: 'menu_book' },
    { key: 'count', label: 'Conteo', icon: 'checklist' },
    { key: 'movements', label: 'Movimientos', icon: 'history' },
    { key: 'profit', label: 'Rentabilidad', icon: 'trending_up' },
  ];
  tab: Tab = 'stock';
  loaded = false;

  constructor(public settings: SettingsService, public plans: PlanService) {}

  get locked(): boolean {
    return this.plans.locked('inventory');
  }

  ngOnInit() {
    // el estado vigente viene del servidor (el plan o el ajuste pudieron cambiar)
    this.settings.refresh().subscribe({ next: () => (this.loaded = true), error: () => (this.loaded = true) });
  }

  get enabled(): boolean {
    return !!this.settings.value.inventoryActive;
  }
}
