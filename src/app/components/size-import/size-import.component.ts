import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GestionService } from 'src/app/services/gestionService';
import { SizeSheet, parseSizeSheet } from 'src/app/utils/size-sheet';

const PREVIEW_ROWS = 8;

// Carga platos con un precio por tamaño desde una planilla (pegada desde Google Sheets / Excel o un CSV)
@Component({
  selector: 'app-size-import',
  templateUrl: './size-import.component.html',
})
export class SizeImportComponent {
  // Nombres de los platos que ya existen: se marcan como "actualiza" en la vista previa
  @Input() existing: { name: string }[] = [];
  @Output() imported = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  text = '';
  groupName = 'Tamaño';
  sheet: SizeSheet | null = null;
  busy = false;
  error = '';

  readonly previewRows = PREVIEW_ROWS;

  constructor(private gestion: GestionService, private snackBar: MatSnackBar) {}

  onText(value: string) {
    this.text = value;
    this.error = '';
    this.sheet = value.trim() ? parseSizeSheet(value) : null;
  }

  async onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 2_000_000) {
      this.error = 'El archivo es muy grande. Tiene que ser una planilla de platos y precios.';
      return;
    }
    if (/\.xlsx?$/i.test(file.name)) {
      this.error = 'Los archivos de Excel no se leen directo. Guardalo como CSV (Archivo → Descargar → CSV) o copiá las celdas y pegalas acá.';
      return;
    }
    this.onText(await file.text());
  }

  private norm(t: string): string {
    return t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  isUpdate(name: string): boolean {
    const n = this.norm(name);
    return this.existing.some((e) => this.norm(e.name) === n);
  }

  get updates(): number {
    return this.sheet ? this.sheet.rows.filter((r) => this.isUpdate(r.name)).length : 0;
  }

  get canImport(): boolean {
    const s = this.sheet;
    return !!s && s.rows.length > 0 && s.sizes.length > 0 && s.sizes.length <= 12 && new Set(s.sizes.map((x) => this.norm(x))).size === s.sizes.length && !this.busy && !!this.groupName.trim();
  }

  import() {
    const s = this.sheet;
    if (!s || !this.canImport) return;
    this.busy = true;
    this.error = '';
    this.gestion.importSizes({ groupName: this.groupName.trim(), sizes: s.sizes, rows: s.rows }).subscribe({
      next: (r) => {
        this.busy = false;
        this.snackBar.open(`Listo: ${r.created} ${r.created === 1 ? 'plato nuevo' : 'platos nuevos'} y ${r.updated} ${r.updated === 1 ? 'actualizado' : 'actualizados'}`, 'Cerrar', { duration: 5000 });
        this.text = '';
        this.sheet = null;
        this.imported.emit();
      },
      error: (err) => {
        this.busy = false;
        const msg = err?.error?.message;
        this.error = (Array.isArray(msg) ? msg.join('. ') : msg) || 'No se pudo cargar la planilla. Probá de nuevo.';
      },
    });
  }
}
