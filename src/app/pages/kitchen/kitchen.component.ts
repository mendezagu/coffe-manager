import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, Subscription, merge, of, timer } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { KitchenDestination, KitchenOrder, KitchenService, KitchenStatus } from 'src/app/services/kitchen.service';
import { SettingsService } from 'src/app/services/settings.service';
import { UserService } from 'src/app/services/user.service';

const POLL_MS = 5000;
const LATE_MINUTES = 10;
// Los platos que el mozo carga juntos se guardan con segundos de diferencia como mucho:
// dentro de esta ventana, en la misma mesa, forman una sola comanda.
const BATCH_WINDOW_MS = 30000;

interface Column {
  status: KitchenStatus;
  title: string;
  empty: string;
}

// Una comanda = los platos que una mesa pidió en una misma tanda.
export interface Ticket {
  key: string;
  tableName: string;
  waiterName: string | null;
  lines: KitchenOrder[];
  status: KitchenStatus; // PENDING si todo está pendiente, READY si todo está listo, si no PREPARING
  createdAt: number; // el pedido más viejo de la comanda
  updatedAt: number; // el último cambio de estado
}

@Component({
  selector: 'app-kitchen',
  templateUrl: './kitchen.component.html',
})
export class KitchenComponent implements OnInit, OnDestroy {
  columns: Column[] = [
    { status: 'PENDING', title: 'Pendientes', empty: 'Sin pedidos pendientes' },
    { status: 'PREPARING', title: 'En preparación', empty: 'Nada en preparación' },
    { status: 'READY', title: 'Listos', empty: 'Todavía no hay pedidos listos' },
  ];

  orders: KitchenOrder[] = [];
  tickets: Ticket[] = [];
  loaded = false;
  offline = false;
  now = Date.now();

  // Cocina y barra: solo si el negocio las separa. El admin ve ambas con pestañas.
  role: string | null = null;
  splitActive = false;
  tab: 'ALL' | KitchenDestination = 'ALL';
  private reload$ = new Subject<void>();
  private settingsSub?: Subscription;

  private polling?: Subscription;
  private clock?: ReturnType<typeof setInterval>;
  // Mientras hay cambios sin confirmar se ignoran las respuestas del refresco, para que
  // una lectura vieja no "des-haga" por un instante lo que cocina acaba de tocar.
  private inFlight = 0;

  constructor(private kitchen: KitchenService, private settings: SettingsService, private users: UserService) {}

  get isAdmin(): boolean {
    return this.role === 'admin';
  }

  get title(): string {
    if (this.role === 'bar') return 'Barra';
    return this.splitActive && this.isAdmin ? 'Cocina y barra' : 'Cocina';
  }

  // La barra existe como pantalla solo si el negocio separó cocina y barra
  get barDisabled(): boolean {
    return this.role === 'bar' && !this.splitActive;
  }

  setTab(tab: 'ALL' | KitchenDestination) {
    this.tab = tab;
    this.reload$.next();
  }

  ngOnInit() {
    this.role = this.users.currentRole();
    this.settings.load();
    this.settingsSub = this.settings.settings$.subscribe((s) => {
      this.splitActive = !!s.splitActive;
      if (!this.splitActive) this.tab = 'ALL';
    });

    this.polling = merge(timer(0, POLL_MS), this.reload$)
      .pipe(
        switchMap(() =>
          this.kitchen.list(this.isAdmin && this.splitActive && this.tab !== 'ALL' ? this.tab : undefined).pipe(
            catchError(() => {
              this.offline = true;
              return of(null);
            }),
          ),
        ),
      )
      .subscribe((orders) => {
        if (!orders) return;
        this.offline = false;
        this.loaded = true;
        if (this.inFlight > 0) return;
        this.orders = orders;
        this.rebuild();
      });
    this.clock = setInterval(() => (this.now = Date.now()), 15000);
  }

  ngOnDestroy() {
    this.polling?.unsubscribe();
    this.settingsSub?.unsubscribe();
    if (this.clock) clearInterval(this.clock);
  }

  ticketsBy(status: KitchenStatus): Ticket[] {
    const list = this.tickets.filter((t) => t.status === status);
    // Listos: el más reciente arriba. El resto: el más viejo primero (es el más urgente).
    return list.sort((a, b) => (status === 'READY' ? b.updatedAt - a.updatedAt : a.createdAt - b.createdAt));
  }

  // ---- Agrupado ----

  private rebuild() {
    const byTable = new Map<string, KitchenOrder[]>();
    for (const o of this.orders) {
      const list = byTable.get(o.tableId) ?? [];
      list.push(o);
      byTable.set(o.tableId, list);
    }

    const tickets: Ticket[] = [];
    byTable.forEach((lines) => {
      lines.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
      let group: KitchenOrder[] = [];
      let start = 0;
      const flush = () => group.length && tickets.push(this.toTicket(group));
      for (const line of lines) {
        const at = +new Date(line.createdAt);
        if (group.length && at - start > BATCH_WINDOW_MS) {
          flush();
          group = [];
        }
        if (!group.length) start = at;
        group.push(line);
      }
      flush();
    });
    this.tickets = tickets;
  }

  private toTicket(lines: KitchenOrder[]): Ticket {
    const first = lines[0];
    const all = (s: KitchenStatus) => lines.every((l) => l.status === s);
    return {
      key: `${first.tableId}:${first.createdAt}`,
      tableName: first.tableName,
      waiterName: first.waiterName,
      lines,
      status: all('PENDING') ? 'PENDING' : all('READY') ? 'READY' : 'PREPARING',
      createdAt: Math.min(...lines.map((l) => +new Date(l.createdAt))),
      updatedAt: Math.max(...lines.map((l) => +new Date(l.updatedAt))),
    };
  }

  // ---- Presentación ----

  minutesAgo(t: Ticket): number {
    const since = t.status === 'READY' ? t.updatedAt : t.createdAt;
    return Math.max(0, Math.floor((this.now - since) / 60000));
  }

  isLate(t: Ticket): boolean {
    return t.status !== 'READY' && this.minutesAgo(t) >= LATE_MINUTES;
  }

  timeLabel(t: Ticket): string {
    const m = this.minutesAgo(t);
    const text = m < 1 ? 'recién' : `hace ${m} min`;
    return t.status === 'READY' ? `Listo ${text}` : text.charAt(0).toUpperCase() + text.slice(1);
  }

  readyCount(t: Ticket): number {
    return t.lines.filter((l) => l.status === 'READY').length;
  }

  // Botón principal de la comanda
  mainActionLabel(t: Ticket): string {
    return t.status === 'PENDING' ? 'Empezar todo' : t.status === 'PREPARING' ? 'Todo listo' : 'Deshacer';
  }

  mainAction(t: Ticket) {
    if (t.status === 'PENDING') this.moveLines(t.lines, 'PREPARING');
    else if (t.status === 'PREPARING') this.moveLines(t.lines.filter((l) => l.status !== 'READY'), 'READY');
    else this.moveLines(t.lines, 'PREPARING');
  }

  // Una comanda a medias (algo ya en preparación) se puede devolver entera a pendientes
  backToPending(t: Ticket) {
    this.moveLines(t.lines, 'PENDING');
  }

  // Tilde de cada plato: lo marca listo, o lo deshace si ya estaba listo
  toggleLine(line: KitchenOrder) {
    this.moveLines([line], line.status === 'READY' ? 'PREPARING' : 'READY');
  }

  private moveLines(lines: KitchenOrder[], status: KitchenStatus) {
    if (!lines.length) return;
    const previous = lines.map((l) => ({ line: l, status: l.status, updatedAt: l.updatedAt }));
    const stamp = new Date().toISOString();
    lines.forEach((l) => {
      l.status = status; // se ve al instante; si falla se revierte
      l.updatedAt = stamp;
    });
    this.rebuild();

    this.inFlight++;
    this.kitchen.setManyStatus(lines.map((l) => l.id), status).subscribe({
      next: () => this.inFlight--,
      error: () => {
        this.inFlight--;
        previous.forEach((p) => {
          p.line.status = p.status;
          p.line.updatedAt = p.updatedAt;
        });
        this.rebuild();
      },
    });
  }

  trackByKey = (_: number, t: Ticket) => t.key;
  trackById = (_: number, o: KitchenOrder) => o.id;
}
