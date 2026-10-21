import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Availability, BookingConfirmation } from './reservations.service';

// ---------- Huésped (pantalla pública del hotel, sin sesión) ----------

export interface HotelRestaurant {
  id: string;
  name: string;
  address: string;
  city: string;
  logoUrl: string | null;
  discountPct: number;
  conditions: string;
  // el restaurante recibe reservas: se ofrece "Reservar mesa"
  reservable: boolean;
  maxParty: number;
}

export interface HotelPublicInfo {
  name: string;
  slug: string;
  voucherValidDays: number;
  restaurants: HotelRestaurant[];
}

export interface IssuedVoucher {
  code: string;
  guestName: string;
  hotelName: string;
  restaurantName: string;
  discountPct: number;
  conditions: string;
  validTo: string;
  // true si el servidor devolvió el voucher que el huésped ya tenía vigente (en vez de crear otro)
  reused?: boolean;
}

export interface HotelReservationBody {
  restaurantId: string;
  accessCode: string;
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  guestPhone: string;
  notes?: string;
  wantVoucher?: boolean;
  document?: string;
}

export interface HotelReservationResult {
  reservation: BookingConfirmation;
  voucher: IssuedVoucher | null;
}

// Estado de un voucher que el huésped ya tiene (lo calcula el servidor; EXPIRED = sin usar y vencido)
export type VoucherStatusName = 'ISSUED' | 'REDEEMED' | 'CANCELLED' | 'EXPIRED';

export interface VoucherStatusInfo {
  code: string;
  status: VoucherStatusName;
  restaurantId: string;
  restaurantName: string;
  discountPct: number;
  conditions: string;
  validTo: string;
  redeemedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class HotelPublicService {
  private readonly base = `${environment.apiUrl}/public/hotel`;
  constructor(private http: HttpClient) {}

  info(slug: string): Observable<HotelPublicInfo> {
    return this.http.get<HotelPublicInfo>(`${this.base}/${encodeURIComponent(slug)}`);
  }

  issue(slug: string, body: { restaurantId: string; guestName: string; document: string; accessCode: string }): Observable<IssuedVoucher> {
    return this.http.post<IssuedVoucher>(`${this.base}/${encodeURIComponent(slug)}/vouchers`, body);
  }

  availability(slug: string, restaurantId: string, date: string, party: number): Observable<Availability> {
    return this.http.get<Availability>(`${this.base}/${encodeURIComponent(slug)}/reservations/availability`, {
      params: { restaurantId, date, party: String(party) },
    });
  }

  reserve(slug: string, body: HotelReservationBody): Observable<HotelReservationResult> {
    return this.http.post<HotelReservationResult>(`${this.base}/${encodeURIComponent(slug)}/reservations`, body);
  }

  reserveWaitlist(
    slug: string,
    body: { restaurantId: string; accessCode: string; date: string; fromTime: string; toTime: string; partySize: number; guestName: string; guestPhone: string },
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/${encodeURIComponent(slug)}/reservations/waitlist`, body);
  }

  // Estado de los vouchers que el celular ya tiene (por sus códigos)
  statuses(slug: string, codes: string[]): Observable<VoucherStatusInfo[]> {
    return this.http.post<VoucherStatusInfo[]>(`${this.base}/${encodeURIComponent(slug)}/vouchers/status`, { codes });
  }
}

// ---------- Restaurante ----------

export interface CheckedVoucher {
  code: string;
  hotelName: string;
  guestName: string;
  // Últimos caracteres del documento del huésped (null en vouchers anteriores a este dato)
  documentHint?: string | null;
  discountPct: number;
  validTo: string;
}

export interface Partnership {
  id: string;
  hotelName: string;
  discountPct: number;
  conditions: string;
  active: boolean;
}

// Mensaje de error del servidor listo para mostrar
export function apiMessage(error: any, fallback: string): string {
  const msg = error?.error?.message;
  return (Array.isArray(msg) ? msg.join('. ') : msg) || fallback;
}

@Injectable({ providedIn: 'root' })
export class HotelsService {
  private readonly api = environment.apiUrl;
  constructor(private http: HttpClient) {}

  // El cajero revisa un voucher antes de cobrar (no lo gasta)
  validate(code: string): Observable<CheckedVoucher> {
    return this.http.post<CheckedVoucher>(`${this.api}/hotels/vouchers/validate`, { code });
  }

  partnerships(): Observable<Partnership[]> {
    return this.http.get<Partnership[]>(`${this.api}/hotels/partnerships`);
  }

  updatePartnership(id: string, body: { discountPct?: number; conditions?: string; active?: boolean }): Observable<Partnership> {
    return this.http.patch<Partnership>(`${this.api}/hotels/partnerships/${id}`, body);
  }

}

// ---------- Portal del hotel (sesión propia, separada de la del personal de los restaurantes) ----------

export type VoucherView = 'ISSUED' | 'REDEEMED' | 'CANCELLED' | 'EXPIRED';

export interface HotelSummary {
  hotel: { name: string; slug: string; accessCode: string; voucherValidDays: number; active: boolean };
  totals: { issued: number; redeemed: number; cancelled: number; expired: number };
  byRestaurant: { name: string; issued: number; redeemed: number }[];
  recent: { id: string; guestName: string; restaurantName: string; status: VoucherView; createdAt: string; validTo: string; redeemedAt: string | null }[];
}

const HOTEL_TOKEN_KEY = 'hotel_token';
const HOTEL_USER_KEY = 'hotel_user';

@Injectable({ providedIn: 'root' })
export class HotelPortalService {
  private readonly base = `${environment.apiUrl}/hotel-portal`;
  constructor(private http: HttpClient) {}

  get token(): string | null {
    try {
      return localStorage.getItem(HOTEL_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  get hotelName(): string {
    try {
      return localStorage.getItem(HOTEL_USER_KEY) ?? '';
    } catch {
      return '';
    }
  }

  login(email: string, password: string): Observable<{ accessToken: string; user: { hotelName: string } }> {
    return this.http.post<{ accessToken: string; user: { hotelName: string } }>(`${this.base}/login`, { email, password }).pipe(
      tap((res) => {
        try {
          localStorage.setItem(HOTEL_TOKEN_KEY, res.accessToken);
          localStorage.setItem(HOTEL_USER_KEY, res.user.hotelName);
        } catch {}
      }),
    );
  }

  logout() {
    try {
      localStorage.removeItem(HOTEL_TOKEN_KEY);
      localStorage.removeItem(HOTEL_USER_KEY);
    } catch {}
  }

  private headers() {
    return { headers: { Authorization: `Bearer ${this.token ?? ''}` } };
  }

  summary(): Observable<HotelSummary> {
    return this.http.get<HotelSummary>(`${this.base}/summary`, this.headers());
  }

  setAccessCode(accessCode: string): Observable<{ accessCode: string }> {
    return this.http.patch<{ accessCode: string }>(`${this.base}/access-code`, { accessCode }, this.headers());
  }

  cancelVoucher(id: string): Observable<unknown> {
    return this.http.post(`${this.base}/vouchers/${id}/cancel`, {}, this.headers());
  }
}
