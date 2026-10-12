import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Category, GestionService, ModifierGroup, ModifierSelection } from 'src/app/services/gestionService';
import { SettingsService } from 'src/app/services/settings.service';

interface EditorOption {
  id?: string;
  name: string;
  priceDelta: number;
  active: boolean;
}

interface Editor {
  id?: string; // sin id = modificador nuevo
  name: string;
  selection: ModifierSelection;
  required: boolean;
  options: EditorOption[];
}

// Puntos de partida para no arrancar de cero
const TEMPLATES: { label: string; editor: Omit<Editor, 'id'> }[] = [
  {
    label: 'Tamaño',
    editor: {
      name: 'Tamaño',
      selection: 'SINGLE',
      required: true,
      options: [
        { name: 'Chico', priceDelta: 0, active: true },
        { name: 'Mediano', priceDelta: 0, active: true },
        { name: 'Grande', priceDelta: 0, active: true },
      ],
    },
  },
  {
    label: 'Leche',
    editor: {
      name: 'Leche',
      selection: 'SINGLE',
      required: false,
      options: [
        { name: 'Entera', priceDelta: 0, active: true },
        { name: 'Descremada', priceDelta: 0, active: true },
        { name: 'Almendras', priceDelta: 0, active: true },
        { name: 'Soja', priceDelta: 0, active: true },
      ],
    },
  },
  {
    label: 'Extras',
    editor: {
      name: 'Extras',
      selection: 'MULTIPLE',
      required: false,
      options: [{ name: '', priceDelta: 0, active: true }],
    },
  },
];

@Component({
  selector: 'app-modifiers',
  templateUrl: './modifiers.component.html',
})
export class ModifiersComponent implements OnInit {
  groups: ModifierGroup[] = [];
  categories: Category[] = [];
  loading = true;
  saving = false;

  editor: Editor | null = null;
  templates = TEMPLATES;

  // Grupo para el que se está eligiendo una categoría donde ofrecerlo
  applyingId: string | null = null;
  applyCategoryId = '';

  // Avisa al panel de administración (para refrescar lo que depende de los modificadores)
  @Output() changed = new EventEmitter<void>();

  constructor(private gestion: GestionService, public settings: SettingsService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.load();
    this.gestion.getCategories().subscribe({ next: (c) => (this.categories = c), error: () => {} });
  }

  load() {
    this.gestion.getModifiers().subscribe({
      next: (groups) => {
        this.groups = groups;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.notify(this.message(err, 'No se pudieron cargar los modificadores'));
      },
    });
  }

  // ---- Editor ----

  startNew(template?: Omit<Editor, 'id'>) {
    this.editor = template
      ? { ...template, options: template.options.map((o) => ({ ...o })) }
      : { name: '', selection: 'SINGLE', required: false, options: [{ name: '', priceDelta: 0, active: true }] };
  }

  startEdit(group: ModifierGroup) {
    this.applyingId = null;
    this.editor = {
      id: group._id,
      name: group.name,
      selection: group.selection,
      required: group.required,
      options: group.options.map((o) => ({ id: o._id, name: o.name, priceDelta: o.priceDelta, active: o.active })),
    };
  }

  addOption() {
    this.editor?.options.push({ name: '', priceDelta: 0, active: true });
  }

  removeOption(index: number) {
    this.editor?.options.splice(index, 1);
  }

  dropOption(event: CdkDragDrop<EditorOption[]>) {
    if (this.editor) moveItemInArray(this.editor.options, event.previousIndex, event.currentIndex);
  }

  get editorValid(): boolean {
    const e = this.editor;
    if (!e || !e.name.trim()) return false;
    const filled = e.options.filter((o) => o.name.trim());
    return filled.length > 0;
  }

  save() {
    const e = this.editor;
    if (!e || !this.editorValid || this.saving) return;
    const body = {
      name: e.name.trim(),
      selection: e.selection,
      required: e.required,
      // las filas vacías se ignoran
      options: e.options
        .filter((o) => o.name.trim())
        .map((o) => ({ id: o.id, name: o.name.trim(), priceDelta: Number(o.priceDelta) || 0, active: o.active })),
    };

    this.saving = true;
    const request = e.id ? this.gestion.editModifierGroup(e.id, body) : this.gestion.addModifierGroup(body);
    request.subscribe({
      next: () => {
        this.saving = false;
        this.editor = null;
        this.load();
        this.changed.emit();
        this.notify('Modificador guardado');
      },
      error: (err) => {
        this.saving = false;
        this.notify(this.message(err, 'No se pudo guardar el modificador'));
      },
    });
  }

  // ---- Lista ----

  remove(group: ModifierGroup) {
    const n = group.itemsCount ?? 0;
    const extra = n > 0 ? ` Se quita de ${n} ${n === 1 ? 'plato' : 'platos'} (los pedidos ya hechos no cambian).` : '';
    if (!window.confirm(`¿Eliminar el modificador "${group.name}"?${extra}`)) return;
    this.gestion.deleteModifierGroup(group._id).subscribe({
      next: () => {
        this.load();
        this.changed.emit();
      },
      error: (err) => this.notify(this.message(err, 'No se pudo eliminar el modificador')),
    });
  }

  drop(event: CdkDragDrop<ModifierGroup[]>) {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.groups, event.previousIndex, event.currentIndex);
    this.gestion.reorderModifierGroups(this.groups.map((g) => g._id)).subscribe({
      error: (err) => {
        this.notify(this.message(err, 'No se pudo guardar el orden'));
        this.load();
      },
    });
  }

  startApply(group: ModifierGroup) {
    this.editor = null;
    this.applyingId = this.applyingId === group._id ? null : group._id;
    this.applyCategoryId = '';
  }

  apply(group: ModifierGroup) {
    if (!this.applyCategoryId) return;
    this.gestion.applyModifierToCategory(group._id, this.applyCategoryId).subscribe({
      next: (r) => {
        this.applyingId = null;
        this.load();
        this.changed.emit();
        this.notify(
          r.assigned === 0
            ? 'Todos los platos de esa categoría ya lo tenían'
            : `Ahora se ofrece en ${r.assigned} ${r.assigned === 1 ? 'plato' : 'platos'}`,
        );
      },
      error: (err) => this.notify(this.message(err, 'No se pudo aplicar a la categoría')),
    });
  }

  // "Chico, Grande (+$500)": resumen de las opciones activas
  summary(group: ModifierGroup): string {
    return group.options
      .filter((o) => o.active)
      .map((o) => (o.priceDelta ? `${o.name} (${o.priceDelta > 0 ? '+' : ''}${this.settings.format(o.priceDelta)})` : o.name))
      .join(', ');
  }

  private message(err: any, fallback: string): string {
    const msg = err?.error?.message;
    return (Array.isArray(msg) ? msg.join('. ') : msg) || fallback;
  }

  private notify(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 3500 });
  }
}
