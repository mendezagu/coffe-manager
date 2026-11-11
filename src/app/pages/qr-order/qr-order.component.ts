import { backgroundVeil, coverVeil } from 'src/app/utils/brand-intensity';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { brandStyle } from 'src/app/services/brand';
import { RealtimeService } from 'src/app/services/realtime.service';
import { DeliveryMode, DeliveryPay, DeliveryPublicService, DeliveryStatus, StoreConfig, StoreInfo, StoreOrderView } from 'src/app/services/delivery.service';
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
const STEPS: { step: ClientStep; label: string; icon: string }[] = [
  { step: 'RECEIVED', label: 'Recibido', icon: 'inbox' },
  { step: 'CONFIRMED', label: 'Confirmado', icon: 'task_alt' },
  { step: 'PREPARING', label: 'En cocina', icon: 'restaurant' },
  { step: 'READY', label: 'Listo', icon: 'room_service' },
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
      /* Carta oscura (se elige en Ajustes): las superficies y la tinta salen de variables; el color de marca se aclara en brandStyle */
      .qr-dark {
        color-scheme: dark;
        --q-surface: 43 50 62;
        --q-surface-low: 47 55 68;
        --q-surface-mid: 47 55 68;
        --q-surface-high: 27 32 41;
        --q-surface-highest: 58 66 82;
        --q-surface-lowest: 37 43 54;
        --q-ink: 221 225 232;
        --q-ink-variant: 180 188 200;
        --q-line: 138 148 164;
        --q-line-soft: 69 78 95;
        --q-leaf: 43 181 152;
        --q-leaf-container: 22 66 62;
        --q-leaf-dim: 111 227 198;
        --q-leaf-ink: 200 243 232;
        --q-leaf-ink2: 200 243 232;
      }
      .qr-dark .text-forest {
        color: rgb(var(--q-ink));
      }
      .qr-dark .bg-white {
        background-color: rgb(var(--q-surface-mid));
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
  // Variables CSS con el color de marca del restaurante (el token `forest` las lee)
  get brandStyle(): string {
    return brandStyle(this.info?.business?.brandColor, this.dark);
  }

  // Carta oscura, si el local la eligió en Ajustes
  get dark(): boolean {
    return this.info?.business?.menuTheme === 'dark';
  }

  // Portada: foto en la banda de arriba, oscurecida para que se lea el nombre del local
  get coverStyle(): Record<string, string> {
    const url = this.info?.business?.coverUrl;
    return url
      ? {
          'background-image': `${coverVeil(this.info?.business?.coverIntensity)}, url("${url.replace(/"/g, '%22')}")`,
          'background-size': 'cover',
          'background-position': 'center',
        }
      : {};
  }

  // Fondo: imagen detrás de la página, aclarada para que las tarjetas y los textos se lean bien
  get pageStyle(): Record<string, string> {
    const url = this.info?.business?.backgroundUrl;
    if (!url) return {};
    // Una imagen vertical (con el dibujo en los bordes) recortada a pantalla completa pierde los costados: se ajusta al ancho y se repite hacia abajo.
    const portrait = this.backgroundIsPortrait(url);
    return {
      'background-image': `${backgroundVeil(this.info?.business?.backgroundIntensity, this.dark)}, url("${url.replace(/"/g, '%22')}")`,
      'background-size': portrait ? '100% auto' : 'cover',
      'background-position': portrait ? 'center top' : 'center',
      'background-repeat': portrait ? 'repeat-y' : 'no-repeat',
      'background-attachment': portrait ? 'scroll' : 'fixed',
    };
  }

  private backgroundRatios = new Map<string, number>();

  private backgroundIsPortrait(url: string): boolean {
    const known = this.backgroundRatios.get(url);
    if (known === undefined) {
      this.backgroundRatios.set(url, 1);
      const img = new Image();
      img.onload = () => this.backgroundRatios.set(url, img.naturalWidth / (img.naturalHeight || 1));
      img.src = url;
      return false;
    }
    return known < 0.9;
  }

  token = '';
  // Tienda online (ruta /delivery/:slug): la misma pantalla, con carrito, datos de entrega y seguimiento
  storeMode = false;
  // Carta online: la misma pantalla en modo "solo ver" (ruta /carta/:slug)
  slug = '';
  viewOnly = false;
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

  constructor(private route: ActivatedRoute, private api: QrPublicService, private realtime: RealtimeService, private delivery: DeliveryPublicService) {}

  ngOnInit() {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.storeMode = this.route.snapshot.data['store'] === true;
    this.viewOnly = !!this.slug && !this.storeMode;
    if (this.viewOnly) {
      this.loadCarta();
      return;
    }
    if (this.storeMode) {
      this.clientId = this.loadClientId();
      this.cart = this.readCart();
      this.readCheckout();
      this.myTokens = this.readTokens();
      this.loadStore();
      // El estado de los pedidos se consulta cada pocos segundos mientras la pantalla está abierta
      this.trackTimer = setInterval(() => {
        if (this.phase === 'ready' && !document.hidden && this.myTokens.length) this.refreshMyOrders();
      }, 8000);
      return;
    }
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
    if (!this.viewOnly && !this.storeMode) this.realtime.disconnectCustomer();
    if (this.trackTimer) clearInterval(this.trackTimer);
    document.removeEventListener('visibilitychange', this.onVisible);
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    if (this.helpTimer) clearTimeout(this.helpTimer);
    this.clearSplashTimers();
  }

  // ---------- carga ----------

  // Carta online: solo se trae el menú del local
  private loadCarta() {
    this.api.carta(this.slug).subscribe({
      next: (info) => {
        this.info = info;
        document.title = `${info.business.name} · Carta`;
        this.formatter = undefined;
        this.phase = 'ready';
      },
      error: (err) => (this.phase = err.status === 404 ? 'notFound' : 'error'),
    });
  }

  load() {
    if (this.storeMode) {
      this.loadStore();
      return;
    }
    if (this.viewOnly) {
      this.loadCarta();
      return;
    }
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

  // Textos e íconos de los pasos del pedido (los dibuja el "stepper" de la pantalla)
  get stepLabels(): string[] {
    return this.steps.map((s) => s.label);
  }

  get stepIcons(): string[] {
    return this.steps.map((s) => s.icon);
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

  // Colores de la etiqueta sobre la foto (clases completas para que Tailwind las encuentre)
  private static readonly BADGES: Record<string, string> = {
    terracotta: 'bg-[#c2703d] text-white',
    green: 'bg-[#1f6f4a] text-white',
    red: 'bg-[#d62f2f] text-white',
    blue: 'bg-[#2f6fd6] text-white',
    amber: 'bg-[#d98a14] text-white',
    dark: 'bg-[#363f4e] text-white',
  };

  badgeClass(color?: string): string {
    return QrOrderComponent.BADGES[color ?? ''] ?? QrOrderComponent.BADGES['terracotta'];
  }

  // Destacados: carrusel de arriba (solo cuando no se está buscando ni filtrando por categoría)
  get featuredItems(): PublicItem[] {
    if (this.search || this.categoryId !== 'all') return [];
    return (this.info?.menu?.items ?? []).filter((i) => i.featured);
  }

  // Cómo se dibuja un plato según el formato de su sección: sin foto, siempre va en formato lista
  cardStyle(layout: string | undefined, item: PublicItem): 'grid' | 'list' | 'hero' {
    if (!item.imageUrl) return 'list';
    return layout === 'hero' ? 'hero' : layout === 'list' ? 'list' : 'grid';
  }

  trackSection = (_: number, g: { id: string }) => g.id;

  // Con búsqueda se ignora la categoría elegida
  get grouped(): { id: string; name: string; subtitle: string | null; tagline: string | null; layout: string; items: PublicItem[] }[] {
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
      .map((id) => {
        const cat = id ? menu.categories.find((c) => c.id === id) : undefined;
        return { id, name: cat?.name ?? 'Otros', subtitle: cat?.subtitle ?? null, tagline: cat?.tagline ?? null, layout: cat?.layout ?? 'grid', items: byCat.get(id)! };
      });
  }

  // ---- Opciones y precios (carta online: solo se ven, no se piden) ----

  // Ficha de un plato con opciones
  detailItem: PublicItem | null = null;

  openDetail(item: PublicItem) {
    if (this.hasOptions(item)) this.detailItem = item;
  }

  closeDetail() {
    this.detailItem = null;
  }

  @HostListener('document:keydown.escape') onEscape() {
    this.detailItem = null;
  }

  // Precio más bajo con el que se puede pedir: el base más lo mínimo de cada opción obligatoria
  priceFrom(item: PublicItem): number {
    return item.price + item.groups.filter((g) => g.required && g.options.length).reduce((sum, g) => sum + Math.min(...g.options.map((o) => o.priceDelta)), 0);
  }

  // "Desde" solo si una opción obligatoria cambia el precio (los extras opcionales no cuentan)
  priceVaries(item: PublicItem): boolean {
    return item.groups.some((g) => g.required && g.options.length > 1 && Math.min(...g.options.map((o) => o.priceDelta)) !== Math.max(...g.options.map((o) => o.priceDelta)));
  }

  priceText(item: PublicItem): string {
    return (this.priceVaries(item) ? 'Desde ' : '') + this.money(this.priceFrom(item));
  }

  // Lo que suma o resta una opción
  deltaLabel(delta: number): string {
    if (!delta) return 'Sin costo';
    return (delta > 0 ? '+ ' : '− ') + this.money(Math.abs(delta));
  }

  // ¿El grupo es obligatorio y cambia el precio? Entonces cada opción se muestra con su PRECIO FINAL (no con lo que "suma"),
  // para que la más barata no parezca gratis.
  groupSetsPrice(g: { required: boolean; options: { priceDelta: number }[] }): boolean {
    if (!g.required || g.options.length < 2) return false;
    const deltas = g.options.map((o) => o.priceDelta);
    return Math.min(...deltas) !== Math.max(...deltas);
  }

  // Texto de cada opción en la ficha
  optionLabel(item: PublicItem, g: PublicGroup, o: { priceDelta: number }): string {
    if (this.groupSetsPrice(g)) {
      // precio del plato con esta opción (más lo mínimo de los otros grupos obligatorios)
      const others = item.groups.filter((x) => x !== g && x.required && x.options.length).reduce((sum, x) => sum + Math.min(...x.options.map((p) => p.priceDelta)), 0);
      return this.money(item.price + others + o.priceDelta);
    }
    if (g.required && !o.priceDelta) return 'Incluido'; // obligatorio y sin cambio de precio: está incluido, no es gratis
    return this.deltaLabel(o.priceDelta);
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
    return this.storeMode ? this.activeOrders.length : this.liveRequests.length;
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

  // ---------- tienda online ----------

  private trackTimer?: ReturnType<typeof setInterval>;

  get cartKey(): string {
    return this.storeMode ? `delivery-cart:${this.slug}` : `qr-cart:${this.token}`;
  }

  get shop(): StoreConfig | null {
    return (this.info as StoreInfo | null)?.store ?? null;
  }

  // Sin pedir: la carta online, o una tienda en pausa (se puede mirar pero no agregar)
  get browseOnly(): boolean {
    return this.viewOnly || (this.storeMode && !!this.shop?.paused);
  }

  checkout: { name: string; phone: string; mode: DeliveryMode; address: string; pay: DeliveryPay; note: string } = {
    name: '',
    phone: '',
    mode: 'pickup',
    address: '',
    pay: 'cash',
    note: '',
  };
  checkoutError = '';
  // Pedido recién enviado (muestra los pasos siguientes: datos bancarios, WhatsApp)
  sentOrder: { order: StoreOrderView; stored: boolean } | null = null;
  myTokens: { token: string; number: number | null }[] = [];
  myOrders: StoreOrderView[] = [];

  private loadStore() {
    this.delivery.info(this.slug).subscribe({
      next: (info) => {
        this.info = info;
        document.title = `${info.business.name} · Pedidos online`;
        this.formatter = undefined;
        this.phase = 'ready';
        const s = info.store;
        if (this.checkout.mode === 'pickup' && !s.pickup && s.home) this.checkout.mode = 'delivery';
        if (this.checkout.mode === 'delivery' && !s.home) this.checkout.mode = 'pickup';
        if (this.checkout.pay === 'cash' && !s.payCash && s.payTransfer) this.checkout.pay = 'transfer';
        if (this.checkout.pay === 'transfer' && !s.payTransfer) this.checkout.pay = 'cash';
        this.dropUnavailableFromCart();
        if (this.myTokens.length) this.refreshMyOrders();
      },
      error: (err) => (this.phase = err.status === 404 ? 'notFound' : this.info ? this.phase : 'error'),
    });
  }

  get deliveryFee(): number {
    return this.checkout.mode === 'delivery' ? this.shop?.fee ?? 0 : 0;
  }

  get orderTotal(): number {
    return this.cartTotal + this.deliveryFee;
  }

  get activeOrders(): StoreOrderView[] {
    return this.myOrders.filter((o) => this.isLiveStatus(o.status));
  }

  get pastOrders(): StoreOrderView[] {
    return this.myOrders.filter((o) => !this.isLiveStatus(o.status));
  }

  isLiveStatus(s: DeliveryStatus) {
    return s === 'PENDING' || s === 'ACCEPTED' || s === 'READY';
  }

  storeSteps(o: StoreOrderView): { status: DeliveryStatus; label: string }[] {
    return [
      { status: 'PENDING', label: 'Recibido' },
      { status: 'ACCEPTED', label: 'Preparando' },
      { status: 'READY', label: o.mode === 'delivery' ? 'En camino' : 'Listo para retirar' },
    ];
  }

  storeLabels(o: StoreOrderView): string[] {
    return this.storeSteps(o).map((s) => s.label);
  }

  storeIcons(o: StoreOrderView): string[] {
    return ['inbox', 'restaurant', o.mode === 'delivery' ? 'two_wheeler' : 'shopping_bag'];
  }

  storeStepIndex(o: StoreOrderView): number {
    return this.storeSteps(o).findIndex((s) => s.status === o.status);
  }

  storeStatusText(o: StoreOrderView): string {
    switch (o.status) {
      case 'PENDING':
        return 'Esperando que el local acepte tu pedido';
      case 'ACCEPTED':
        return o.prepMin ? `Lo están preparando · unos ${o.prepMin} min` : 'Lo están preparando';
      case 'READY':
        return o.mode === 'delivery' ? 'Tu pedido salió hacia tu dirección' : 'Ya podés pasar a retirarlo';
      default:
        return '';
    }
  }

  storePastLabel(s: DeliveryStatus): string {
    return s === 'COMPLETED' ? 'Entregado' : s === 'REJECTED' ? 'No se pudo tomar' : 'Cancelado';
  }

  setMode(mode: DeliveryMode) {
    this.checkout.mode = mode;
    this.checkoutError = '';
  }

  private readCheckout() {
    try {
      const saved = JSON.parse(store.get(localStorage, 'delivery-customer') ?? 'null');
      if (saved && typeof saved === 'object') {
        this.checkout.name = String(saved.name ?? '').slice(0, 60);
        this.checkout.phone = String(saved.phone ?? '').slice(0, 25);
        this.checkout.address = String(saved.address ?? '').slice(0, 160);
      }
    } catch {
      /* sin datos guardados */
    }
  }

  private readTokens(): { token: string; number: number | null }[] {
    try {
      const parsed = JSON.parse(store.get(localStorage, `delivery-orders:${this.slug}`) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((t) => t && typeof t.token === 'string') : [];
    } catch {
      return [];
    }
  }

  private saveTokens() {
    store.set(localStorage, `delivery-orders:${this.slug}`, this.myTokens.length ? JSON.stringify(this.myTokens) : null);
  }

  refreshMyOrders() {
    if (!this.myTokens.length) {
      this.myOrders = [];
      return;
    }
    // Un pedido que el servidor ya no conoce (404) se quita de la lista; un corte de red lo deja como estaba
    const calls = this.myTokens.map((t) =>
      this.delivery.track(this.slug, t.token).pipe(catchError((err) => of(err?.status === 404 ? 'gone' : null))),
    );
    forkJoin(calls).subscribe((results) => {
      const gone = new Set<string>();
      const fresh: StoreOrderView[] = [];
      results.forEach((r, i) => {
        if (r === 'gone') gone.add(this.myTokens[i].token);
        else if (r) fresh.push(r as StoreOrderView);
        else {
          const prev = this.myOrders.find((o) => o.token === this.myTokens[i].token);
          if (prev) fresh.push(prev);
        }
      });
      if (gone.size) {
        this.myTokens = this.myTokens.filter((t) => !gone.has(t.token));
        this.saveTokens();
      }
      this.myOrders = fresh.sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
    });
  }

  sendStore() {
    if (this.sending || this.cart.length === 0 || !this.shop) return;
    const c = this.checkout;
    const digits = c.phone.replace(/\D/g, '');
    if (c.name.trim().length < 2) return this.fail('Escribí tu nombre');
    if (digits.length < 6) return this.fail('Escribí un teléfono para que el local pueda avisarte');
    if (c.mode === 'delivery' && c.address.trim().length < 4) return this.fail('Escribí la dirección de entrega');
    this.checkoutError = '';
    this.sending = true;
    // WhatsApp se abre en una pestaña que se pide ahora, con el toque del cliente: si se abriera recién cuando
    // llega la respuesta del servidor, el navegador del celular la bloquearía como ventana emergente.
    const waWindow = this.shop.whatsapp ? window.open('', '_blank') : null;
    store.set(localStorage, 'delivery-customer', JSON.stringify({ name: c.name.trim(), phone: c.phone.trim(), address: c.address.trim() }));
    this.delivery
      .create(this.slug, {
        clientId: this.clientId,
        customerName: c.name.trim(),
        phone: c.phone.trim(),
        mode: c.mode,
        address: c.mode === 'delivery' ? c.address.trim() : undefined,
        payMethod: c.pay,
        note: c.note.trim() || undefined,
        items: this.cart.map((l) => ({
          menuItemId: l.itemId,
          quantity: l.quantity,
          note: l.note.trim() || undefined,
          optionIds: l.optionIds.length ? l.optionIds : undefined,
        })),
      })
      .subscribe({
        next: (res) => {
          this.sending = false;
          this.cart = [];
          this.saveCart();
          this.cartOpen = false;
          this.checkout.note = '';
          this.sentOrder = res;
          if (waWindow) waWindow.location.href = this.whatsappLink(res.order);
          if (res.stored && res.order.token) {
            this.myTokens = [{ token: res.order.token, number: res.order.number }, ...this.myTokens].slice(0, 8);
            this.saveTokens();
            this.refreshMyOrders();
          }
          this.tab = 'orders';
          window.scrollTo({ top: 0 });
        },
        error: (err) => {
          this.sending = false;
          waWindow?.close();
          this.checkoutError = this.errorText(err);
          // Si un producto ya no está o se agotó, se refresca la carta para que el cliente lo vea
          if (err.status === 400 || err.status === 409) this.loadStore();
        },
      });
  }

  private fail(text: string) {
    this.checkoutError = text;
  }

  cancelStoreOrder(o: StoreOrderView) {
    if (!o.token) return;
    this.delivery.cancel(this.slug, o.token).subscribe({
      next: () => {
        this.say('ok', 'Pedido cancelado');
        this.refreshMyOrders();
      },
      error: (err) => {
        this.say('error', this.errorText(err));
        this.refreshMyOrders();
      },
    });
  }

  // El pedido listo para mandar por WhatsApp (el precio es el que calculó el servidor)
  whatsappLink(o: StoreOrderView): string {
    const lines: string[] = [`Hola ${this.info?.business.name ?? ''}! Quiero hacer un pedido${o.number ? ` (#${o.number})` : ''}:`, ''];
    for (const l of o.items) {
      lines.push(`${l.quantity}x ${l.name}${l.extras.length ? ` (${l.extras.join(', ')})` : ''} - ${this.money(l.unitPrice * l.quantity)}`);
      if (l.note) lines.push(`   Aclaración: ${l.note}`);
    }
    lines.push('');
    if (o.deliveryFee > 0) lines.push(`Envío: ${this.money(o.deliveryFee)}`);
    lines.push(`Total: ${this.money(o.total)}`, '');
    lines.push(o.mode === 'delivery' ? `Envío a: ${o.address}` : 'Retiro en el local');
    lines.push(`Pago: ${o.payMethod === 'transfer' ? 'transferencia' : 'efectivo'}`);
    lines.push(`Nombre: ${o.customerName}`, `Teléfono: ${o.phone}`);
    if (o.note) lines.push(`Aclaración: ${o.note}`);
    return `https://wa.me/${this.shop?.whatsapp ?? ''}?text=${encodeURIComponent(lines.join('\n'))}`;
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
      const parsed = JSON.parse(store.get(sessionStorage, this.cartKey) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveCart() {
    store.set(sessionStorage, this.cartKey, this.cart.length ? JSON.stringify(this.cart) : null);
  }

  private loadClientId(): string {
    const existing = store.get(localStorage, 'qr-client-id');
    if (existing && /^[\w-]{8,64}$/.test(existing)) return existing;
    const fresh = (globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`).replace(/[^\w-]/g, '');
    store.set(localStorage, 'qr-client-id', fresh);
    return fresh;
  }
}
