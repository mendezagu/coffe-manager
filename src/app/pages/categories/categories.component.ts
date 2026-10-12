import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Category, Destination, GestionService } from 'src/app/services/gestionService';
import { SettingsService } from 'src/app/services/settings.service';

interface Row extends Category {
  editing?: boolean;
  editName?: string;
  editDestination?: Destination;
}

@Component({
  selector: 'app-categories',
  templateUrl: './categories.component.html',
})
export class CategoriesComponent implements OnInit {
  categories: Row[] = [];
  loading = true;
  saving = false;

  newName = '';
  newDestination: Destination = 'KITCHEN';

  // El destino "barra" depende del plan; que tenga efecto depende de lo que el negocio activó
  canSplit = false;
  splitActive = false;

  // Avisa al panel de administración que cambiaron las categorías (para refrescar los selectores del menú)
  @Output() changed = new EventEmitter<void>();

  constructor(private gestion: GestionService, private settings: SettingsService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.settings.settings$.subscribe((s) => {
      this.canSplit = (s.features ?? []).includes('kitchen_bar_split');
      this.splitActive = !!s.splitActive;
    });
    this.settings.load();
    this.load();
  }

  destinationLabel(d: Destination): string {
    return d === 'BAR' ? 'Barra' : 'Cocina';
  }

  load() {
    this.gestion.getCategories().subscribe({
      next: (list) => {
        this.categories = list;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.notify(this.message(err, 'No se pudieron cargar las categorías'));
      },
    });
  }

  create() {
    if (!this.newName.trim() || this.saving) return;
    this.saving = true;
    this.gestion.addCategory(this.newName, this.canSplit ? this.newDestination : 'KITCHEN').subscribe({
      next: () => {
        this.saving = false;
        this.newName = '';
        this.load();
        this.changed.emit();
      },
      error: (err) => {
        this.saving = false;
        this.notify(this.message(err, 'No se pudo crear la categoría'));
      },
    });
  }

  startEdit(row: Row) {
    row.editing = true;
    row.editName = row.name;
    row.editDestination = row.destination;
  }

  cancelEdit(row: Row) {
    row.editing = false;
  }

  saveEdit(row: Row) {
    const name = (row.editName ?? '').trim();
    if (!name) return;
    const changes: { name?: string; destination?: Destination } = {};
    if (name !== row.name) changes.name = name;
    if (row.editDestination && row.editDestination !== row.destination) changes.destination = row.editDestination;
    if (!Object.keys(changes).length) return this.cancelEdit(row);

    this.gestion.editCategory(row._id, changes).subscribe({
      next: () => {
        this.load();
        this.changed.emit();
      },
      error: (err) => this.notify(this.message(err, 'No se pudo guardar la categoría')),
    });
  }

  remove(row: Row) {
    const n = row.itemsCount ?? 0;
    const extra = n > 0 ? ` Sus ${n} ${n === 1 ? 'plato queda' : 'platos quedan'} sin categoría (no se borran).` : '';
    if (!window.confirm(`¿Eliminar la categoría "${row.name}"?${extra}`)) return;
    this.gestion.deleteCategory(row._id).subscribe({
      next: () => {
        this.load();
        this.changed.emit();
      },
      error: (err) => this.notify(this.message(err, 'No se pudo eliminar la categoría')),
    });
  }

  drop(event: CdkDragDrop<Row[]>) {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.categories, event.previousIndex, event.currentIndex);
    this.gestion.reorderCategories(this.categories.map((c) => c._id)).subscribe({
      next: () => this.changed.emit(),
      error: (err) => {
        this.notify(this.message(err, 'No se pudo guardar el orden'));
        this.load();
      },
    });
  }

  private message(err: any, fallback: string): string {
    const msg = err?.error?.message;
    return (Array.isArray(msg) ? msg.join('. ') : msg) || fallback;
  }

  private notify(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 3500 });
  }
}
