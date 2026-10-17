import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { RealtimeService } from 'src/app/services/realtime.service';
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

// Cómo avanza un pedido (lo que ve el cliente)
const STEPS: { step: ClientStep; label: string }[] = [
  { step: 'RECEIVED', label: 'Recibido' },
  { step: 'CONFIRMED', label: 'Confirmado' },
  { step: 'PREPARING', label: 'En cocina' },
  { step: 'READY', label: 'Listo' },
];

// Sin cocina el pedido termina cuando el mozo lo confirma
const STEPS_NO_KITCHEN = STEPS.filter((s) => s.step === 'RECEIVED' || s.step === 'CONFIRMED');

// Pedidos que todavía están en marcha: se muestran completos. Los terminados quedan plegados.
const LIVE_STEPS: ClientStep[] = ['RECEIVED', 'CONFIRMED', 'PREPARING'];

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
// Cuánto dura la pantalla de pedido enviado antes de pasar al seguimiento
const SPLASH_SECONDS = 7;

@Component({
  selector: 'app-qr-order',
  templateUrl: './qr-order.component.html',
  styles: [
    `
      @keyframes drawCheck {
        to {
          stroke-dashoffset: 0;
        }
      }
      /* Rebote del botón al agregar un plato */
      @keyframes addedPop {
        0% {
          transform: scale(0.85);
        }
        60% {
          transform: scale(1.15);
        }
        100% {
          transform: scale(1);
        }
      }
      .added-pop {
        animation: addedPop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1);
      }
      .check-path {
        stroke-dasharray: 24;
        stroke-dashoffset: 24;
        animation: drawCheck 0.6s 0.2s cubic-bezier(0.65, 0, 0.45, 1) forwards;
      }
      @media (prefers-reduced-motion: reduce) {
        .check-path {
          animation-duration: 0.01s;
          animation-delay: 0s;
        }
        .added-pop {
          animation: none;
        }
      }
    `,
  ],
})
export class QrOrderComponent implements OnInit, OnDestroy {
  token = '';
  phase: Phase = 'loading';
  info: PublicInfo | null = null;

  // Código de mesa: se escribe en UN solo campo (invisible) y se muestra repartido en cuatro casilleros.
  // Con cuatro campos separados, el celular perdía el foco al saltar de uno a otro y los números se mezclaban.
  pin = '';
  pinValue = '';
  readonly pinSlots = [0, 1, 2, 3];
  pinError = '';
  pinHelpSent = false;

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

  // Pantalla de transición que se ve un momento después de enviar el pedido
  splash: { id: string; units: number; total: number; step: ClientStep; previous: number } | null = null;
  splashSeconds = SPLASH_SECONDS;
  readonly splashDurationMs = SPLASH_SECONDS * 1000;
  splashRunning = false; // pone en marcha la barra de progreso
  private splashTimer?: ReturnType<typeof setInterval>;
  private splashEnd?: ReturnType<typeof setTimeout>;
  callBusy = false;
  openPast: Record<string, boolean> = {};

  private clientId = '';
  private ordersSub?: Subscription;
  // Al volver a la pestaña se actualiza enseguida (mientras estaba oculta no se consultaba)
  private onVisible = () => {
    if (!document.hidden && this.phase === 'ready') this.loadOrders();
  };
  private bannerTimer?: ReturnType<typeof setTimeout>;
  private helpTimer?: ReturnType<typeof setTimeout>;
  private formatter?: Intl.NumberFormat;

  constructor(private route: ActivatedRoute, private api: QrPublicService, private realtime: RealtimeService) {}

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.clientId = this.loadClientId();
    this.pin = store.get(sessionStorage, `qr-pin:${this.token}`) ?? '';
    this.cart = this.readCart();
    this.customerName = store.get(localStorage, 'qr-customer-name') ?? '';
    this.load();
    // El estado de los pedidos se actualiza en el momento en que el local lo cambia; sin conexión en vivo, cada 6 segundos
    this.realtime.connectCustomer(this.token);
    this.ordersSub = this.realtime.refresh$('orders', 6000).subscribe(() => {
      if (this.phase === 'ready' && !document.hidden) this.loadOrders();
    });
    document.addEventListener('visibilitychange', this.onVisible);
  }

  ngOnDestroy() {
    this.ordersSub?.unsubscribe();
    this.realtime.disconnectCustomer();
    document.removeEventListener('visibilitychange', this.onVisible);
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    if (this.helpTimer) clearTimeout(this.helpTimer);
    this.clearSplashTimers();
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
          this.pinValue = '';
          store.set(sessionStorage, `qr-pin:${this.token}`, null);
          this.focusPin();
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

  // ¿El negocio usa la cocina? Sin ella el pedido no pasa por "en cocina" ni "listo"
  get kitchen(): boolean {
    return this.info?.kitchen !== false;
  }

  get steps() {
    return this.kitchen ? STEPS : STEPS_NO_KITCHEN;
  }

  private get liveSteps(): ClientStep[] {
    return this.kitchen ? LIVE_STEPS : ['RECEIVED'];
  }

  // Pedido terminado con éxito: listo (con cocina) o confirmado (sin cocina)
  isDone(step: ClientStep): boolean {
    return step === 'READY' || (!this.kitchen && step === 'CONFIRMED');
  }

  // ---------- código de mesa ----------

  get pinComplete(): boolean {
    return this.pinValue.length === 4;
  }

  focusPin() {
    setTimeout(() => (document.getElementById('pin-input') as HTMLInputElement | null)?.focus(), 30);
  }

  // Cada número que se escribe (o se pega) llena el siguiente casillero; al completar los 4 se valida solo
  onPinInput(event: Event) {
    const el = event.target as HTMLInputElement;
    this.pinValue = el.value.replace(/\D/g, '').slice(0, 4);
    el.value = this.pinValue;
    this.pinError = '';
    if (this.pinComplete) this.submitPin();
  }

  submitPin() {
    if (!this.pinComplete) {
      this.pinError = 'Completá los 4 números';
      this.focusPin();
      return;
    }
    this.pin = this.pinValue;
    store.set(sessionStorage, `qr-pin:${this.token}`, this.pin);
    this.phase = 'loading';
    this.load();
  }

  // Sin código también se puede llamar al mozo (es lo que hace quien no lo tiene)
  callWaiterWithoutPin() {
    if (this.callBusy || this.pinHelpSent) return;
    this.callBusy = true;
    this.api.call(this.token, undefined, 'WAITER').subscribe({
      next: () => {
        this.callBusy = false;
        this.pinHelpSent = true;
        if (this.helpTimer) clearTimeout(this.helpTimer);
        this.helpTimer = setTimeout(() => (this.pinHelpSent = false), 6000);
      },
      error: (err) => {
        this.callBusy = false;
        this.pinError = this.errorText(err);
      },
    });
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
    this.pinValue = '';
    store.set(sessionStorage, `qr-pin:${this.token}`, null);
    this.phase = 'pin';
    this.focusPin();
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

  private lineKey(itemId: string, optionIds: string[], note: string) {
    return [itemId, [...optionIds].sort().join('|'), note.trim()].join('#');
  }

  private addToCart(item: PublicItem, quantity: number, note: string, optionIds: string[], extras: string[], unitPrice: number) {
    const key = this.lineKey(item.id, optionIds, note);
    const existing = this.cart.find((l) => l.key === key);
    if (existing) existing.quantity = Math.min(30, existing.quantity + quantity);
    else this.cart.push({ key, itemId: item.id, name: item.name, quantity, note, optionIds, extras, unitPrice });
    this.saveCart();
    this.say('ok', `${item.name} agregado`);
    // Marca el botón del plato un instante para que rebote
    this.justAdded = item.id;
    setTimeout(() => {
      if (this.justAdded === item.id) this.justAdded = '';
    }, 600);
  }

  // Platos que ya están en el pedido (con cualquier combinación de opciones): el botón "+" pasa a ser un check
  justAdded = '';

  inCart(item: PublicItem): boolean {
    return this.cart.some((l) => l.itemId === item.id);
  }

  qtyInCart(item: PublicItem): number {
    return this.cart.filter((l) => l.itemId === item.id).reduce((n, l) => n + l.quantity, 0);
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

  // La aclaración se edita en el pedido; al terminar, si quedó igual a otra línea del mismo plato, se juntan
  commitNote(line: CartLine) {
    line.note = line.note.slice(0, 140);
    const key = this.lineKey(line.itemId, line.optionIds, line.note);
    const twin = this.cart.find((l) => l !== line && l.key === key);
    if (twin) {
      twin.quantity = Math.min(30, twin.quantity + line.quantity);
      this.cart = this.cart.filter((l) => l !== line);
    } else {
      line.key = key;
    }
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
          note: l.note.trim() || undefined,
          optionIds: l.optionIds.length ? l.optionIds : undefined,
        })),
      })
      .subscribe({
        next: (sent) => {
          this.sending = false;
          this.cart = [];
          this.saveCart();
          this.cartOpen = false;
          this.showSplash(sent);
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

  // ---------- transición después de enviar ----------

  private showSplash(sent: ClientRequest) {
    const units = sent.items.reduce((n, l) => n + l.quantity, 0);
    this.splash = { id: sent.id, units, total: sent.total, step: sent.step, previous: this.orders.requests.length };
    this.splashSeconds = SPLASH_SECONDS;
    this.splashRunning = false;
    this.clearSplashTimers();
    // La barra arranca en el cuadro siguiente para que la transición se vea
    setTimeout(() => (this.splashRunning = true), 30);
    this.splashTimer = setInterval(() => {
      this.splashSeconds = Math.max(0, this.splashSeconds - 1);
      if (this.splashSeconds === 0 && this.splashTimer) clearInterval(this.splashTimer);
    }, 1000);
    this.splashEnd = setTimeout(() => this.finishSplash(), SPLASH_SECONDS * 1000 + 200);
    window.scrollTo({ top: 0 });
  }

  // Número del pedido recién enviado (cuando todavía no llegó la lista actualizada, el siguiente al último)
  get splashNumber(): number {
    const s = this.splash;
    if (!s) return 0;
    const found = this.orders.requests.findIndex((r) => r.id === s.id);
    return found >= 0 ? this.orders.requests.length - found : s.previous + 1;
  }

  finishSplash() {
    this.clearSplashTimers();
    this.splash = null;
    this.tab = 'orders';
    this.loadOrders();
  }

  private clearSplashTimers() {
    if (this.splashTimer) clearInterval(this.splashTimer);
    if (this.splashEnd) clearTimeout(this.splashEnd);
  }

  // ---------- mis pedidos ----------

  get liveRequests(): ClientRequest[] {
    return this.orders.requests.filter((r) => this.liveSteps.includes(r.step));
  }

  get pastRequests(): ClientRequest[] {
    return this.orders.requests.filter((r) => !this.liveSteps.includes(r.step));
  }

  get activeCount() {
    return this.liveRequests.length;
  }

  // Número del pedido en esta mesa para este celular: el más viejo es el 1
  requestNumber(r: ClientRequest): number {
    return this.orders.requests.length - this.orders.requests.indexOf(r);
  }

  stepIndex(step: ClientStep) {
    return STEPS.findIndex((s) => s.step === step);
  }

  // Frase de estado de un pedido en marcha
  statusText(step: ClientStep): string {
    switch (step) {
      case 'RECEIVED':
        return 'Esperando que el mozo lo confirme';
      case 'CONFIRMED':
        return 'Confirmado: ya va a cocina';
      case 'PREPARING':
        return 'Lo están preparando';
      default:
        return '';
    }
  }

  pastLabel(step: ClientStep): string {
    return step === 'READY' ? 'Listo' : step === 'CONFIRMED' ? 'Confirmado' : step === 'REJECTED' ? 'No se pudo tomar' : 'Cancelado';
  }

  togglePast(id: string) {
    this.openPast[id] = !this.openPast[id];
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
