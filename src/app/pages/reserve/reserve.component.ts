import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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

const CLOSED_TEXT: Record<string, string> = {
  PASADO: 'Ese día ya pasó.',
  LEJOS: 'Todavía no se puede reservar para ese día.',
  DIA_CERRADO: 'Ese día no atendemos con reserva.',
};

// Página pública para reservar mesa (sin sesión): se comparte por WhatsApp o Instagram.
@Component({
  selector: 'app-reserve',
  templateUrl: './reserve.component.html',
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

  // lista de espera
  waitFrom = '';
  waitTo = '';

  done: BookingConfirmation | null = null;

  // cancelar con código
  cancelCode = '';
  cancelPhone = '';
  cancelMsg = '';

  constructor(private route: ActivatedRoute, private api: ReservePublicService) {}

  ngOnInit() {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
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

  cancel() {
    const code = this.cancelCode.trim().toUpperCase();
    if (!code || this.cancelPhone.replace(/\D/g, '').length < 6 || this.sending) return;
    this.sending = true;
    this.error = '';
    this.api.cancel(this.slug, code, this.cancelPhone.trim()).subscribe({
      next: () => {
        this.sending = false;
        this.cancelMsg = 'Listo, cancelamos tu reserva.';
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
