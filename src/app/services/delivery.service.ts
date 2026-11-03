import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { PublicInfo, QrLine, QrService, SendLine } from './qr.service';
import { RealtimeService } from './realtime.service';

// ---------- Tienda online: lo que ve el cliente ----------

export type DeliveryMode = 'pickup' | 'delivery';
export type DeliveryPay = 'cash' | 'transfer';
export type DeliveryStatus = 'PENDING' | 'ACCEPTED' | 'READY' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';

export interface StoreConfig {
  paused: boolean;
  pickup: boolean;
  home: boolean;
  fee: number;
  payCash: boolean;
  payTransfer: boolean;
  bankInfo: string;
  prepMin: number;
  whatsapp: string;
  whatsappOnly: boolean;
}

// La misma forma que la carta del QR (para reusar la pantalla), más la configuración de la tienda
export type StoreInfo = PublicInfo & { store: StoreConfig; business: PublicInfo['business'] & { address?: string; phone?: string } };

export interface StoreOrderBody {
  clientId: string;
  customerName: string;
  phone: string;
  mode: DeliveryMode;
  address?: string;
  payMethod: DeliveryPay;
  note?: string;
  items: SendLine[];
}

// El pedido tal cual lo calculó el servidor
export interface StoreOrderView {
  number: number | null;
  token: string | null;
  status: DeliveryStatus;
  rejectReason: string;
  createdAt: string;
  customerName: string;
  phone: string;
  mode: DeliveryMode;
  address: string;
  payMethod: DeliveryPay;
  note: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  prepMin: number;
  bankInfo: string;
  items: QrLine[];
}

@Injectable({ providedIn: 'root' })
export class DeliveryPublicService {
  private readonly baseUrl = `${environment.apiUrl}/public/delivery`;

  constructor(private http: HttpClient) {}

  info(slug: string): Observable<StoreInfo> {
    return this.http.get<any>(`${this.baseUrl}/${encodeURIComponent(slug)}`).pipe(
      // Se adapta a la forma de la carta del QR para usar la misma pantalla
      map(
        (r): StoreInfo => ({
          business: r.business,
          table: { name: '' },
          requiresPin: false,
          autoConfirm: false,
          kitchen: false,
          limits: { maxPending: 0, minSecondsBetweenSends: 0 },
          pinOk: true,
          menu: r.menu,
          store: r.store,
        }),
      ),
    );
  }

  create(slug: string, body: StoreOrderBody): Observable<{ stored: boolean; order: StoreOrderView }> {
    return this.http.post<{ stored: boolean; order: StoreOrderView }>(`${this.baseUrl}/${encodeURIComponent(slug)}/orders`, body);
  }

  track(slug: string, token: string): Observable<StoreOrderView> {
    return this.http.get<StoreOrderView>(`${this.baseUrl}/${encodeURIComponent(slug)}/orders/${encodeURIComponent(token)}`);
  }

  cancel(slug: string, token: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/${encodeURIComponent(slug)}/orders/${encodeURIComponent(token)}/cancel`, {});
  }
}

// ---------- Tienda online: bandeja del local ----------

export interface DeliveryOrder {
  id: string;
  number: number;
  status: DeliveryStatus;
  createdAt: string;
  customerName: string;
  phone: string;
  mode: DeliveryMode;
  address: string;
  payMethod: DeliveryPay;
  note: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  rejectReason: string;
  items: QrLine[];
}

export interface DeliveryInbox {
  active: boolean;
  orders: DeliveryOrder[];
}

const EMPTY: DeliveryInbox = { active: false, orders: [] };
const POLL_MS = 8000;

// Pedidos de la tienda online. Se actualiza en el momento en que llega uno (o cada pocos segundos sin conexión en vivo)
// y suena el mismo aviso que el pedido por QR.
@Injectable({ providedIn: 'root' })
export class DeliveryService implements OnDestroy {
  private readonly baseUrl = `${environment.apiUrl}/delivery`;
  private state = new BehaviorSubject<DeliveryInbox>(EMPTY);
  readonly inbox$ = this.state.asObservable();
  private sub?: Subscription;
  private seen = new Set<string>();
  private firstLoad = true;

  constructor(private http: HttpClient, private realtime: RealtimeService, private qr: QrService) {}

  get value(): DeliveryInbox {
    return this.state.value;
  }

  // Pedidos nuevos esperando que alguien los acepte
  get pendingCount(): number {
    return this.state.value.orders.filter((o) => o.status === 'PENDING').length;
  }

  watch(enabled: boolean) {
    if (!enabled) {
      this.sub?.unsubscribe();
      this.sub = undefined;
      this.seen.clear();
      this.firstLoad = true;
      this.state.next(EMPTY);
      return;
    }
    if (this.sub) return;
    this.sub = this.realtime.refresh$('delivery', POLL_MS).subscribe(() => this.refresh());
  }

  refresh() {
    this.http.get<DeliveryInbox>(`${this.baseUrl}/orders`).subscribe({
      next: (inbox) => {
        const pending = inbox.orders.filter((o) => o.status === 'PENDING').map((o) => o.id);
        // La primera consulta no suena: solo se avisa de lo que llega mientras la pantalla está abierta
        if (!this.firstLoad && pending.some((id) => !this.seen.has(id))) this.qr.beep();
        this.firstLoad = false;
        this.seen = new Set(pending);
        this.state.next(inbox);
      },
      error: () => {},
    });
  }

  accept(id: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/orders/${id}/accept`, {}).pipe(tap(() => this.refresh()));
  }

  ready(id: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/orders/${id}/ready`, {}).pipe(tap(() => this.refresh()));
  }

  reject(id: string, reason: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/orders/${id}/reject`, { reason }).pipe(tap(() => this.refresh()));
  }

  complete(id: string, paymentMethod?: string): Observable<{ ok: boolean; saleId: string | null }> {
    return this.http
      .post<{ ok: boolean; saleId: string | null }>(`${this.baseUrl}/orders/${id}/complete`, paymentMethod ? { paymentMethod } : {})
      .pipe(tap(() => this.refresh()));
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
