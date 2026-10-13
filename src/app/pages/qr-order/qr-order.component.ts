import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ClientOrders, ClientRequest, ClientStep, PublicGroup, PublicInfo, PublicItem, QrPublicService } from 'src/app/services/qr.service';

interface CartLine {
  key: string;
  itemId: string;
  name: string;
  quantity: number;
  note: string;
  optionIds: string[];
  extras: string[];
  unitPrice: number;
}

type Phase = 'loading' | 'notFound' | 'error' | 'pin' | 'ready';

const STEPS: { step: ClientStep; label: string }[] = [
  { step: 'RECEIVED', label: 'Recibido' },
  { step: 'CONFIRMED', label: 'Confirmado' },
  { step: 'PREPARING', label: 'En preparación' },
  { step: 'READY', label: 'Listo' },
];

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const store = {
  get(storage: Storage, key: string): string | null {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  },
  set(storage: Storage, key: string, value: string | null) {
    try {
      value === null ? storage.removeItem(key) : storage.setItem(key, value);
    } catch {
      /* sin almacenamiento: la pantalla funciona igual, solo no recuerda */
    }
  },
};

// Pantalla que ve el cliente al escanear el QR de su mesa. No necesita sesión ni instalar nada.
@Component({
  selector: 'app-qr-order',
  templateUrl: './qr-order.component.html',
})
export class QrOrderComponent implements OnInit, OnDestroy {
  token = '';
  phase: Phase = 'loading';
  info: PublicInfo | null = null;

  pin = '';
  pinInput = '';
  pinError = '';

  tab: 'menu' | 'orders' = 'menu';
  search = '';
  categoryId: string | 'all' = 'all';

  cart: CartLine[] = [];
  customerName = '';

  // Plato que se está armando (hoja inferior)
  sheetItem: PublicItem | null = null;
  sheetQty = 1;
  sheetNote = '';
  sheetSel: Record<string, string[]> = {};
  sheetError = '';

  cartOpen = false;
  sending = false;
  banner: { kind: 'ok' | 'error'; text: string } | null = null;

  orders: ClientOrders = { requests: [], calls: { waiter: false, bill: false } };
  steps = STEPS;
  callBusy = false;

  private clientId = '';
  private timer?: ReturnType<typeof setInterval>;
  private bannerTimer?: ReturnType<typeof setTimeout>;
  private formatter?: Intl.NumberFormat;

  constructor(private route: ActivatedRoute, private api: QrPublicService) {}

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.clientId = this.loadClientId();
    this.pin = store.get(sessionStorage, `qr-pin:${this.token}`) ?? '';
    this.cart = this.readCart();
    this.customerName = store.get(localStorage, 'qr-customer-name') ?? '';
    this.load();
    this.timer = setInterval(() => {
      if (this.phase === 'ready' && !document.hidden) this.loadOrders();
    }, 6000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
  }

  // ---------- carga ----------

  load() {
    this.api.info(this.token, this.pin || undefined).subscribe({
      next: (info) => {
        this.info = info;
        document.title = `${info.business.name} · ${info.table.name}`;
        this.formatter = undefined;
        if (!info.pinOk) {
          this.phase = 'pin';
          if (this.pin) this.pinError = 'Ese código no es correcto';
          this.pin = '';
          store.set(sessionStorage, `qr-pin:${this.token}`, null);
          return;
        }
        this.phase = 'ready';
        this.pinError = '';
        this.dropUnavailableFromCart();
        this.loadOrders();
      },
      error: (err) => {
        if (err.status === 404) this.phase = 'notFound';
        else if (err.status === 429) {
          this.phase = 'pin';
          this.pinError = err.error?.message || 'Demasiados intentos. Esperá unos minutos o pedile el código al mozo.';
        } else this.phase = this.info ? this.phase : 'error';
      },
    });
  }

  submitPin() {
    const pin = this.pinInput.trim();
    if (!pin) return;
    this.pin = pin;
    store.set(sessionStorage, `qr-pin:${this.token}`, pin);
    this.pinInput = '';
    this.phase = 'loading';
    this.load();
  }

  loadOrders() {
    this.api.mine(this.token, this.pin || undefined, this.clientId).subscribe({
      next: (o) => (this.orders = o),
      error: (err) => {
        if (err.status === 403) this.askPinAgain();
      },
    });
  }

  private askPinAgain() {
    this.pin = '';
    store.set(sessionStorage, `qr-pin:${this.token}`, null);
    this.phase = 'pin';
  }

  // ---------- carta ----------

  get categories() {
    const menu = this.info?.menu;
    if (!menu) return [];
    const used = new Set(menu.items.map((i) => i.categoryId));
    const list = menu.categories.filter((c) => used.has(c.id));
    return menu.items.some((i) => !i.categoryId) ? [...list, { id: '', name: 'Otros' }] : list;
  }

  get visibleItems(): PublicItem[] {
    const items = this.info?.menu?.items ?? [];
    const q = normalize(this.search);
    return items.filter(
      (i) =>
        (this.categoryId === 'all' || (i.categoryId ?? '') === this.categoryId) && (!q || normalize(i.name).includes(q)),
    );
  }

  // Con búsqueda se ignora la categoría elegida
  get grouped(): { name: string; items: PublicItem[] }[] {
    const menu = this.info?.menu;
    if (!menu) return [];
    const byCat = new Map<string, PublicItem[]>();
    for (const i of this.visibleItems) {
      const k = i.categoryId ?? '';
      byCat.set(k, [...(byCat.get(k) ?? []), i]);
    }
    const order = [...menu.categories.map((c) => c.id), ''];
    return order
      .filter((id) => byCat.has(id))
      .map((id) => ({ name: id ? menu.categories.find((c) => c.id === id)!.name : 'Otros', items: byCat.get(id)! }));
  }

  hasOptions(item: PublicItem) {
    return item.groups.length > 0;
  }

  money(n: number): string {
    if (!this.formatter) {
      try {
        this.formatter = new Intl.NumberFormat(this.info?.business.locale, { style: 'currency', currency: this.info?.business.currencyCode });
      } catch {
        this.formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
      }
    }
    return this.formatter.format(n);
  }

  // ---------- armar un plato ----------

  openItem(item: PublicItem) {
    if (item.soldOut) return;
    this.sheetItem = item;
    this.sheetQty = 1;
    this.sheetNote = '';
    this.sheetError = '';
    this.sheetSel = {};
    // Los grupos de "elegir una" y obligatorios arrancan con la primera opción, como en el mostrador
    for (const g of item.groups) this.sheetSel[g.id] = g.selection === 'SINGLE' && g.required && g.options.length ? [g.options[0].id] : [];
  }

  closeSheet() {
    this.sheetItem = null;
  }

  isChosen(g: PublicGroup, optionId: string) {
    return (this.sheetSel[g.id] ?? []).includes(optionId);
  }

  toggleOption(g: PublicGroup, optionId: string) {
    const current = this.sheetSel[g.id] ?? [];
    if (g.selection === 'SINGLE') {
      // Tocar la elegida la saca (si no es obligatoria); tocar otra la reemplaza
      this.sheetSel[g.id] = current.includes(optionId) ? (g.required ? current : []) : [optionId];
    } else {
      this.sheetSel[g.id] = current.includes(optionId) ? current.filter((o) => o !== optionId) : [...current, optionId];
    }
    this.sheetError = '';
  }

  get sheetUnit(): number {
    const item = this.sheetItem;
    if (!item) return 0;
    let total = item.price;
    for (const g of item.groups) for (const o of g.options) if (this.isChosen(g, o.id)) total += o.priceDelta;
    return total;
  }

  addFromSheet() {
    const item = this.sheetItem;
    if (!item) return;
    const missing = item.groups.find((g) => g.required && (this.sheetSel[g.id] ?? []).length === 0);
    if (missing) {
      this.sheetError = `Elegí una opción de "${missing.name}"`;
      return;
    }
    const chosen = item.groups.flatMap((g) => g.options.filter((o) => this.isChosen(g, o.id)));
    this.addToCart(item, this.sheetQty, this.sheetNote.trim(), chosen.map((o) => o.id), chosen.map((o) => o.name), this.sheetUnit);
    this.sheetItem = null;
  }

  // "+" rápido en platos sin opciones
  quickAdd(item: PublicItem, event: Event) {
    event.stopPropagation();
    if (item.soldOut) return;
    this.addToCart(item, 1, '', [], [], item.price);
  }

  private addToCart(item: PublicItem, quantity: number, note: string, optionIds: string[], extras: string[], unitPrice: number) {
    const key = [item.id, [...optionIds].sort().join('|'), note].join('#');
    const existing = this.cart.find((l) => l.key === key);
    if (existing) existing.quantity = Math.min(30, existing.quantity + quantity);
    else this.cart.push({ key, itemId: item.id, name: item.name, quantity, note, optionIds, extras, unitPrice });
    this.saveCart();
    this.say('ok', `${item.name} agregado`);
  }

  // ---------- pedido ----------

  get cartUnits() {
    return this.cart.reduce((n, l) => n + l.quantity, 0);
  }

  get cartTotal() {
    return this.cart.reduce((n, l) => n + l.quantity * l.unitPrice, 0);
  }

  changeQty(line: CartLine, delta: number) {
    line.quantity = Math.max(0, Math.min(30, line.quantity + delta));
    if (line.quantity === 0) this.cart = this.cart.filter((l) => l !== line);
    if (this.cart.length === 0) this.cartOpen = false;
    this.saveCart();
  }

  send() {
    if (this.sending || this.cart.length === 0) return;
    this.sending = true;
    store.set(localStorage, 'qr-customer-name', this.customerName.trim() || null);
    this.api
      .send(this.token, this.pin || undefined, {
        clientId: this.clientId,
        customerName: this.customerName.trim(),
        items: this.cart.map((l) => ({
          menuItemId: l.itemId,
          quantity: l.quantity,
          note: l.note || undefined,
          optionIds: l.optionIds.length ? l.optionIds : undefined,
        })),
      })
      .subscribe({
        next: (sent) => {
          this.sending = false;
          this.cart = [];
          this.saveCart();
          this.cartOpen = false;
          this.tab = 'orders';
          this.say('ok', sent.step === 'RECEIVED' ? '¡Pedido enviado! El mozo lo va a confirmar.' : '¡Pedido enviado!');
          this.loadOrders();
        },
        error: (err) => {
          this.sending = false;
          if (err.status === 403 && err.error?.code === 'PIN_REQUIRED') return this.askPinAgain();
          this.say('error', this.errorText(err));
          // Si un plato ya no está o se agotó, se refresca la carta para que el cliente lo vea
          if (err.status === 400 || err.status === 409) this.load();
        },
      });
  }

  // ---------- mis pedidos ----------

  get activeCount() {
    return this.orders.requests.filter((r) => r.step !== 'REJECTED' && r.step !== 'CANCELLED' && r.step !== 'READY').length;
  }

  stepIndex(step: ClientStep) {
    return STEPS.findIndex((s) => s.step === step);
  }

  cancelRequest(r: ClientRequest) {
    this.api.cancel(this.token, this.pin || undefined, r.id, this.clientId).subscribe({
      next: () => {
        this.say('ok', 'Pedido cancelado');
        this.loadOrders();
      },
      error: (err) => {
        this.say('error', this.errorText(err));
        this.loadOrders();
      },
    });
  }

  call(type: 'WAITER' | 'BILL') {
    if (this.callBusy) return;
    this.callBusy = true;
    this.api.call(this.token, this.pin || undefined, type).subscribe({
      next: () => {
        this.callBusy = false;
        this.say('ok', type === 'WAITER' ? 'Avisamos al mozo, ya viene' : 'Pedimos la cuenta, ya te la llevan');
        this.loadOrders();
      },
      error: (err) => {
        this.callBusy = false;
        this.say('error', this.errorText(err));
      },
    });
  }

  // ---------- utilidades ----------

  private say(kind: 'ok' | 'error', text: string) {
    this.banner = { kind, text };
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => (this.banner = null), kind === 'error' ? 6000 : 3000);
  }

  private errorText(err: any): string {
    const msg = err?.error?.message;
    if (err?.status === 0) return 'Sin conexión. Revisá tu internet y probá de nuevo.';
    return (Array.isArray(msg) ? msg.join('. ') : msg) || 'No se pudo completar. Probá de nuevo.';
  }

  // Si desde que se armó el pedido un plato se agotó o salió de la carta, se quita del pedido
  private dropUnavailableFromCart() {
    const items = new Map((this.info?.menu?.items ?? []).map((i) => [i.id, i]));
    const before = this.cart.length;
    this.cart = this.cart.filter((l) => items.has(l.itemId) && !items.get(l.itemId)!.soldOut);
    if (this.cart.length !== before) {
      this.saveCart();
      this.say('error', 'Sacamos de tu pedido lo que ya no está disponible');
    }
  }

  private readCart(): CartLine[] {
    try {
      const parsed = JSON.parse(store.get(sessionStorage, `qr-cart:${this.token}`) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveCart() {
    store.set(sessionStorage, `qr-cart:${this.token}`, this.cart.length ? JSON.stringify(this.cart) : null);
  }

  private loadClientId(): string {
    const existing = store.get(localStorage, 'qr-client-id');
    if (existing && /^[\w-]{8,64}$/.test(existing)) return existing;
    const fresh = (globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`).replace(/[^\w-]/g, '');
    store.set(localStorage, 'qr-client-id', fresh);
    return fresh;
  }
}
