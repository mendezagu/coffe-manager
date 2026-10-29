import { Component, OnDestroy, OnInit } from '@angular/core';
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

  // En el celular el pedido queda debajo de los productos: este botón lleva hasta él
  scrollToOrder() {
    document.getElementById('mostrador-pedido')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  }

  clear() {
    this.touchOrder();
    this.cart.clear();
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
