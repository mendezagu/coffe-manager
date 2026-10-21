import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import QRCode from 'qrcode';
import { Availability, BookingConfirmation, Slot, parseDay, toDayString } from 'src/app/services/reservations.service';
import {
  HotelPublicInfo,
  HotelPublicService,
  HotelRestaurant,
  IssuedVoucher,
  VoucherStatusName,
  apiMessage,
} from 'src/app/services/hotels.service';

type Phase = 'loading' | 'notFound' | 'error' | 'ready';
type Tab = 'restaurants' | 'mine';
type Sub = 'active' | 'past';

// Voucher guardado en este celular. El estado se actualiza con lo que dice el servidor.
interface StoredVoucher {
  code: string;
  restaurantId: string;
  restaurantName: string;
  discountPct: number;
  conditions: string;
  guestName: string;
  validTo: string;
  status: VoucherStatusName;
  redeemedAt: string | null;
}

const MAX_STORED = 30;
const MAX_STATUS_CODES = 20; // tope del servidor por consulta
const COOLDOWN_MS = 24 * 3600 * 1000;

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* sin almacenamiento: funciona igual, solo no recuerda */
    }
  },
};

// Pantalla que ve el huésped al escanear el QR del hotel. No necesita sesión ni instalar nada:
// ve los restaurantes adheridos, toca "Obtener mi voucher", completa sus datos en un diálogo y recibe el voucher.
// En "Mis vouchers" ve los vigentes y, aparte, los vencidos y canjeados.
@Component({
  selector: 'app-hotel-landing',
  templateUrl: './hotel-landing.component.html',
})
export class HotelLandingComponent implements OnInit {
  phase: Phase = 'loading';
  info: HotelPublicInfo | null = null;
  slug = '';

  tab: Tab = 'restaurants';
  sub: Sub = 'active';

  // Diálogo para pedir el voucher
  dialogFor: HotelRestaurant | null = null;
  guestName = '';
  guestDocument = ''; // DNI o pasaporte
  accessCode = '';
  pending = false;
  error = '';
  // Voucher recién entregado (se muestra dentro del diálogo)
  result: StoredVoucher | null = null;
  reused = false;

  vouchers: StoredVoucher[] = [];
  qrs: Record<string, string> = {};

  constructor(private route: ActivatedRoute, private api: HotelPublicService) {}

  ngOnInit() {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.guestName = store.get('hotel_guest_name') ?? '';
    this.guestDocument = store.get('hotel_guest_doc') ?? '';
    this.accessCode = store.get(`hotel_code_${this.slug}`) ?? '';
    this.vouchers = this.readVouchers();
    this.load();
  }

  load() {
    this.phase = 'loading';
    this.api.info(this.slug).subscribe({
      next: (info) => {
        this.info = info;
        this.phase = 'ready';
        this.refreshStatuses();
      },
      error: (err) => (this.phase = err?.status === 404 ? 'notFound' : 'error'),
    });
  }

  // ---- datos del formulario ----

  // Nombre y apellido: al menos dos palabras
  get nameOk(): boolean {
    return this.guestName.trim().split(/\s+/).filter((w) => w.length >= 2).length >= 2;
  }

  // DNI o pasaporte: el servidor lo normaliza (sin puntos ni espacios); acá solo se pide un largo razonable
  get documentOk(): boolean {
    return this.guestDocument.replace(/[^A-Za-z0-9]/g, '').length >= 5;
  }

  get canAsk(): boolean {
    return this.nameOk && this.documentOk && this.accessCode.trim().length > 0 && !this.pending;
  }

  // ---- vouchers ----

  isActive(v: StoredVoucher): boolean {
    return v.status === 'ISSUED' && new Date(v.validTo).getTime() > Date.now();
  }

  get activeVouchers(): StoredVoucher[] {
    return this.vouchers.filter((v) => this.isActive(v));
  }

  get pastVouchers(): StoredVoucher[] {
    return this.vouchers.filter((v) => !this.isActive(v));
  }

  // Un voucher vigente que el huésped ya tiene para ese restaurante
  activeFor(restaurantId: string): StoredVoucher | undefined {
    return this.activeVouchers.find((v) => v.restaurantId === restaurantId);
  }

  // Hasta cuándo no puede pedir otro en ese restaurante (24 h después de canjear), si corresponde
  waitUntil(restaurantId: string): Date | null {
    const last = this.vouchers
      .filter((v) => v.restaurantId === restaurantId && v.status === 'REDEEMED' && v.redeemedAt)
      .map((v) => new Date(v.redeemedAt as string).getTime())
      .sort((a, b) => b - a)[0];
    if (!last || last + COOLDOWN_MS <= Date.now()) return null;
    return new Date(last + COOLDOWN_MS);
  }

  statusLabel(v: StoredVoucher): string {
    if (v.status === 'REDEEMED') return 'Canjeado';
    if (v.status === 'CANCELLED') return 'Anulado';
    return 'Vencido';
  }

  daysLeft(v: StoredVoucher): number {
    return Math.max(0, Math.ceil((new Date(v.validTo).getTime() - Date.now()) / 86400000));
  }

  showTab(t: Tab) {
    this.tab = t;
    if (t === 'mine') this.refreshStatuses();
  }

  // ---- diálogo ----

  openDialog(r: HotelRestaurant) {
    this.dialogFor = r;
    this.error = '';
    this.reused = false;
    this.result = null;
    this.pending = false;
  }

  @HostListener('document:keydown.escape')
  closeDialog() {
    this.dialogFor = null;
    this.result = null;
    this.resFor = null;
  }

  ask() {
    const r = this.dialogFor;
    if (!r || !this.canAsk) return;
    this.error = '';
    this.pending = true;
    this.api.issue(this.slug, { restaurantId: r.id, guestName: this.guestName.trim(), document: this.guestDocument.trim(), accessCode: this.accessCode.trim() }).subscribe({
      next: (v: IssuedVoucher) => {
        store.set('hotel_guest_name', this.guestName.trim());
        store.set('hotel_guest_doc', this.guestDocument.trim());
        store.set(`hotel_code_${this.slug}`, this.accessCode.trim());
        const stored = this.keepVoucher(v, r);
        this.reused = !!v.reused;
        this.result = stored;
        this.pending = false;
      },
      error: (err) => {
        this.pending = false;
        this.error =
          err?.status === 429
            ? 'Demasiados intentos. Esperá unos minutos.'
            : apiMessage(err, 'No se pudo pedir el voucher. Revisá tu conexión e intentá de nuevo.');
      },
    });
  }

  // Guarda en este celular el voucher que entregó el servidor
  private keepVoucher(v: IssuedVoucher, r: HotelRestaurant): StoredVoucher {
    const stored: StoredVoucher = {
      code: v.code,
      restaurantId: r.id,
      restaurantName: v.restaurantName || r.name,
      discountPct: v.discountPct,
      conditions: v.conditions,
      guestName: v.guestName,
      validTo: v.validTo,
      status: 'ISSUED',
      redeemedAt: null,
    };
    this.vouchers = [stored, ...this.vouchers.filter((x) => x.code !== stored.code)];
    this.saveVouchers();
    this.ensureQr(stored.code);
    return stored;
  }

  // ---- reservar mesa (independiente del voucher) ----

  resFor: HotelRestaurant | null = null;
  resStep: 'when' | 'details' | 'done' | 'waitlist' | 'waitlisted' = 'when';
  party = 2;
  resDays: { value: string; weekday: string; num: number; month: string }[] = [];
  resDate = '';
  avail: Availability | null = null;
  loadingSlots = false;
  resTime = '';
  guestPhone = '';
  resNotes = '';
  // casilla "Quiero también mi descuento": opcional, la reserva se hace igual sin ella
  wantVoucher = true;
  resPending = false;
  resError = '';
  booked: BookingConfirmation | null = null;
  bookedVoucher: StoredVoucher | null = null;
  waitFrom = '';
  waitTo = '';

  openReserve(r: HotelRestaurant) {
    this.resFor = r;
    this.resStep = 'when';
    this.party = Math.min(2, r.maxParty || 2);
    this.resTime = '';
    this.resError = '';
    this.booked = null;
    this.bookedVoucher = null;
    this.guestPhone = store.get('hotel_guest_phone') ?? '';
    const base = new Date();
    this.resDays = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      return {
        value: toDayString(d),
        weekday: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', ''),
        num: d.getDate(),
        month: d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''),
      };
    });
    this.pickResDate(this.resDays[0].value);
  }

  closeReserve() {
    this.resFor = null;
  }

  setParty(n: number) {
    const max = this.resFor?.maxParty || 10;
    if (n < 1 || n > max) return;
    this.party = n;
    this.loadSlots();
  }

  pickResDate(day: string) {
    this.resDate = day;
    this.resTime = '';
    this.loadSlots();
  }

  private loadSlots() {
    const r = this.resFor;
    if (!r || !this.resDate) return;
    const asked = this.resDate;
    this.loadingSlots = true;
    this.resError = '';
    this.api.availability(this.slug, r.id, asked, this.party).subscribe({
      next: (a) => {
        if (asked !== this.resDate) return;
        this.avail = a;
        this.loadingSlots = false;
        if (this.resTime && !a.slots.some((s) => s.time === this.resTime && s.available)) this.resTime = '';
      },
      error: (err) => {
        this.loadingSlots = false;
        this.resError = apiMessage(err, 'No pudimos ver los horarios. Probá de nuevo.');
      },
    });
  }

  get closedText(): string {
    const c = this.avail?.closed;
    return c === 'PASADO' ? 'Ese día ya pasó.' : c === 'LEJOS' ? 'Todavía no se puede reservar para ese día.' : c === 'DIA_CERRADO' ? 'Ese día no atiende con reserva.' : '';
  }

  pickSlot(s: Slot) {
    if (s.available) this.resTime = s.time;
  }

  dayLabel(day: string): string {
    const t = parseDay(day).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  get phoneOk(): boolean {
    return this.guestPhone.replace(/\D/g, '').length >= 8;
  }

  // Con voucher hacen falta nombre y apellido y documento; sin voucher alcanza con un nombre
  get canReserve(): boolean {
    const base = this.guestName.trim().length >= 2 && this.phoneOk && this.accessCode.trim().length > 0 && !this.resPending;
    return base && (!this.wantVoucher || (this.nameOk && this.documentOk));
  }

  goDetails() {
    if (!this.resTime) return;
    this.resError = '';
    this.resStep = 'details';
  }

  backToWhen() {
    this.resError = '';
    this.resStep = 'when';
  }

  reserve() {
    const r = this.resFor;
    if (!r || !this.canReserve) return;
    this.resPending = true;
    this.resError = '';
    this.api
      .reserve(this.slug, {
        restaurantId: r.id,
        accessCode: this.accessCode.trim(),
        date: this.resDate,
        time: this.resTime,
        partySize: this.party,
        guestName: this.guestName.trim(),
        guestPhone: this.guestPhone.trim(),
        notes: this.resNotes.trim() || undefined,
        wantVoucher: this.wantVoucher,
        document: this.wantVoucher ? this.guestDocument.trim() : undefined,
      })
      .subscribe({
        next: (res) => {
          store.set('hotel_guest_name', this.guestName.trim());
          store.set('hotel_guest_phone', this.guestPhone.trim());
          store.set(`hotel_code_${this.slug}`, this.accessCode.trim());
          if (this.wantVoucher) store.set('hotel_guest_doc', this.guestDocument.trim());
          this.bookedVoucher = res.voucher ? this.keepVoucher(res.voucher, r) : null;
          this.booked = res.reservation;
          this.resPending = false;
          this.resStep = 'done';
        },
        error: (err) => {
          this.resPending = false;
          if (err?.status === 409) {
            // alguien tomó ese lugar mientras completaba los datos
            this.resStep = 'when';
            this.resTime = '';
            this.loadSlots();
            this.resError = 'Justo se ocupó ese horario. Elegí otro, por favor.';
            return;
          }
          this.resError =
            err?.status === 429
              ? 'Demasiados intentos. Esperá unos minutos.'
              : apiMessage(err, 'No se pudo reservar. Revisá tu conexión e intentá de nuevo.');
        },
      });
  }

  openWaitlist() {
    const times = this.avail?.slots.map((s) => s.time) ?? [];
    this.waitFrom = times[0] ?? '';
    this.waitTo = times[times.length - 1] ?? '';
    this.resError = '';
    this.resStep = 'waitlist';
  }

  get waitOptions(): string[] {
    return this.avail?.slots.map((s) => s.time) ?? [];
  }

  get canWait(): boolean {
    return this.guestName.trim().length >= 2 && this.phoneOk && this.accessCode.trim().length > 0 && !!this.waitFrom && this.waitFrom <= this.waitTo && !this.resPending;
  }

  joinWaitlist() {
    const r = this.resFor;
    if (!r || !this.canWait) return;
    this.resPending = true;
    this.resError = '';
    this.api
      .reserveWaitlist(this.slug, {
        restaurantId: r.id,
        accessCode: this.accessCode.trim(),
        date: this.resDate,
        fromTime: this.waitFrom,
        toTime: this.waitTo,
        partySize: this.party,
        guestName: this.guestName.trim(),
        guestPhone: this.guestPhone.trim(),
      })
      .subscribe({
        next: () => {
          store.set('hotel_guest_name', this.guestName.trim());
          store.set('hotel_guest_phone', this.guestPhone.trim());
          store.set(`hotel_code_${this.slug}`, this.accessCode.trim());
          this.resPending = false;
          this.resStep = 'waitlisted';
        },
        error: (err) => {
          this.resPending = false;
          this.resError = apiMessage(err, 'No pudimos anotarte. Probá de nuevo.');
        },
      });
  }

  // ---- copiar y compartir ----

  copiedCode: string | null = null;

  async copyCode(v: StoredVoucher) {
    try {
      await navigator.clipboard.writeText(v.code);
    } catch {
      // Navegadores sin portapapeles (o sin https): se copia con un campo temporal
      const el = document.createElement('textarea');
      el.value = v.code;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
      } catch {
        /* sin copia posible: el código sigue a la vista */
      }
      document.body.removeChild(el);
    }
    this.copiedCode = v.code;
    setTimeout(() => {
      if (this.copiedCode === v.code) this.copiedCode = null;
    }, 2000);
  }

  private voucherText(v: StoredVoucher): string {
    const days = this.daysLeft(v);
    return (
      `Mi voucher de ${this.info?.name ?? 'hotel'}\n` +
      `${v.restaurantName}: ${v.discountPct}% de descuento (válido solo en ese restaurante)\n` +
      `Código: ${v.code}\n` +
      `A nombre de ${v.guestName} · ${days > 1 ? 'vence en ' + days + ' días' : 'vence hoy'}`
    );
  }

  sharing = false;
  shareNote = '';

  // Manda el voucher como imagen (con el QR) por el menú de compartir del celular (WhatsApp, etc.).
  // Donde el navegador no puede compartir archivos (computadora), baja la imagen para adjuntarla a mano.
  async share(v: StoredVoucher) {
    if (this.sharing) return;
    this.sharing = true;
    this.shareNote = '';
    try {
      const blob = await this.voucherImage(v);
      const file = new File([blob], `voucher-${v.code}.png`, { type: 'image/png' });
      const nav: any = navigator;
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: this.voucherText(v) });
      } else {
        // Sin menú de compartir (computadora, o página sin https): se copia la imagen para pegarla
        // en el chat y se abre WhatsApp con el texto; si no se puede copiar, se baja la imagen.
        let copied = false;
        try {
          await nav.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          copied = true;
        } catch {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(this.voucherText(v))}`, '_blank', 'noopener');
        this.shareNote = copied
          ? 'Imagen copiada: elegí el chat en WhatsApp y pegala (Ctrl+V).'
          : 'Se guardó la imagen del voucher: adjuntala en el chat de WhatsApp.';
      }
    } catch (e: any) {
      // Cerrar el menú de compartir sin elegir nada no es un error
      if (e?.name !== 'AbortError') this.shareNote = 'No se pudo compartir. Probá con «Copiar código».';
    } finally {
      this.sharing = false;
    }
  }

  // Dibuja el voucher (restaurante, código, QR y datos) en una imagen lista para mandar
  private async voucherImage(v: StoredVoucher): Promise<Blob> {
    const qr = this.qrs[v.code] || (await QRCode.toDataURL(v.code, { width: 300, margin: 1, errorCorrectionLevel: 'M' }));
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = qr;
    });
    const W = 640, H = 960;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    const font = (w: number, s: number) => `${w} ${s}px Roboto, Arial, sans-serif`;
    const center = (t: string, y: number, f: string, color: string) => {
      g.font = f;
      g.fillStyle = color;
      g.textAlign = 'center';
      g.fillText(t, W / 2, y);
    };
    g.fillStyle = '#1d5b3e';
    g.fillRect(0, 0, W, H);
    center(`Beneficio para huéspedes de`, 70, font(400, 24), '#cfe6d9');
    center(this.info?.name ?? 'Hotel', 112, font(700, 40), '#ffffff');
    // tarjeta blanca
    g.fillStyle = '#ffffff';
    g.beginPath();
    if (g.roundRect) g.roundRect(40, 150, W - 80, H - 230, 28);
    else g.rect(40, 150, W - 80, H - 230); // celulares viejos: esquinas rectas
    g.fill();
    center(v.restaurantName, 215, font(700, 36), '#1b2822');
    center(`${v.discountPct}% de descuento`, 262, font(700, 30), '#1d5b3e');
    center(`Válido solo en ${v.restaurantName}`, 300, font(500, 22), '#5b6b63');
    center(v.code.split('').join(' '), 400, font(700, 64), '#1b2822');
    g.drawImage(img, (W - 340) / 2, 430, 340, 340);
    center(`A nombre de ${v.guestName}`, 820, font(500, 24), '#1b2822');
    const days = this.daysLeft(v);
    center(`1 voucher por mesa · ${days > 1 ? 'vence en ' + days + ' días' : 'vence hoy'}`, 856, font(400, 22), '#5b6b63');
    center('Mostralo al cajero al pagar · Tavolapp', H - 36, font(400, 20), '#cfe6d9');
    return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('sin imagen'))), 'image/png'));
  }

  // Ver el voucher que ya tiene desde la tarjeta del restaurante
  showVoucher(v: StoredVoucher) {
    const r = this.info?.restaurants.find((x) => x.id === v.restaurantId) ?? null;
    if (!r) return;
    this.ensureQr(v.code);
    this.dialogFor = r;
    this.error = '';
    this.reused = false;
    this.result = v;
  }

  // ---- estado de los vouchers (lo confirma el servidor) ----

  private refreshStatuses() {
    // Los canjeados y anulados ya no cambian: solo se consultan los que pueden cambiar
    const codes = this.vouchers.filter((v) => v.status === 'ISSUED').map((v) => v.code).slice(0, MAX_STATUS_CODES);
    this.activeVouchers.forEach((v) => this.ensureQr(v.code));
    if (!codes.length) return;
    this.api.statuses(this.slug, codes).subscribe({
      next: (list) => {
        let changed = false;
        for (const s of list) {
          const v = this.vouchers.find((x) => x.code === s.code);
          if (v && (v.status !== s.status || v.redeemedAt !== s.redeemedAt)) {
            v.status = s.status;
            v.redeemedAt = s.redeemedAt;
            changed = true;
          }
        }
        if (changed) this.saveVouchers();
      },
      error: () => {
        /* sin conexión: se muestra lo que hay guardado */
      },
    });
  }

  private ensureQr(code: string) {
    if (this.qrs[code]) return;
    QRCode.toDataURL(code, { width: 300, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => (this.qrs[code] = url))
      .catch(() => {});
  }

  // ---- guardado en este celular ----

  private key() {
    return `hotel_vouchers_${this.slug}`;
  }

  private readVouchers(): StoredVoucher[] {
    try {
      const list = JSON.parse(store.get(this.key()) ?? '[]');
      if (!Array.isArray(list)) return [];
      return list
        .filter((v) => v && typeof v.code === 'string' && v.restaurantId && v.validTo)
        .map((v) => ({
          code: v.code,
          restaurantId: v.restaurantId,
          restaurantName: v.restaurantName ?? '',
          discountPct: v.discountPct ?? 0,
          conditions: v.conditions ?? '',
          guestName: v.guestName ?? '',
          validTo: v.validTo,
          status: v.status ?? 'ISSUED',
          redeemedAt: v.redeemedAt ?? null,
        }));
    } catch {
      return [];
    }
  }

  private saveVouchers() {
    store.set(this.key(), JSON.stringify(this.vouchers.slice(0, MAX_STORED)));
  }
}
