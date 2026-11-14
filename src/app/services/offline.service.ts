import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Subject, firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { sessionScope } from '../utils/local-cache';
import { GestionService } from './gestionService';
import { SettingsService } from './settings.service';

// Cuerpo de una venta del Mostrador (el mismo que recibe la API). Lleva un identificador único (checkoutId):
// si el mismo cobro llega dos veces al servidor, éste devuelve la venta ya registrada en vez de duplicarla.
export interface CounterCheckoutBody {
  checkoutId: string;
  items: { menuItemId: string; quantity: number }[];
  takeaway: boolean;
  payments: { method: string; amount: number }[];
  tip: number;
}

export interface PendingSale {
  id: string; // = checkoutId
  scope: string; // usuario que la cobró: sólo se envía con su propia sesión
  createdAt: string;
  body: CounterCheckoutBody;
  total: number;
  cashierName: string;
  takeaway: boolean;
  status: 'pending' | 'failed';
  error?: string;
}

const QUEUE_KEY = 'tavolapp_offline_queue';
const CHECK_EVERY_MS = 15000;

// Estado de la conexión y cola de ventas hechas sin internet.
// "Sin conexión" acá significa "no se llega al servidor" (puede haber Wi-Fi sin internet): se detecta porque falla una llamada
// o porque no responde un chequeo liviano cada 15 segundos.
@Injectable({ providedIn: 'root' })
export class OfflineService {
  private readonly api = environment.apiUrl;
  private readonly root = environment.apiUrl.replace(/\/api\/?$/, '/');

  readonly online$ = new BehaviorSubject<boolean>(true);
  readonly queue$ = new BehaviorSubject<PendingSale[]>(this.read());
  readonly syncing$ = new BehaviorSubject<boolean>(false);
  // Avisa cada vez que una venta pendiente llega al servidor (para refrescar stock, caja, etc.)
  readonly synced$ = new Subject<string>();

  constructor(
    private http: HttpClient,
    private zone: NgZone,
    private gestion: GestionService,
    private settings: SettingsService,
  ) {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => this.check());
    window.addEventListener('offline', () => this.setOnline(false));
    this.zone.runOutsideAngular(() => setInterval(() => this.tick(), CHECK_EVERY_MS));
    setTimeout(() => this.check(), 2000);
  }

  get isOnline(): boolean {
    return this.online$.value;
  }

  // Las ventas de la sesión actual que todavía no se enviaron o que el servidor rechazó
  get mine(): PendingSale[] {
    const scope = sessionScope();
    return this.queue$.value.filter((s) => s.scope === scope);
  }

  get pendingCount(): number {
    return this.queue$.value.filter((s) => s.status === 'pending').length;
  }

  get failedCount(): number {
    return this.queue$.value.filter((s) => s.status === 'failed').length;
  }

  // Lo llama el interceptor cuando una llamada a la API falla por falta de red
  reportNetworkError(): void {
    this.setOnline(false);
  }

  // ¿Este error es "no hay conexión con el servidor" (y no un rechazo del servidor)?
  isNetworkError(err: unknown): boolean {
    return err instanceof HttpErrorResponse && (err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504);
  }

  enqueueCounterSale(body: CounterCheckoutBody, info: { total: number; cashierName: string; takeaway: boolean }): void {
    const scope = sessionScope();
    if (!scope) return;
    const sale: PendingSale = {
      id: body.checkoutId,
      scope,
      createdAt: new Date().toISOString(),
      body,
      total: info.total,
      cashierName: info.cashierName,
      takeaway: info.takeaway,
      status: 'pending',
    };
    this.write([...this.queue$.value.filter((s) => s.id !== sale.id), sale]);
  }

  retry(id: string): void {
    this.write(this.queue$.value.map((s) => (s.id === id ? { ...s, status: 'pending' as const, error: undefined } : s)));
    void this.sync();
  }

  discard(id: string): void {
    this.write(this.queue$.value.filter((s) => s.id !== id));
  }

  // Chequea si se llega al servidor; si se llega y hay ventas pendientes, las envía
  async check(): Promise<void> {
    const ok = await this.ping();
    this.setOnline(ok);
    if (ok && this.pendingCount > 0) void this.sync();
  }

  // Envía las ventas pendientes de la sesión actual, una por una y en orden
  async sync(): Promise<void> {
    if (this.syncing$.value || !sessionScope()) return;
    this.zone.run(() => this.syncing$.next(true));
    try {
      for (const sale of this.mine.filter((s) => s.status === 'pending')) {
        try {
          const done = await firstValueFrom(this.http.post<any>(`${this.api}/counter/checkout`, sale.body));
          this.zone.run(() => {
            this.write(this.queue$.value.filter((s) => s.id !== sale.id));
            this.setOnline(true);
            this.gestion.saveLog(
              `Venta por mostrador de <strong>${this.settings.format(done?.totalAmount ?? sale.total)}</strong> (${sale.takeaway ? 'para llevar' : 'en el local'}), cobrada por <strong>${sale.cashierName}</strong> sin conexión y enviada después`,
            );
            this.synced$.next(sale.id);
          });
        } catch (err) {
          if (this.isNetworkError(err)) {
            this.zone.run(() => this.setOnline(false));
            return; // se reintenta cuando vuelva la conexión
          }
          const msg = (err as HttpErrorResponse)?.error?.message;
          const text = (Array.isArray(msg) ? msg.join('. ') : msg) || 'El servidor no pudo registrar esta venta.';
          this.zone.run(() => this.write(this.queue$.value.map((s) => (s.id === sale.id ? { ...s, status: 'failed' as const, error: text } : s))));
        }
      }
    } finally {
      this.zone.run(() => this.syncing$.next(false));
    }
  }

  // ---- internos ----

  private tick(): void {
    if (!this.online$.value || this.pendingCount > 0) void this.check();
  }

  private setOnline(value: boolean): void {
    if (this.online$.value !== value) this.zone.run(() => this.online$.next(value));
  }

  // "no-cors": basta con que el servidor conteste (aunque el navegador no deje leer la respuesta)
  private async ping(): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      await fetch(this.root, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: controller.signal });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  private read(): PendingSale[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  private write(list: PendingSale[]): void {
    this.queue$.next(list);
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
    } catch {
      /* sin espacio: queda sólo en memoria hasta que se envíe */
    }
  }
}
