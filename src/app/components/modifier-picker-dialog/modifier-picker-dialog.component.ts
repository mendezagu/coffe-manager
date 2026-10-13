import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MenuItem, ModifierGroup, ModifierOption } from 'src/app/services/gestionService';
import { OrderModifier, modifiersTotal } from 'src/app/utils/modifiers';

export interface ModifierPickerData {
  item: MenuItem;
  groups: ModifierGroup[]; // solo los que ofrece el plato, con opciones activas
}

// El mozo elige las opciones de un plato (tamaño, leche, extras…) antes de agregarlo al pedido.
@Component({
  selector: 'app-modifier-picker-dialog',
  templateUrl: './modifier-picker-dialog.component.html',
})
export class ModifierPickerDialogComponent {
  // groupId -> ids de las opciones elegidas
  choice: Record<string, string[]> = {};

  constructor(
    private dialogRef: MatDialogRef<ModifierPickerDialogComponent, OrderModifier[]>,
    @Inject(MAT_DIALOG_DATA) public data: ModifierPickerData,
  ) {
    // Los grupos obligatorios de una sola opción arrancan con la primera opción elegida:
    // el caso común (ej: tamaño "Chico") queda a un toque de distancia.
    for (const g of data.groups) {
      const first = g.options.find((o) => !o.outOfStock); // la primera que no esté agotada
      this.choice[g._id] = g.required && g.selection === 'SINGLE' && first ? [first._id] : [];
    }
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

  // Faltan elecciones en grupos obligatorios
  get missing(): ModifierGroup[] {
    return this.data.groups.filter((g) => g.required && this.choice[g._id].length === 0);
  }

  get selected(): OrderModifier[] {
    return this.data.groups.flatMap((g) =>
      g.options
        .filter((o) => this.choice[g._id].includes(o._id))
        .map((o) => ({ groupId: g._id, group: g.name, optionId: o._id, name: o.name, priceDelta: o.priceDelta })),
    );
  }

  // Precio de una unidad con las opciones elegidas
  get unitPrice(): number {
    return (this.data.item.price ?? 0) + modifiersTotal(this.selected);
  }

  confirm() {
    if (this.missing.length) return;
    this.dialogRef.close(this.selected);
  }

  cancel() {
    this.dialogRef.close();
  }
}
