import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription, timer } from 'rxjs';
import { GestionService, Table } from 'src/app/services/gestionService';
import {
  NewReservation,
  Reservation,
  ReservationsDay,
  ReservationsService,
  STATUS_LABELS,
  WaitlistItem,
  minToTime,
  parseDay,
  toDayString,
} from 'src/app/services/reservations.service';
import { SettingsService } from 'src/app/services/settings.service';

const REFRESH_MS = 30000;

// Pantalla "Reservas" del restaurante: las del día, la lista de espera y la carga de reservas por teléfono o WhatsApp.
@Component({
  selector: 'app-reservations',
  templateUrl: './reservations.component.html',
})
export class ReservationsComponent implements OnInit, OnDestroy {
  readonly statusLabels = STATUS_LABELS;

  day = toDayString(new Date());
  data: ReservationsDay | null = null;
  loading = true;
  error = '';
  tables: Table[] = [];
  private refresh?: Subscription;

  // Nueva reserva (por teléfono, WhatsApp o en persona)
  formOpen = false;
  saving = false;
  formError = '';
  needsForce = false;
  form = this.emptyForm();

  // "Llegó": a qué mesa se sienta (la reserva que está eligiendo mesa)
  seating: string | null = null;
  seatTableId = '';

  // Lista de espera: horario elegido para cada persona
  waitTime: Record<string, string> = {};

  busy = new Set<string>();

  constructor(
    private api: ReservationsService,
    public settings: SettingsService,
    private gestion: GestionService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.load();
    this.gestion.getTables().subscribe({ next: (t) => (this.tables = t), error: () => {} });
    // se actualiza sola: otra persona del equipo puede estar cargando reservas, o llegar una desde la web
    this.refresh = timer(REFRESH_MS, REFRESH_MS).subscribe(() => this.load(true));
  }

  ngOnDestroy() {
    this.refresh?.unsubscribe();
  }

  // ---------- Fecha ----------

  get dayLabel(): string {
    const label = parseDay(this.day).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  get isToday(): boolean {
    return this.day === toDayString(new Date());
  }

  get isTomorrow(): boolean {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return this.day === toDayString(t);
  }

  shift(days: number) {
    const d = parseDay(this.day);
    d.setDate(d.getDate() + days);
    this.setDay(toDayString(d));
  }

  setDay(day: string) {
    if (!day || day === this.day) return;
    this.day = day;
    this.seating = null;
    this.load();
  }

  today() {
    this.setDay(toDayString(new Date()));
  }

  tomorrow() {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    this.setDay(toDayString(t));
  }

  // ---------- Datos ----------

  load(silent = false) {
    if (!silent) this.loading = true;
    this.api.day(this.day).subscribe({
      next: (d) => {
        this.data = d;
        this.loading = false;
        this.error = '';
      },
      error: (err) => {
        this.loading = false;
        if (!silent) this.error = err?.error?.message || 'No se pudieron cargar las reservas';
      },
    });
  }

  get live(): Reservation[] {
    return (this.data?.reservations ?? []).filter((r) => r.status !== 'CANCELLED');
  }

  get cancelled(): Reservation[] {
    return (this.data?.reservations ?? []).filter((r) => r.status === 'CANCELLED');
  }

  // ---------- Acciones sobre una reserva ----------

  setStatus(r: Reservation, status: Reservation['status'], extra: { tableId?: string | null } = {}) {
    if (this.busy.has(r.id)) return;
    if (status === 'CANCELLED' && !confirm(`¿Cancelar la reserva de ${r.guestName}?`)) return;
    this.busy.add(r.id);
    this.api.update(r.id, { status, ...extra }).subscribe({
      next: () => {
        this.busy.delete(r.id);
        this.seating = null;
        this.load(true);
      },
      error: (err) => {
        this.busy.delete(r.id);
        this.notify(err?.error?.message || 'No se pudo actualizar la reserva');
      },
    });
  }

  startSeating(r: Reservation) {
    this.seating = r.id;
    this.seatTableId = r.tableId ?? '';
  }

  confirmSeating(r: Reservation) {
    this.setStatus(r, 'ARRIVED', { tableId: this.seatTableId || null });
  }

  whatsapp(phone: string, text: string): string {
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  get shareLink(): string | null {
    const slug = this.settings.value.reservationSlug;
    return slug ? `${window.location.origin}/reservar/${slug}` : null;
  }

  copyLink() {
    const link = this.shareLink;
    if (!link) return;
    navigator.clipboard?.writeText(link).then(
      () => this.notify('Dirección copiada'),
      () => this.notify('No se pudo copiar'),
    );
  }

  // ---------- Nueva reserva ----------

  private emptyForm(): NewReservation & { guestPhone: string } {
    return { date: toDayString(new Date()), time: '', partySize: 2, guestName: '', guestPhone: '', notes: '' };
  }

  // los horarios que se ofrecen en la web, para elegir uno (el personal también puede escribir otro con "Otro horario")
  get timeOptions(): string[] {
    const s = this.settings.value;
    const out: string[] = [];
    for (let m = s.reservationOpenMin; m <= s.reservationCloseMin; m += s.reservationSlotMin) out.push(minToTime(m));
    return out;
  }

  openForm() {
    this.form = { ...this.emptyForm(), date: this.day, time: this.timeOptions.find((t) => t >= '20:00') ?? this.timeOptions[0] ?? '' };
    this.formError = '';
    this.needsForce = false;
    this.formOpen = true;
  }

  get formValid(): boolean {
    const f = this.form;
    return !!f.date && !!f.time && f.partySize >= 1 && f.guestName.trim().length >= 2 && f.guestPhone.replace(/\D/g, '').length >= 8;
  }

  save(force = false) {
    if (!this.formValid || this.saving) return;
    this.saving = true;
    this.formError = '';
    this.api.create({ ...this.form, partySize: Number(this.form.partySize), force }).subscribe({
      next: (r) => {
        this.saving = false;
        this.formOpen = false;
        this.notify(`Reserva de ${r.guestName} cargada`);
        if (r.date !== this.day) this.setDay(r.date);
        else this.load(true);
      },
      error: (err) => {
        this.saving = false;
        this.needsForce = err?.status === 409;
        const msg = err?.error?.message;
        this.formError = Array.isArray(msg) ? msg.join('. ') : msg || 'No se pudo cargar la reserva';
      },
    });
  }

  // ---------- Lista de espera ----------

  waitOptions(w: WaitlistItem): string[] {
    return this.timeOptions.filter((t) => t >= w.from && t <= w.to);
  }

  waitMessage(w: WaitlistItem): string {
    const t = this.waitTime[w.id] || this.waitOptions(w)[0] || w.from;
    return `Hola ${w.guestName}! Te escribimos de ${this.settings.value.name}: se liberó un lugar para ${w.partySize} ${w.partySize === 1 ? 'persona' : 'personas'} el ${this.dayLabel.toLowerCase()} a las ${t}. ¿Querés que te lo reservemos?`;
  }

  contacted(w: WaitlistItem) {
    this.api.updateWaitlist(w.id, 'CONTACTED').subscribe({ next: () => this.load(true), error: () => {} });
  }

  bookWaiting(w: WaitlistItem) {
    const time = this.waitTime[w.id] || this.waitOptions(w)[0];
    if (!time || this.busy.has(w.id)) return;
    this.busy.add(w.id);
    this.api.bookFromWaitlist(w.id, time).subscribe({
      next: (r) => {
        this.busy.delete(w.id);
        this.notify(`Reservado: ${r.guestName} a las ${r.time}`);
        this.load(true);
      },
      error: (err) => {
        this.busy.delete(w.id);
        this.notify(err?.error?.message || 'No se pudo reservar');
      },
    });
  }

  removeWaiting(w: WaitlistItem) {
    if (!confirm(`¿Sacar a ${w.guestName} de la lista de espera?`)) return;
    this.api.updateWaitlist(w.id, 'CANCELLED').subscribe({ next: () => this.load(true), error: () => {} });
  }

  // ---------- Utilidades ----------

  trackId(_i: number, r: { id: string }) {
    return r.id;
  }

  private notify(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 3500 });
  }
}
