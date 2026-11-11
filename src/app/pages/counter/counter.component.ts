import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Category, GestionService } from 'src/app/services/gestionService';
import { CashService } from 'src/app/services/cash.service';
import { SettingsService } from 'src/app/services/settings.service';
import { PlanService } from 'src/app/services/plan.service';
import { TicketService } from 'src/app/services/ticket.service';
import { UserService } from 'src/app/services/user.service';
import { MenuItem } from 'src/app/models/coffe.models';
import { PaymentValue } from 'src/app/components/payment-panel/payment-panel.component';
import { CuentaLine, CuentaRow } from 'src/app/utils/ticket-html';

const ALL = 'all';
const NONE = 'none'; // productos sin categoría

interface CatChip {
  id: string;
  name: string;
  icon: string;
  count: number;
}

// Íconos por palabra del nombre de la categoría (si no coincide ninguna, un ícono genérico)
const ICONS: [RegExp, string][] = [
  [/caliente|caf[eé]|espresso|cortado|t[eé]/i, 'coffee'],
  [/pastel|dulce|torta|postre|medialuna|panader/i, 'bakery_dining'],
  [/comer|sandwich|s[aá]ndwich|tostado|lunch|comida|plato|pizza|empanada/i, 'lunch_dining'],
  [/fr[ií]a?s?|jugo|licuado|agua|gaseosa/i, 'local_drink'],
  [/bebida|cerveza|trago/i, 'local_bar'],
  [/combo|promo/i, 'redeem'],
  [/helado/i, 'icecream'],
];
const iconFor = (name: string) => ICONS.find(([re]) => re.test(name))?.[1] ?? 'restaurant_menu';

@Component({
  selector: 'app-counter',
  templateUrl: './counter.component.html',
})
export class CounterComponent implements OnInit, OnDestroy {
  items: MenuItem[] = [];
  categories: Category[] = [];
  loading = true;
  isAdmin = false;

  cat = ALL;
  term = '';
  takeaway = true;

  // Lista compacta (más productos por pantalla): la elección queda guardada en este equipo
  compact = this.readCompact();
  // Solo el administrador: mientras está activo se ve la estrella para fijar favoritos
  editFavs = false;

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  // Al registrar una venta el foco va a "Nueva venta": con Enter se sigue con el próximo cliente
  @ViewChild('newSaleBtn') set newSaleBtn(el: ElementRef<HTMLButtonElement> | undefined) {
    if (el) setTimeout(() => el.nativeElement.focus(), 0);
  }

  // lo que lleva el cliente: id del producto -> cantidad
  cart = new Map<string, number>();
  payment: PaymentValue | null = null;
  busy = false;
  error = '';
  // la venta recién cobrada (para mostrar el resultado e imprimir el ticket)
  lastSale: any = null;
  // identifica este cobro: si se reintenta (doble toque, corte de red) el servidor no lo duplica
  private checkoutId = this.newId();
  private subs = new Subscription();

  constructor(
    private gestion: GestionService,
    private cash: CashService,
    public settings: SettingsService,
    public plans: PlanService,
    private tickets: TicketService,
    private users: UserService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    this.isAdmin = this.users.currentRole() === 'admin';
    this.cash.refresh().subscribe({ error: () => {} });
    this.load();
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  private load() {
    this.gestion.refreshMenu().subscribe({
      next: (items) => {
        this.items = items;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
    this.gestion.getCategories().subscribe({ next: (c) => (this.categories = c), error: () => {} });
  }

  private newId(): string {
    return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  // ---- productos ----

  get chips(): CatChip[] {
    const count = (fn: (i: MenuItem) => boolean) => this.items.filter(fn).length;
    const chips: CatChip[] = [{ id: ALL, name: 'Todo', icon: 'grid_view', count: this.items.length }];
    for (const c of this.categories) {
      const n = count((i) => i.categoryId === c._id);
      if (n) chips.push({ id: c._id, name: c.name, icon: iconFor(c.name), count: n });
    }
    const loose = count((i) => !i.categoryId);
    if (loose && this.categories.length) chips.push({ id: NONE, name: 'Otros', icon: 'restaurant_menu', count: loose });
    return chips;
  }

  private matches(i: MenuItem): boolean {
    const byCat = this.cat === ALL || (this.cat === NONE ? !i.categoryId : i.categoryId === this.cat);
    const t = this.term.trim().toLowerCase();
    return byCat && (!t || i.name.toLowerCase().includes(t));
  }

  get favorites(): MenuItem[] {
    return this.items.filter((i) => i.isFavorite && this.matches(i));
  }

  get visible(): MenuItem[] {
    return this.items.filter((i) => this.matches(i));
  }

  // Sin filtros, los favoritos ya están arriba: no se repiten en el resto de la lista
  get dedupe(): boolean {
    return !this.editFavs && this.cat === ALL && !this.term.trim() && this.favorites.length > 0;
  }

  get rest(): MenuItem[] {
    return this.dedupe ? this.visible.filter((i) => !i.isFavorite) : this.visible;
  }

  private readCompact(): boolean {
    try {
      return localStorage.getItem('counter_compact') === '1';
    } catch {
      return false;
    }
  }

  setCompact(value: boolean) {
    this.compact = value;
    try {
      localStorage.setItem('counter_compact', value ? '1' : '0');
    } catch {
      /* sin almacenamiento: queda solo para esta sesión */
    }
  }

  // Enter en el buscador: suma el primer resultado y deja el buscador listo para el siguiente
  searchEnter() {
    const first = this.visible.find((i) => !this.soldOut(i));
    if (!first) return;
    this.add(first);
    this.term = '';
  }

  // Ctrl + K lleva al buscador; Ctrl + Enter cobra
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.searchInput?.nativeElement.focus();
      this.searchInput?.nativeElement.select();
    } else if (e.key === 'Enter' && this.canCharge) {
      e.preventDefault();
      this.charge();
    }
  }

  // Precio para la tarjeta: sin los ceros de los centavos cuando es un monto redondo ($ 22.500 en vez de $ 22.500,00)
  shortPrice(n: number): string {
    const s = this.settings.format(n);
    return Number.isInteger(n) ? s.replace(/[.,]0+$/, '') : s;
  }

  categoryName(i: MenuItem): string {
    return this.categories.find((c) => c._id === i.categoryId)?.name ?? '';
  }

  // Un color por categoría (en el orden en que están cargadas): sirve para reconocer de un vistazo a qué pertenece cada producto
  private static readonly DOTS = ['bg-cafe-green-600', 'bg-[#d49a12]', 'bg-[#3b82a8]', 'bg-[#b5533c]', 'bg-[#7a4a28]', 'bg-[#7a6bb5]'];

  dotClass(i: MenuItem): string {
    const idx = this.categories.findIndex((c) => c._id === i.categoryId);
    return idx < 0 ? 'bg-sage-400' : CounterComponent.DOTS[idx % CounterComponent.DOTS.length];
  }

  trackItem(_: number, i: MenuItem): string {
    return i._id;
  }

  inCart(i: MenuItem): number {
    return this.cart.get(i._id) ?? 0;
  }

  // El panel del pedido se muestra solo si hay algo en el pedido o acaba de registrarse una venta
  get showOrder(): boolean {
    return !!this.lastSale || this.itemsCount > 0;
  }

  // El pedido y el cobro se abren desde el botón flotante, en un diálogo
  orderOpen = false;

  openOrder() {
    this.orderOpen = true;
  }

  closeOrder() {
    this.orderOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeOrder();
  }

  get itemsCount(): number {
    return [...this.cart.values()].reduce((s, q) => s + q, 0);
  }

  tileClass(i: MenuItem): string {
    const n = this.categoryName(i);
    if (/caf[eé]/i.test(n)) return 'bg-[#f3e6dc] text-[#7a4a28]';
    if (/pastel|dulce|panader|postre/i.test(n)) return 'bg-[#fbeccd] text-[#8a5a0b]';
    if (/fr[ií]o|bebida/i.test(n)) return 'bg-[#dcecf7] text-[#1d5a8a]';
    return 'bg-cafe-green-50 text-cafe-green-700';
  }

  iconOf(i: MenuItem): string {
    return iconFor(this.categoryName(i) || i.name);
  }

  soldOut(i: MenuItem): boolean {
    return i.availableUnits === 0;
  }

  toggleFavorite(i: MenuItem, event: Event) {
    event.stopPropagation();
    if (!this.isAdmin) return;
    const next = !i.isFavorite;
    i.isFavorite = next; // se ve al instante; si el servidor falla, se vuelve atrás
    this.gestion.setFavorite(i._id, next).subscribe({
      error: () => {
        i.isFavorite = !next;
        this.snack.open('No se pudo cambiar el favorito. Probá de nuevo.', 'Cerrar', { duration: 3000 });
      },
    });
  }

  // Las listas se recalculan en cada ciclo: sin esto Angular recrea las filas y se pierden los toques en los botones
  trackChip = (_: number, c: CatChip) => c.id;
  trackLine = (_: number, l: { item: MenuItem }) => l.item._id;

  // ---- pedido ----

  add(i: MenuItem) {
    if (this.soldOut(i) || this.busy) return;
    this.touchOrder();
    this.cart.set(i._id, Math.min(99, (this.cart.get(i._id) ?? 0) + 1));
  }

  step(id: string, delta: number) {
    this.touchOrder();
    const q = (this.cart.get(id) ?? 0) + delta;
    if (q <= 0) this.cart.delete(id);
    else this.cart.set(id, Math.min(99, q));
    if (this.cart.size === 0) this.orderOpen = false;
  }

  // "Vaciar" borra todo el pedido: se pide confirmar para que un toque de más no lo pierda
  confirmClear() {
    if (window.confirm('¿Vaciar el pedido?')) this.clear();
  }

  clear() {
    this.touchOrder();
    this.cart.clear();
    this.orderOpen = false;
  }

  // Si el pedido cambia, es otro cobro: nuevo identificador y se limpia el resultado anterior
  private touchOrder() {
    this.checkoutId = this.newId();
    this.lastSale = null;
    this.error = '';
  }

  get lines() {
    return [...this.cart.entries()]
      .map(([id, quantity]) => ({ item: this.items.find((i) => i._id === id), quantity }))
      .filter((l): l is { item: MenuItem; quantity: number } => !!l.item)
      .map((l) => ({ ...l, amount: l.item.price * l.quantity }));
  }

  get total(): number {
    return this.lines.reduce((s, l) => s + l.amount, 0);
  }

  // ---- cobro ----

  // El negocio exige caja abierta y no hay una
  get cashBlocked(): boolean {
    const s = this.cash.value;
    return !!s && s.requireOpenRegister && !s.open;
  }

  // Estado de la caja para el encabezado
  get cashChip(): { text: string; tone: 'ok' | 'bad' | 'idle' } | null {
    const s = this.cash.value;
    if (!s) return null;
    if (s.open) return { text: 'Caja abierta', tone: 'ok' };
    return s.requireOpenRegister ? { text: 'Caja cerrada', tone: 'bad' } : { text: 'Caja sin abrir', tone: 'idle' };
  }

  // Texto del botón de cobrar: incluye cómo se cobra, para que quien cobra lo confirme de un vistazo
  get chargeLabel(): string {
    if (this.busy) return 'Cobrando…';
    if (!this.lines.length) return 'Cobrar';
    const labels: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'QR', tarjeta: 'Tarjeta' };
    const paid = this.payment?.payments ?? [];
    const method = paid.length === 1 ? (labels[paid[0].method] ?? paid[0].method) : paid.length > 1 ? paid.length + ' métodos' : '';
    return 'Cobrar ' + this.shortPrice(this.payment ? this.payment.due : this.total) + (method ? ' · ' + method : '');
  }

  get canCharge(): boolean {
    return !this.busy && !this.cashBlocked && this.lines.length > 0 && !!this.payment?.valid;
  }

  charge() {
    if (!this.canCharge || !this.payment) return;
    this.busy = true;
    this.error = '';
    this.gestion
      .counterCheckout({
        checkoutId: this.checkoutId,
        items: this.lines.map((l) => ({ menuItemId: l.item._id, quantity: l.quantity })),
        takeaway: this.takeaway,
        payments: this.payment.payments,
        tip: this.payment.tip,
      })
      .subscribe({
        next: (sale) => {
          this.lastSale = { ...sale, change: this.payment?.change ?? 0 };
          this.gestion.saveLog(
            `Venta por mostrador de <strong>${this.settings.format(sale.totalAmount)}</strong> (${this.takeaway ? 'para llevar' : 'en el local'}), cobrada por <strong>${sale.cashierName}</strong>`,
          );
          this.cart.clear();
          this.checkoutId = this.newId();
          this.busy = false;
          this.load(); // el stock cambió: se actualizan los productos agotados
        },
        error: (e) => {
          const msg = e?.error?.message;
          this.error =
            (Array.isArray(msg) ? msg.join('. ') : msg) || 'No se pudo cobrar. Revisá la conexión e intentá de nuevo: no se registró ningún cobro.';
          this.cash.refresh().subscribe({ error: () => {} }); // por si el motivo fue una caja cerrada
          this.busy = false;
        },
      });
  }

  newSale() {
    this.lastSale = null;
    this.error = '';
    this.orderOpen = false;
  }

  printTicket() {
    const sale = this.lastSale;
    if (!sale) return;
    const fmt = (n: number) => this.settings.format(n);
    const labels: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'QR', tarjeta: 'Tarjeta' };
    const lines: CuentaLine[] = (sale.items ?? []).map((i: any) => ({
      name: i.name,
      suffix: i.isPromo ? '(PROMO)' : '',
      quantity: i.quantity,
      amount: fmt(i.lineTotal),
    }));
    const summary: CuentaRow[] = [{ label: 'Total:', value: fmt(sale.totalAmount), big: true }];
    if (sale.tipAmount > 0) summary.push({ label: 'Propina:', value: fmt(sale.tipAmount) });
    for (const p of sale.payments ?? []) summary.push({ text: `${labels[p.method] ?? p.method}: ${fmt(p.amount)}` });
    if (sale.change > 0) summary.push({ label: 'Vuelto:', value: fmt(sale.change) });
    const sold = this.tickets.printCuenta(
      { tableName: 'Mostrador', waiterName: '', counter: { takeaway: !!sale.takeaway, cashierName: sale.cashierName }, lines, summary },
      { windowSize: 'width=600,height=400' },
    );
    if (!sold) this.snack.open('El navegador bloqueó la impresión. Permití las ventanas emergentes.', 'Cerrar', { duration: 4000 });
  }
}
