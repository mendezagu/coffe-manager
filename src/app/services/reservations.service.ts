import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'ARRIVED' | 'NO_SHOW' | 'CANCELLED';
export type ReservationSource = 'WEB' | 'MANUAL' | 'HOTEL';
export type WaitlistStatus = 'WAITING' | 'CONTACTED' | 'BOOKED' | 'CANCELLED';

// ---------- Lado del restaurante ----------

export interface Reservation {
  id: string;
  code: string;
  date: string;
  time: string; // "HH:MM"
  startMin: number;
  partySize: number;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  notes: string;
  status: ReservationStatus;
  source: ReservationSource;
  tableId: string | null;
  tableName: string | null;
  hotelId: string | null;
  voucherId: string | null;
}

export interface WaitlistItem {
  id: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  from: string;
  to: string;
  status: WaitlistStatus;
  hasRoom: boolean;
}

export interface ReservationsDay {
  date: string;
  summary: { reservations: number; guests: number; arrived: number; capacity: number };
  reservations: Reservation[];
  waitlist: WaitlistItem[];
}

export interface NewReservation {
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  guestPhone: string;
  notes?: string;
  force?: boolean;
}

// ---------- Página pública (sin sesión) ----------

export interface ReserveInfo {
  name: string;
  address: string;
  city: string;
  phone: string;
  logoUrl: string | null;
  brandColor?: string;
  slotMin: number;
  durationMin: number;
  maxParty: number;
  advanceDays: number;
  days: number[];
  open: string;
  close: string;
}

export interface Slot {
  time: string;
  available: boolean;
  reason?: 'LLENO' | 'ANTICIPACION';
}

export interface Availability {
  date: string;
  closed: 'PASADO' | 'LEJOS' | 'DIA_CERRADO' | null;
  slots: Slot[];
  // todo el día está lleno: se ofrece la lista de espera
  full: boolean;
}

export interface BookingConfirmation {
  code: string;
  restaurantName: string;
  address: string;
  phone: string;
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  status: ReservationStatus;
}

export interface PublicBooking {
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  notes?: string;
}

export interface PublicWaitlist {
  date: string;
  fromTime: string;
  toTime: string;
  partySize: number;
  guestName: string;
  guestPhone: string;
}

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  ARRIVED: 'Llegó',
  NO_SHOW: 'No vino',
  CANCELLED: 'Cancelada',
};

// "2026-10-11" → Date en hora local del navegador (sin que la zona horaria lo corra un día)
export const parseDay = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const toDayString = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const minToTime = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

@Injectable({ providedIn: 'root' })
export class ReservationsService {
  private readonly url = `${environment.apiUrl}/reservations`;

  constructor(private http: HttpClient) {}

  day(date: string): Observable<ReservationsDay> {
    return this.http.get<ReservationsDay>(this.url, { params: new HttpParams().set('date', date) });
  }

  create(body: NewReservation): Observable<Reservation> {
    return this.http.post<Reservation>(this.url, body);
  }

  update(
    id: string,
    patch: { status?: ReservationStatus; tableId?: string | null; notes?: string; date?: string; time?: string; partySize?: number; force?: boolean },
  ): Observable<Reservation> {
    return this.http.patch<Reservation>(`${this.url}/${id}`, patch);
  }

  updateWaitlist(id: string, status: WaitlistStatus): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.url}/waitlist/${id}`, { status });
  }

  bookFromWaitlist(id: string, time: string): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.url}/waitlist/${id}/book`, { time });
  }
}

@Injectable({ providedIn: 'root' })
export class ReservePublicService {
  private readonly url = `${environment.apiUrl}/public/reservas`;

  constructor(private http: HttpClient) {}

  info(slug: string): Observable<ReserveInfo> {
    return this.http.get<ReserveInfo>(`${this.url}/${slug}`);
  }

  availability(slug: string, date: string, party: number): Observable<Availability> {
    return this.http.get<Availability>(`${this.url}/${slug}/availability`, {
      params: new HttpParams().set('date', date).set('party', String(party)),
    });
  }

  book(slug: string, body: PublicBooking): Observable<BookingConfirmation> {
    return this.http.post<BookingConfirmation>(`${this.url}/${slug}/reservations`, body);
  }

  cancel(slug: string, code: string, phone: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.url}/${slug}/reservations/cancel`, { code, phone });
  }

  waitlist(slug: string, body: PublicWaitlist): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.url}/${slug}/waitlist`, body);
  }
}
