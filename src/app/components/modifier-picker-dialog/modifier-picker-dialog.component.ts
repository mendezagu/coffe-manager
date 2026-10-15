import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MenuItem, ModifierGroup, ModifierOption } from 'src/app/services/gestionService';
import { OrderModifier, modifiersText, modifiersTotal } from 'src/app/utils/modifiers';

export interface ModifierPickerData {
  item: MenuItem;
  groups: ModifierGroup[]; // solo los que ofrece el plato, con opciones activas
  units?: number; // cuántas unidades se piden: las opciones se eligen una por una (2 cafés pueden ser distintos)
}

type Choice = Record<string, string[]>; // groupId -> ids de las opciones elegidas

// El mozo elige las opciones de un plato (tamaño, leche, extras…) antes de agregarlo al pedido.
// Si pide varias unidades, elige las opciones de cada una. Devuelve la lista de opciones por unidad.
@Component({
  selector: 'app-modifier-picker-dialog',
  templateUrl: './modifier-picker-dialog.component.html',
})
export class ModifierPickerDialogComponent {
  units = 1;
  current = 0; // unidad que se está eligiendo
  private choices: Choice[] = [];

  constructor(
    private dialogRef: MatDialogRef<ModifierPickerDialogComponent, OrderModifier[][]>,
    @Inject(MAT_DIALOG_DATA) public data: ModifierPickerData,
  ) {
    this.units = Math.max(1, Math.floor(data.units ?? 1));
    this.choices = Array.from({ length: this.units }, () => this.defaults());
  }

  // Los grupos obligatorios de una sola opción arrancan con la primera opción elegida:
  // el caso común (ej: tamaño "Chico") queda a un toque de distancia.
  private defaults(): Choice {
    const choice: Choice = {};
    for (const g of this.data.groups) {
      const first = g.options.find((o) => !o.outOfStock); // la primera que no esté agotada
      choice[g._id] = g.required && g.selection === 'SINGLE' && first ? [first._id] : [];
    }
    return choice;
  }

  // Una entrada por unidad (para recorrerlas en la pantalla)
  get unitList(): number[] {
    return this.choices.map((_, i) => i);
  }

  // Elecciones de la unidad que se está mostrando
  get choice(): Choice {
    return this.choices[this.current];
  }

  isSelected(group: ModifierGroup, option: ModifierOption): boolean {
    return this.choice[group._id].includes(option._id);
  }

  toggle(group: ModifierGroup, option: ModifierOption) {
    if (option.outOfStock) return;
    const current = this.choice[group._id];
    if (group.selection === 'SINGLE') {
      // tocar la elegida la quita, salvo que el grupo sea obligatorio
      this.choice[group._id] = current.includes(option._id) ? (group.required ? current : []) : [option._id];
    } else {
      this.choice[group._id] = current.includes(option._id) ? current.filter((id) => id !== option._id) : [...current, option._id];
    }
  }

  // ---- por unidad ----

  // Faltan elecciones en grupos obligatorios de la unidad i
  missingIn(i: number): ModifierGroup[] {
    return this.data.groups.filter((g) => g.required && this.choices[i][g._id].length === 0);
  }

  get missing(): ModifierGroup[] {
    return this.missingIn(this.current);
  }

  // Unidades (empezando en 1) a las que todavía les falta elegir algo
  get incomplete(): number[] {
    return this.choices.map((_, i) => i).filter((i) => this.missingIn(i).length > 0).map((i) => i + 1);
  }

  selectedFor(i: number): OrderModifier[] {
    return this.data.groups.flatMap((g) =>
      g.options
        .filter((o) => this.choices[i][g._id].includes(o._id))
        .map((o) => ({ groupId: g._id, group: g.name, optionId: o._id, name: o.name, priceDelta: o.priceDelta })),
    );
  }

  get selected(): OrderModifier[] {
    return this.selectedFor(this.current);
  }

  // Resumen corto de lo elegido en la unidad i ("doble, leche de almendras")
  summary(i: number): string {
    return modifiersText(this.selectedFor(i)) || 'Sin opciones';
  }

  unitPriceOf(i: number): number {
    return (this.data.item.price ?? 0) + modifiersTotal(this.selectedFor(i));
  }

  // Precio de la unidad que se está eligiendo
  get unitPrice(): number {
    return this.unitPriceOf(this.current);
  }

  // Precio de todas las unidades juntas
  get totalPrice(): number {
    return this.choices.reduce((sum, _, i) => sum + this.unitPriceOf(i), 0);
  }

  select(i: number) {
    this.current = i;
  }

  // Copia lo elegido en la unidad actual a la anterior o a todas (el caso común: "los dos iguales")
  copyFromPrevious() {
    if (this.current > 0) this.choices[this.current] = this.clone(this.choices[this.current - 1]);
  }

  copyToAll() {
    const source = this.choices[this.current];
    this.choices = this.choices.map((_, i) => (i === this.current ? source : this.clone(source)));
  }

  private clone(choice: Choice): Choice {
    return Object.fromEntries(Object.entries(choice).map(([k, v]) => [k, [...v]]));
  }

  // ---- acciones ----

  get canConfirm(): boolean {
    return this.incomplete.length === 0;
  }

  // Con varias unidades, mientras falte alguna el botón principal lleva a la siguiente que falta
  get primaryLabel(): string {
    if (this.units === 1) return 'Agregar';
    return this.canConfirm ? `Agregar ${this.units}` : 'Siguiente';
  }

  primary() {
    if (this.canConfirm) {
      this.dialogRef.close(this.choices.map((_, i) => this.selectedFor(i)));
      return;
    }
    const next = this.incomplete.find((n) => n - 1 > this.current) ?? this.incomplete[0];
    this.current = next - 1;
  }

  cancel() {
    this.dialogRef.close();
  }
}
