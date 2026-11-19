import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { SettingsService } from 'src/app/services/settings.service';
import { PlanService } from 'src/app/services/plan.service';
import { InventoryService } from 'src/app/services/inventory.service';

type Tab = 'stock' | 'recipes' | 'profit' | 'control';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
})
export class InventoryComponent implements OnInit {
  tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'stock', label: 'Stock', icon: 'inventory_2' },
    { key: 'recipes', label: 'Recetas', icon: 'menu_book' },
    { key: 'profit', label: 'Rentabilidad', icon: 'trending_up' },
    { key: 'control', label: 'Control', icon: 'checklist' },
  ];
  tab: Tab = 'stock';
  // Control reúne el conteo (contar lo que hay) y los movimientos (qué entró y qué salió)
  control: 'count' | 'movements' = 'count';
  loaded = false;

  // Avance de la puesta en marcha: con qué se cuenta para guiar al usuario y para mostrar solo lo que ya sirve
  setupLoaded = false;
  hasItems = false;
  hasRecipes = false;
  dishTotal = 0; // platos en el menú
  dishWithRecipe = 0; // y cuántos ya tienen receta
  // La guía se puede ocultar (queda guardado en este equipo)
  guideHidden = this.readHidden();

  constructor(
    public settings: SettingsService,
    public plans: PlanService,
    private inventory: InventoryService,
  ) {}

  get locked(): boolean {
    return this.plans.locked('inventory');
  }

  ngOnInit() {
    // el estado vigente viene del servidor (el plan o el ajuste pudieron cambiar)
    this.settings.refresh().subscribe({
      next: () => {
        this.loaded = true;
        if (this.enabled) this.refreshSetup();
      },
      error: () => (this.loaded = true),
    });
  }

  get enabled(): boolean {
    return !!this.settings.value.inventoryActive;
  }

  // Se vuelve a mirar cada vez que Stock o Recetas guardan algo
  refreshSetup() {
    forkJoin({ items: this.inventory.items(), recipes: this.inventory.recipes() }).subscribe({
      next: ({ items, recipes }) => {
        this.hasItems = items.some((i) => i.active);
        this.hasRecipes = recipes.some((d) => d.ingredients.length > 0);
        this.dishTotal = recipes.length;
        this.dishWithRecipe = recipes.filter((d) => d.ingredients.length > 0).length;
        this.setupLoaded = true;
        if (!this.visibleTabs.some((t) => t.key === this.tab)) this.tab = 'stock';
      },
      // Si no se pudo saber, no se esconde nada
      error: () => {
        this.hasItems = this.hasRecipes = true;
        this.setupLoaded = true;
      },
    });
  }

  // Puesta en marcha completa: hay insumos y todos los platos tienen su receta
  get setupDone(): boolean {
    return this.hasItems && this.dishTotal > 0 && this.dishWithRecipe >= this.dishTotal;
  }

  get showGuide(): boolean {
    return !this.setupDone && !this.guideHidden;
  }

  // Avance de 0 a 100: la mitad son los insumos y la otra mitad, las recetas de todos los platos
  get percent(): number {
    const recipes = this.dishTotal ? this.dishWithRecipe / this.dishTotal : 0;
    return Math.round((this.hasItems ? 50 : 0) + 50 * recipes);
  }

  hideGuide(): void {
    this.guideHidden = true;
    try {
      localStorage.setItem('inventoryGuideHidden', '1');
    } catch {
      /* sin persistencia */
    }
  }

  private readHidden(): boolean {
    try {
      return localStorage.getItem('inventoryGuideHidden') === '1';
    } catch {
      return false;
    }
  }

  // Stock y Recetas siempre; Control cuando hay insumos y Rentabilidad cuando hay una receta
  get visibleTabs() {
    return this.tabs.filter((t) => t.key === 'stock' || t.key === 'recipes' || (t.key === 'profit' && this.hasRecipes) || (t.key === 'control' && this.hasItems));
  }

  // Pasos de la guía; el primero pendiente es el "próximo"
  get steps(): { done: boolean; title: string; hint: string; cta: string; tab: Tab }[] {
    return [
      { done: this.hasItems, title: 'Cargá tus insumos', hint: 'Lo que se gasta al vender: café, leche, vasos o una gaseosa.', cta: 'Cargar insumos', tab: 'stock' },
      {
        done: this.dishTotal > 0 && this.dishWithRecipe >= this.dishTotal,
        title: 'Armá la receta de tus platos',
        hint: this.dishTotal ? `${this.dishWithRecipe} de ${this.dishTotal} platos con receta. Con la receta, el stock se descuenta solo en cada venta.` : 'Qué gasta cada plato, para que el stock se descuente solo en cada venta.',
        cta: this.dishWithRecipe ? 'Seguir con las recetas' : 'Armar una receta',
        tab: 'recipes',
      },
    ];
  }

  get nextStep(): number {
    return this.steps.findIndex((s) => !s.done);
  }

  get doneCount(): number {
    return this.steps.filter((s) => s.done).length;
  }


  go(tab: Tab) {
    this.tab = tab;
  }
}
