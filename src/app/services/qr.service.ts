import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environmentMongo } from 'src/environments/environmentMongo';

// ---------- Personal del local ----------

export interface QrLine {
  name: string;
  quantity: number;
  note: string;
  extras: string[];
  unitPrice: number;
}

export interface QrRequest {
  id: string;
  tableId: string;
  tableName: string;
  tableFree: boolean;
  hasWaiter: boolean;
  customerName: string;
  createdAt: string;
  total: number;
  items: QrLine[];
}

export interface QrCall {
  id: string;
  tableId: string;
  tableName: string;
  type: 'WAITER' | 'BILL';
  createdAt: string;
}

export interface QrInbox {
  active: boolean;
  requests: QrRequest[];
  calls: QrCall[];
}

export interface QrTableRow {
  id: string;
  name: string;
  sector: string;
  occupied: boolean;
  hasQr: boolean;
  pin: string;
  token?: string | null; // solo lo recibe el administrador
}

export interface QrTablesView {
  active: boolean;
  planIncluded: boolean;
  requirePin: boolean;
  tables: QrTableRow[];
}

const EMPTY: QrInbox = { active: false, requests: [], calls: [] };
const POLL_MS = 5000;
const SOUND_KEY = 'qr_sound';

// El sonido se configura por dispositivo (la tablet del salón puede sonar fuerte y la compu de caja bajo)
export interface QrSound {
  enabled: boolean;
  volume: number; // 0 a 100
}
const DEFAULT_SOUND: QrSound = { enabled: true, volume: 60 };

// Pedidos y avisos que llegan desde los celulares de los clientes. Se consulta cada pocos segundos
// (igual que la cocina) y, cuando llega algo nuevo, suena un aviso.
@Injectable({ providedIn: 'root' })
export class QrService implements OnDestroy {
  private readonly baseUrl = `${environmentMongo.apiUrl}/qr`;
  private state = new BehaviorSubject<QrInbox>(EMPTY);
  readonly inbox$ = this.state.asObservable();

  private timer?: ReturnType<typeof setInterval>;
  private seen = new Set<string>();
  private firstLoad = true;
  private audio?: AudioContext;
  sound: QrSound = this.readSound();

  private readSound(): QrSound {
    try {
      const saved = JSON.parse(localStorage.getItem(SOUND_KEY) ?? 'null');
      if (saved && typeof saved.enabled === 'boolean' && Number.isFinite(saved.volume)) {
        return { enabled: saved.enabled, volume: Math.min(100, Math.max(0, Math.round(saved.volume))) };
      }
    } catch {}
    return { ...DEFAULT_SOUND };
  }

  saveSound(sound: QrSound) {
    this.sound = { enabled: sound.enabled, volume: Math.min(100, Math.max(0, Math.round(Number(sound.volume) || 0))) };
    try {
      localStorage.setItem(SOUND_KEY, JSON.stringify(this.sound));
    } catch {}
  }

  // Para el botón "Probar sonido": suena aunque el aviso esté apagado
  testSound() {
    this.beep(true);
  }

  constructor(private http: HttpClient) {}

  get value(): QrInbox {
    return this.state.value;
  }

  // Cantidad total de cosas que esperan al personal
  get pendingCount(): number {
    return this.state.value.requests.length + this.state.value.calls.length;
  }

  // Empieza (o deja de) consultar la bandeja. Se llama según el rol y el plan del negocio.
  watch(enabled: boolean) {
    if (!enabled) {
      if (this.timer) clearInterval(this.timer);
      this.timer = undefined;
      this.seen.clear();
      this.firstLoad = true;
      this.state.next(EMPTY);
      return;
    }
    if (this.timer) return;
    this.refresh();
    this.timer = setInterval(() => this.refresh(), POLL_MS);
  }

  refresh() {
    this.http.get<QrInbox>(`${this.baseUrl}/inbox`).subscribe({
      next: (inbox) => {
        const ids = [...inbox.requests.map((r) => r.id), ...inbox.calls.map((c) => c.id)];
        const hasNew = ids.some((id) => !this.seen.has(id));
        // La primera consulta no suena: solo se avisa de lo que llega mientras la pantalla está abierta
        if (hasNew && !this.firstLoad) this.beep();
        this.firstLoad = false;
        this.seen = new Set(ids);
        this.state.next(inbox);
      },
      error: () => {},
    });
  }

  confirm(id: string, waiterId?: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/requests/${id}/confirm`, waiterId ? { waiterId } : {}).pipe(tap(() => this.refresh()));
  }

  reject(id: string, reason: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/requests/${id}/reject`, { reason }).pipe(tap(() => this.refresh()));
  }

  callDone(id: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/calls/${id}/done`, {}).pipe(tap(() => this.refresh()));
  }

  tables(): Observable<QrTablesView> {
    return this.http.get<QrTablesView>(`${this.baseUrl}/tables`);
  }

  generate(): Observable<{ created: number }> {
    return this.http.post<{ created: number }>(`${this.baseUrl}/tables/generate`, {});
  }

  regenerate(tableId: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/tables/${tableId}/regenerate`, {});
  }

  // Dos tonos cortos. Si el navegador no deja reproducir sonido, simplemente no suena.
  private beep(force = false) {
    if (!force && (!this.sound.enabled || this.sound.volume <= 0)) return;
    try {
      this.audio ??= new AudioContext();
      const ctx = this.audio;
      if (ctx.state === 'suspended') void ctx.resume();
      [0, 0.18].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = i === 0 ? 880 : 1175;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.001, (this.sound.volume / 100) * 0.9), ctx.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.17);
      });
    } catch {
      /* sin sonido */
    }
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}

// ---------- Cliente (pantalla pública del QR) ----------

export interface PublicOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface PublicGroup {
  id: string;
  name: string;
  selection: 'SINGLE' | 'MULTIPLE';
  required: boolean;
  options: PublicOption[];
}

export interface PublicItem {
  id: string;
  name: string;
  price: number;
  categoryId: string | null;
  isPromo: boolean;
  soldOut: boolean;
  groups: PublicGroup[];
}

export interface PublicInfo {
  business: { name: string; logoUrl: string | null; currencyCode: string; locale: string };
  table: { name: string };
  requiresPin: boolean;
  autoConfirm: boolean;
  limits: { maxPending: number; minSecondsBetweenSends: number };
  pinOk: boolean;
  menu?: { categories: { id: string; name: string }[]; items: PublicItem[] };
}

export type ClientStep = 'RECEIVED' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'REJECTED' | 'CANCELLED';

export interface ClientRequest {
  id: string;
  step: ClientStep;
  rejectReason: string;
  createdAt: string;
  customerName: string;
  total: number;
  items: QrLine[];
}

export interface ClientOrders {
  requests: ClientRequest[];
  calls: { waiter: boolean; bill: boolean };
}

export interface SendLine {
  menuItemId: string;
  quantity: number;
  note?: string;
  optionIds?: string[];
}

// Llamadas de la pantalla pública: no llevan sesión; el código secreto del QR va en la dirección.
@Injectable({ providedIn: 'root' })
export class QrPublicService {
  private readonly baseUrl = `${environmentMongo.apiUrl}/public/mesa`;

  constructor(private http: HttpClient) {}

  private headers(pin?: string) {
    return pin ? { headers: new HttpHeaders({ 'x-table-pin': pin }) } : {};
  }

  info(token: string, pin?: string): Observable<PublicInfo> {
    return this.http.get<PublicInfo>(`${this.baseUrl}/${encodeURIComponent(token)}`, this.headers(pin));
  }

  send(token: string, pin: string | undefined, body: { clientId: string; customerName: string; items: SendLine[] }): Observable<ClientRequest> {
    return this.http.post<ClientRequest>(`${this.baseUrl}/${encodeURIComponent(token)}/orders`, body, this.headers(pin));
  }

  mine(token: string, pin: string | undefined, clientId: string): Observable<ClientOrders> {
    return this.http.post<ClientOrders>(`${this.baseUrl}/${encodeURIComponent(token)}/my-orders`, { clientId }, this.headers(pin));
  }

  cancel(token: string, pin: string | undefined, id: string, clientId: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/${encodeURIComponent(token)}/orders/${id}/cancel`, { clientId }, this.headers(pin));
  }

  call(token: string, pin: string | undefined, type: 'WAITER' | 'BILL'): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/${encodeURIComponent(token)}/calls`, { type }, this.headers(pin));
  }
}
