import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { brandStyle } from 'src/app/services/brand';
import { coverVeil } from 'src/app/utils/brand-intensity';
import {
  Availability,
  BookingConfirmation,
  ReserveInfo,
  ReservePublicService,
  Slot,
  parseDay,
  toDayString,
} from 'src/app/services/reservations.service';

type Step = 'when' | 'details' | 'done' | 'waitlist' | 'waitlisted' | 'cancel';

// Reserva guardada en este dispositivo (para que el cliente pueda volver a verla, bajarla o cancelarla)
interface SavedBooking {
  code: string;
  phone: string;
  guestName: string;
  date: string;
  time: string;
  partySize: number;
  address: string;
}

const CLOSED_TEXT: Record<string, string> = {
  PASADO: 'Ese día ya pasó.',
  LEJOS: 'Todavía no se puede reservar para ese día.',
  DIA_CERRADO: 'Ese día no atendemos con reserva.',
};

// Página pública para reservar mesa (sin sesión): se comparte por WhatsApp o Instagram.
@Component({
  selector: 'app-reserve',
  templateUrl: './reserve.component.html',
  styles: [
    `
      /* Apariencia oscura (la que el local eligió para su carta): las superficies y la tinta salen de variables */
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
    `,
  ],
})
export class ReserveComponent implements OnInit {
  slug = '';
  info: ReserveInfo | null = null;
  notFound = false;
  loading = true;

  step: Step = 'when';
  party = 2;
  days: { value: string; weekday: string; num: number; month: string; closed: boolean }[] = [];
  date = '';
  avail: Availability | null = null;
  loadingSlots = false;
  time = '';

  name = '';
  phone = '';
  email = '';
  notes = '';
  sending = false;
  error = '';

  // Portada del local (si la cargó): la misma que ve en su carta y su tienda
  get coverStyle(): Record<string, string> {
    const url = this.info?.coverUrl;
    return url
      ? {
          'background-image': `${coverVeil(this.info?.coverIntensity)}, url("${url.replace(/"/g, '%22')}")`,
          'background-size': 'cover',
          'background-position': 'center',
        }
      : {};
  }

  // Teléfono del local solo con números, para el enlace de WhatsApp
  get whatsappDigits(): string {
    return (this.info?.phone ?? '').replace(/\D/g, '');
  }

  // lista de espera
  waitFrom = '';
  waitTo = '';

  done: BookingConfirmation | null = null;

  // cancelar con código
  cancelCode = '';
  cancelPhone = '';
  cancelMsg = '';

  constructor(private route: ActivatedRoute, private api: ReservePublicService) {}

  // ¿El local eligió la apariencia oscura para su carta y sus páginas públicas?
  get dark(): boolean {
    return this.info?.menuTheme === 'dark';
  }

  // Variables CSS con el color de marca del restaurante (el token `forest` las lee)
  get brandStyle(): string {
    return brandStyle(this.info?.brandColor, this.dark);
  }

  ngOnInit() {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.loadSaved();
    this.api.info(this.slug).subscribe({
      next: (info) => {
        this.info = info;
        this.party = Math.min(2, info.maxParty);
        this.buildDays();
        const first = this.days.find((d) => !d.closed);
        if (first) this.pickDate(first.value);
        this.loading = false;
      },
      error: () => {
        this.notFound = true;
        this.loading = false;
      },
    });
  }

  private buildDays() {
    const info = this.info!;
    const out: typeof this.days = [];
    const base = new Date();
    for (let i = 0; i <= Math.min(info.advanceDays, 60); i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      out.push({
        value: toDayString(d),
        weekday: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', ''),
        num: d.getDate(),
        month: d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''),
        closed: !info.days.includes(d.getDay()),
      });
    }
    this.days = out;
  }

  get partyOptions(): number[] {
    return Array.from({ length: this.info?.maxParty ?? 0 }, (_, i) => i + 1);
  }

  setParty(n: number) {
    if (n < 1 || n > (this.info?.maxParty ?? 1)) return;
    this.party = n;
    if (this.date) this.loadSlots();
  }

  pickDate(day: string) {
    this.date = day;
    this.time = '';
    this.period = ''; // al cambiar de día vuelve a abrirse el primer momento con lugar
    this.loadSlots();
  }

  private loadSlots() {
    this.loadingSlots = true;
    this.error = '';
    const asked = this.date;
    this.api.availability(this.slug, this.date, this.party).subscribe({
      next: (a) => {
        if (asked !== this.date) return;
        this.avail = a;
        this.loadingSlots = false;
        if (this.time && !a.slots.some((s) => s.time === this.time && s.available)) this.time = '';
      },
      error: () => {
        this.loadingSlots = false;
        this.error = 'No pudimos ver los horarios. Probá de nuevo.';
      },
    });
  }

  // Los horarios que ya pasaron o no dan el tiempo mínimo no se muestran (eran un muro de tachados);
  // los que están llenos sí, para que se vea que ese horario existe pero no hay lugar. Agrupados por momento del día.
  get slotGroups(): { label: string; icon: string; slots: Slot[] }[] {
    const defs = [
      { label: 'Almuerzo', icon: 'wb_sunny', from: 0, to: 16 },
      { label: 'Tarde', icon: 'local_cafe', from: 16, to: 20 },
      { label: 'Cena', icon: 'dark_mode', from: 20, to: 48 },
    ];
    const shown = (this.avail?.slots ?? []).filter((s) => s.reason !== 'ANTICIPACION');
    return defs
      .map((g) => ({ label: g.label, icon: g.icon, slots: shown.filter((s) => Number(s.time.slice(0, 2)) >= g.from && Number(s.time.slice(0, 2)) < g.to) }))
      .filter((g) => g.slots.length);
  }

  // Momento del día elegido (Almuerzo, Tarde o Cena): se muestra uno solo a la vez para no llenar la pantalla de horarios
  period = '';

  get activeGroup(): { label: string; icon: string; slots: Slot[] } | null {
    const groups = this.slotGroups;
    return groups.find((g) => g.label === this.period) ?? groups.find((g) => g.slots.some((s) => s.available)) ?? groups[0] ?? null;
  }

  availableIn(g: { slots: Slot[] }): number {
    return g.slots.filter((s) => s.available).length;
  }

  pickPeriod(label: string) {
    this.period = label;
  }

  get tooLate(): boolean {
    return !!this.avail && !this.avail.closed && this.slotGroups.length === 0;
  }

  get closedText(): string {
    return this.avail?.closed ? CLOSED_TEXT[this.avail.closed] : '';
  }

  get dateLabel(): string {
    return this.label(this.date);
  }

  label(day: string): string {
    if (!day) return '';
    const t = parseDay(day).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  // ---- Descargar la reserva como imagen (para guardarla en el celular o mandarla por WhatsApp) ----

  downloading = false;

  async downloadTicket(): Promise<void> {
    const d = this.done;
    if (!d || !this.info || this.downloading) return;
    this.downloading = true;
    try {
      // las fuentes de la página tienen que estar cargadas antes de dibujar en el canvas
      try {
        await Promise.all([document.fonts.load('600 64px "Playfair Display"'), document.fonts.load('italic 400 30px "Playfair Display"'), document.fonts.load('700 34px Inter')]);
      } catch {
        /* sin fuentes propias se usan las del sistema */
      }
      const logo = await this.loadLogo();
      const blob = await this.drawTicket(d, logo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reserva-${this.info.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${d.code}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      this.downloading = false;
    }
  }

  // Logo del local para el comprobante; si no tiene o no se puede leer (otro origen sin permiso), el comprobante sale sin logo
  private loadLogo(): Promise<HTMLImageElement | null> {
    const url = this.info?.logoUrl;
    if (!url) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  private drawTicket(d: BookingConfirmation, logo: HTMLImageElement | null = null): Promise<Blob> {
    const W = 900;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new Error('No se pudo preparar la imagen'));
    const brand = /^#[0-9a-f]{6}$/i.test(this.info?.brandColor ?? '') ? (this.info!.brandColor as string) : '#0b7d66';
    const serif = '"Playfair Display", Georgia, serif';
    const sans = 'Inter, system-ui, sans-serif';

    const round = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    const wrap = (text: string, maxWidth: number): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = w;
        } else line = test;
      }
      if (line) lines.push(line);
      return lines;
    };

    // datos de la tarjeta; se miden antes de dibujar para que el alto se ajuste a lo que haya (por ejemplo, una dirección larga)
    const rows: [string, string][] = [
      ['Nombre', d.guestName],
      ['Día', this.label(d.date)],
      ['Hora', d.time],
      ['Personas', String(d.partySize)],
    ];
    if (d.address) rows.push(['Dirección', d.address]);
    ctx.font = `700 34px ${sans}`;
    const measured = rows.map(([label, value]) => ({ label, lines: wrap(value, 470) }));
    const top = logo ? 130 : 0; // lugar extra arriba para el logo
    let yEnd = 480 + top;
    for (const r of measured) yEnd += Math.max(1, r.lines.length) * 44 + 34;
    const cy = yEnd + 20;
    const H = cy + 236 + 150;
    canvas.height = H; // cambiar el alto reinicia el lienzo: todo se dibuja después

    // fondo y tarjeta
    ctx.fillStyle = '#f1f3f6';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.shadowColor = 'rgba(30,40,60,.16)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 14;
    round(60, 60, W - 120, H - 120, 44);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // franja con la marca del local
    ctx.save();
    round(60, 60, W - 120, H - 120, 44);
    ctx.clip();
    ctx.fillStyle = brand;
    ctx.fillRect(60, 60, W - 120, 330 + top);
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 3;
    for (const r of [150, 220, 290]) {
      ctx.beginPath();
      ctx.arc(W - 90, 90, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    if (logo) {
      const r = 52;
      const cx = 120 + r;
      const cy0 = 96 + r;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy0, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy0, r, 0, Math.PI * 2);
      ctx.clip();
      // el logo llena el círculo sin deformarse (se recorta lo que sobre)
      const k = Math.max((r * 2) / logo.width, (r * 2) / logo.height);
      const w = logo.width * k;
      const h = logo.height * k;
      ctx.drawImage(logo, cx - w / 2, cy0 - h / 2, w, h);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.font = `600 26px ${sans}`;
    (ctx as any).letterSpacing = '4px';
    ctx.fillText('RESERVA CONFIRMADA', 120, 142 + top);
    (ctx as any).letterSpacing = '0px';
    ctx.fillStyle = '#ffffff';
    let size = 74;
    ctx.font = `600 ${size}px ${serif}`;
    while (ctx.measureText(this.info!.name).width > W - 240 && size > 40) {
      size -= 4;
      ctx.font = `600 ${size}px ${serif}`;
    }
    ctx.fillText(this.info!.name, 120, 250 + top);
    if (this.info!.city) {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.font = `italic 400 34px ${serif}`;
      ctx.fillText(this.info!.city, 120, 310 + top);
    }

    // datos
    let y = 480 + top;
    for (const { label, lines } of measured) {
      ctx.fillStyle = '#6b7280';
      ctx.font = `500 30px ${sans}`;
      ctx.textAlign = 'left';
      ctx.fillText(label, 120, y);
      ctx.fillStyle = '#111827';
      ctx.font = `700 34px ${sans}`;
      ctx.textAlign = 'right';
      lines.forEach((l, i) => ctx.fillText(l, W - 120, y + i * 44));
      y += Math.max(1, lines.length) * 44 + 34;
      ctx.strokeStyle = '#eceff3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(120, y - 40);
      ctx.lineTo(W - 120, y - 40);
      ctx.stroke();
    }

    // código, separado por una línea punteada como un ticket
    ctx.setLineDash([14, 12]);
    ctx.strokeStyle = '#cfd5dd';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(100, cy);
    ctx.lineTo(W - 100, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6b7280';
    ctx.font = `500 28px ${sans}`;
    ctx.fillText('Tu código', W / 2, cy + 64);
    ctx.fillStyle = '#111827';
    ctx.font = `700 92px "SFMono-Regular", Consolas, "Courier New", monospace`;
    (ctx as any).letterSpacing = '14px';
    ctx.fillText(d.code, W / 2 + 7, cy + 170);
    (ctx as any).letterSpacing = '0px';
    ctx.fillStyle = '#6b7280';
    ctx.font = `400 26px ${sans}`;
    ctx.fillText('Guardalo: lo necesitás para cancelar.', W / 2, cy + 236);
    ctx.fillStyle = '#9aa1ab';
    ctx.font = `600 24px ${sans}`;
    ctx.fillText('Reservas con Tavolapp', W / 2, H - 96);

    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'));
  }

  pickSlot(s: Slot) {
    if (!s.available) return;
    this.time = s.time;
  }

  next() {
    if (!this.time) return;
    this.error = '';
    this.step = 'details';
  }

  get detailsValid(): boolean {
    return this.name.trim().length >= 2 && this.phone.replace(/\D/g, '').length >= 8;
  }

  book() {
    if (!this.detailsValid || this.sending) return;
    this.sending = true;
    this.error = '';
    this.api
      .book(this.slug, {
        date: this.date,
        time: this.time,
        partySize: this.party,
        guestName: this.name.trim(),
        guestPhone: this.phone.trim(),
        guestEmail: this.email.trim() || undefined,
        notes: this.notes.trim() || undefined,
      })
      .subscribe({
        next: (c) => {
          this.sending = false;
          this.done = c;
          this.saveBooking(c, this.phone.trim());
          this.step = 'done';
          window.scrollTo({ top: 0 });
        },
        error: (err) => {
          this.sending = false;
          if (err?.status === 409) {
            // alguien tomó ese lugar mientras completaba los datos
            this.step = 'when';
            this.time = '';
            this.loadSlots();
            this.error = 'Justo se ocupó ese horario. Elegí otro, por favor.';
            return;
          }
          this.error = this.messageOf(err, 'No pudimos guardar la reserva. Probá de nuevo.');
        },
      });
  }

  // ---------- Lista de espera ----------

  openWaitlist() {
    this.waitFrom = this.info?.open ?? '';
    this.waitTo = this.info?.close ?? '';
    this.error = '';
    this.step = 'waitlist';
  }

  get waitOptions(): string[] {
    return this.avail?.slots.map((s) => s.time) ?? [];
  }

  get waitValid(): boolean {
    return this.detailsValid && !!this.waitFrom && !!this.waitTo && this.waitFrom <= this.waitTo;
  }

  joinWaitlist() {
    if (!this.waitValid || this.sending) return;
    this.sending = true;
    this.error = '';
    this.api
      .waitlist(this.slug, {
        date: this.date,
        fromTime: this.waitFrom,
        toTime: this.waitTo,
        partySize: this.party,
        guestName: this.name.trim(),
        guestPhone: this.phone.trim(),
      })
      .subscribe({
        next: () => {
          this.sending = false;
          this.step = 'waitlisted';
          window.scrollTo({ top: 0 });
        },
        error: (err) => {
          this.sending = false;
          this.error = this.messageOf(err, 'No pudimos anotarte. Probá de nuevo.');
        },
      });
  }

  // ---------- Cancelar ----------

  openCancel() {
    this.cancelMsg = '';
    this.error = '';
    this.step = 'cancel';
  }

  // ---- Mis reservas (guardadas en este dispositivo) ----

  saved: SavedBooking[] = [];

  private get storageKey(): string {
    return `reservas:${this.slug}`;
  }

  // Solo se muestran las de hoy en adelante: las que ya pasaron se descartan solas
  private loadSaved() {
    try {
      const raw = JSON.parse(localStorage.getItem(this.storageKey) ?? '[]') as SavedBooking[];
      const today = toDayString(new Date());
      this.saved = (Array.isArray(raw) ? raw : []).filter((r) => r && r.code && r.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      this.persistSaved();
    } catch {
      this.saved = [];
    }
  }

  private persistSaved() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.saved));
    } catch {
      /* sin almacenamiento (modo privado): las reservas igual quedan hechas, solo no se recuerdan */
    }
  }

  private saveBooking(c: BookingConfirmation, phone: string) {
    this.saved = [...this.saved.filter((r) => r.code !== c.code), { code: c.code, phone, guestName: c.guestName, date: c.date, time: c.time, partySize: c.partySize, address: c.address }].sort((a, b) =>
      (a.date + a.time).localeCompare(b.date + b.time),
    );
    this.persistSaved();
  }

  private removeSaved(code: string) {
    this.saved = this.saved.filter((r) => r.code !== code);
    this.persistSaved();
  }

  // Abre una reserva guardada en la misma pantalla de confirmación (desde ahí se baja o se cancela)
  openSaved(r: SavedBooking) {
    this.done = { code: r.code, restaurantName: this.info?.name ?? '', address: r.address, phone: this.info?.phone ?? '', date: r.date, time: r.time, partySize: r.partySize, guestName: r.guestName, status: 'CONFIRMED' };
    this.step = 'done';
    window.scrollTo({ top: 0 });
  }

  // Cancelar con el código y el teléfono ya cargados
  cancelThis(code: string) {
    const r = this.saved.find((x) => x.code === code);
    this.cancelCode = code;
    this.cancelPhone = r?.phone ?? '';
    this.cancelMsg = '';
    this.error = '';
    this.step = 'cancel';
  }

  cancel() {
    const code = this.cancelCode.trim().toUpperCase();
    if (!code || this.cancelPhone.replace(/\D/g, '').length < 6 || this.sending) return;
    this.sending = true;
    this.error = '';
    this.api.cancel(this.slug, code, this.cancelPhone.trim()).subscribe({
      next: () => {
        this.sending = false;
        this.cancelMsg = 'Listo, cancelamos tu reserva.';
        this.removeSaved(code);
      },
      error: (err) => {
        this.sending = false;
        this.error = this.messageOf(err, 'No encontramos esa reserva. Revisá el código y el teléfono.');
      },
    });
  }

  back() {
    this.error = '';
    this.step = 'when';
  }

  reset() {
    this.done = null;
    this.time = '';
    this.notes = '';
    this.error = '';
    this.step = 'when';
    this.loadSlots();
  }

  private messageOf(err: any, fallback: string): string {
    const m = err?.error?.message;
    return Array.isArray(m) ? m.join('. ') : typeof m === 'string' ? m : fallback;
  }
}
