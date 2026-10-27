import { Component, OnInit } from '@angular/core';
import { GestionService } from 'src/app/services/gestionService';
import { SettingsService } from 'src/app/services/settings.service';
import { PlanService } from 'src/app/services/plan.service';

type Kind = 'sale' | 'order' | 'removal' | 'print' | 'waiter' | 'other';
type KindFilter = 'all' | Kind;

interface LogRow {
  action: string; // HTML con los nombres en negrita (lo arma la app al registrar la acción)
  timestamp: string;
  kind: Kind;
  text: string; // la misma frase sin etiquetas, para buscar
  time: string;
  dayKey: string;
  dayLabel: string;
}

interface DayGroup {
  label: string;
  rows: LogRow[];
}

// Cómo se ve cada tipo de acción (ícono y colores del sistema)
export const KIND_STYLE: Record<Kind, { label: string; icon: string; chip: string }> = {
  sale: { label: 'Cobros', icon: 'payments', chip: 'bg-cafe-green-50 text-cafe-green-700' },
  order: { label: 'Pedidos', icon: 'receipt_long', chip: 'bg-cafe-amber-50 text-cafe-amber-700' },
  removal: { label: 'Eliminaciones', icon: 'delete_outline', chip: 'bg-cafe-red-50 text-cafe-red-700' },
  print: { label: 'Impresiones', icon: 'print', chip: 'bg-sage-100 text-sage-600' },
  waiter: { label: 'Mozos', icon: 'person', chip: 'bg-sky-50 text-sky-700' },
  other: { label: 'Otros', icon: 'history', chip: 'bg-sage-100 text-sage-600' },
};

const FILTERS: KindFilter[] = ['all', 'sale', 'order', 'removal', 'print', 'waiter', 'other'];

// Los registros no traen un tipo: se deduce de la frase con la que se guardaron
function kindOf(text: string): Kind {
  const t = text.toLowerCase();
  if (t.includes('imprimió')) return 'print';
  // quitar platos de una mesa ("Se eliminaron órdenes…", "Cambios en la mesa X: Eliminados…"): se ve aparte para poder auditarlo
  if (/elimin|quit/.test(t)) return 'removal';
  if (t.includes('cobró') || t.includes('liberó')) return 'sale';
  if (t.includes('asignó el mozo')) return 'waiter';
  if (/agregaron|actualizó|modificó|cambios en la mesa|cantidades/.test(t)) return 'order';
  return 'other';
}

const TZ_LOCALE = 'es-AR';

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss'],
})
export class LogsComponent implements OnInit {
  readonly styles = KIND_STYLE;
  readonly filters = FILTERS;
  readonly pageSizes = [10, 20, 50];

  private rows: LogRow[] = [];
  filter: KindFilter = 'all';
  query = '';
  page = 1;
  pageSize = 20;

  constructor(private gestionService: GestionService, public settings: SettingsService, public plans: PlanService) {}

  // El historial es de Pro en adelante. Solo se bloquea cuando ya llegaron los datos del plan (si no, parpadearía al entrar)
  get locked(): boolean {
    return this.plans.locked('logs');
  }

  ngOnInit(): void {
    this.rows = this.gestionService
      .getLogs()
      .map((l) => this.toRow(l))
      .reverse(); // lo más reciente primero
  }

  private toRow(l: { action: string; timestamp: string }): LogRow {
    const d = new Date(l.timestamp);
    const text = l.action.replace(/<[^>]*>/g, '');
    return {
      action: l.action,
      timestamp: l.timestamp,
      kind: kindOf(text),
      text,
      time: isNaN(d.getTime()) ? '' : d.toLocaleTimeString(TZ_LOCALE, { hour: '2-digit', minute: '2-digit' }),
      dayKey: isNaN(d.getTime()) ? 'sin-fecha' : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
      dayLabel: this.dayLabel(d),
    };
  }

  private dayLabel(d: Date): string {
    if (isNaN(d.getTime())) return 'Sin fecha';
    const today = new Date();
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (same(d, today)) return 'Hoy';
    if (same(d, yesterday)) return 'Ayer';
    const label = d.toLocaleDateString(TZ_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  // ---- Filtros ----

  get total(): number {
    return this.rows.length;
  }

  get filtered(): LogRow[] {
    const q = this.query.trim().toLowerCase();
    return this.rows.filter((r) => (this.filter === 'all' || r.kind === this.filter) && (!q || r.text.toLowerCase().includes(q)));
  }

  // "Otros" solo aparece si hay registros que no encajan en ningún tipo
  get visibleFilters(): KindFilter[] {
    return this.filters.filter((f) => f !== 'other' || this.countOf('other') > 0);
  }

  countOf(f: KindFilter): number {
    return f === 'all' ? this.rows.length : this.rows.filter((r) => r.kind === f).length;
  }

  labelOf(f: KindFilter): string {
    return f === 'all' ? 'Todo' : KIND_STYLE[f].label;
  }

  setFilter(f: KindFilter) {
    this.filter = f;
    this.page = 1;
  }

  onQueryChange() {
    this.page = 1;
  }

  // ---- Paginado ----

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }

  get from(): number {
    return this.filtered.length ? (this.currentPage - 1) * this.pageSize + 1 : 0;
  }

  get to(): number {
    return Math.min(this.currentPage * this.pageSize, this.filtered.length);
  }

  // por si se borran registros o se cambia el filtro y la página quedó fuera de rango
  get currentPage(): number {
    return Math.min(this.page, this.pageCount);
  }

  get groups(): DayGroup[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const slice = this.filtered.slice(start, start + this.pageSize);
    const groups: DayGroup[] = [];
    let lastKey = '';
    for (const row of slice) {
      if (row.dayKey !== lastKey) {
        groups.push({ label: row.dayLabel, rows: [] });
        lastKey = row.dayKey;
      }
      groups[groups.length - 1].rows.push(row);
    }
    return groups;
  }

  // 1 … 4 5 [6] 7 8 … 20
  get pageButtons(): (number | null)[] {
    const last = this.pageCount;
    const cur = this.currentPage;
    const wanted = new Set([1, last, cur - 1, cur, cur + 1].filter((p) => p >= 1 && p <= last));
    const sorted = [...wanted].sort((a, b) => a - b);
    const out: (number | null)[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
      out.push(p);
    });
    return out;
  }

  goTo(p: number) {
    this.page = Math.min(this.pageCount, Math.max(1, p));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setPageSize(size: number | string) {
    this.pageSize = Number(size);
    this.page = 1;
  }

  clearLogs(): void {
    if (!confirm('¿Borrar todo el historial de acciones? No se puede deshacer.')) return;
    this.gestionService.clearLogs();
    this.rows = [];
    this.page = 1;
  }

  trackRow(_i: number, r: LogRow) {
    return r.timestamp + r.text;
  }
}
