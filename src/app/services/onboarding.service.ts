import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { finalize, shareReplay, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { UserService } from './user.service';

export interface OnboardingTemplate {
  key: string;
  label: string;
  categories: { name: string; items: { name: string; price: number }[] }[];
}

export interface OnboardingStatus {
  done: boolean;
  counts: {
    menuItems: number;
    exampleItems: number;
    categories: number;
    tables: number;
    waiters: number;
    sectors: number;
    modifierGroups: number;
    cashRegisters: number;
    sales: number;
  };
  templates: OnboardingTemplate[];
}

// Lo mínimo para operar: menú, mesas, al menos un mozo, caja abierta una vez y una primera venta.
// Hasta cumplirlo el menú lateral muestra solo Inicio y Cerrar sesión, y el checklist no se puede ocultar.
export const isSetupPending = (c: OnboardingStatus['counts']): boolean =>
  !(c.menuItems > 0 && c.tables > 0 && c.waiters > 0 && c.cashRegisters > 0 && c.sales > 0);

// Lo básico para usar el tablero: menú, mesas y un mozo (sin mozo no se puede ordenar). Con eso se habilita Caja.
export const isBasicsPending = (c: OnboardingStatus['counts']): boolean => !(c.menuItems > 0 && c.tables > 0 && c.waiters > 0);

// La sección Configuración del menú se habilita antes que el resto: falta la primera venta y ya está disponible.
export const isAdminLocked = (c: OnboardingStatus['counts']): boolean =>
  !(c.menuItems > 0 && c.tables > 0 && c.waiters > 0 && c.cashRegisters > 0);

// Asistente de primeros pasos y checklist del inicio: un negocio nuevo lo ve hasta terminarlo o saltearlo.
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly url = `${environment.apiUrl}/onboarding`;

  // Una vez que se sabe que el negocio terminó el asistente no se vuelve a preguntar (hasta cambiar de sesión)
  knownDone = false;

  // Faltan pasos obligatorios (solo se calcula para el administrador; para el resto es siempre false)
  private pending = new BehaviorSubject<boolean>(false);
  readonly setupPending$ = this.pending.asObservable();

  // Falta el menú o las mesas (para el administrador; para el resto es siempre false)
  private basics = new BehaviorSubject<boolean>(false);
  readonly basicsPending$ = this.basics.asObservable();

  // Configuración (Administrar, Mi negocio, Logs) todavía bloqueada
  private adminBlocked = new BehaviorSubject<boolean>(false);
  readonly adminLocked$ = this.adminBlocked.asObservable();

  // Guía de la primera venta: con menú, mesas y mozo cargados y ninguna venta todavía, la tarjeta de mesa y los
  // diálogos muestran qué botón tocar en cada paso. Se apaga sola con la primera venta.
  private guide = new BehaviorSubject<boolean>(false);
  readonly guideActive$ = this.guide.asObservable();

  constructor(private http: HttpClient, users: UserService) {
    users.getAuthState().subscribe(() => {
      this.knownDone = false;
      this.pending.next(false);
      this.basics.next(false);
      this.adminBlocked.next(false);
      this.guide.next(false);
    });
  }

  // Varias pantallas piden el estado a la vez al cargar (menú, Inicio, checklist, guardas): mientras hay una consulta
  // en curso, todas comparten la misma respuesta en vez de pedir cada una la suya.
  private inflight?: Observable<OnboardingStatus>;

  // ¿Faltan pasos obligatorios? (último valor conocido)
  get setupPendingNow(): boolean {
    return this.pending.value;
  }

  status(): Observable<OnboardingStatus> {
    if (this.inflight) return this.inflight;
    this.inflight = this.http.get<OnboardingStatus>(`${this.url}/status`).pipe(
      tap((s) => {
        this.knownDone = s.done;
        this.pending.next(isSetupPending(s.counts));
        this.basics.next(isBasicsPending(s.counts));
        this.adminBlocked.next(isAdminLocked(s.counts));
        this.guide.next(!isBasicsPending(s.counts) && s.counts.sales === 0);
      }),
      finalize(() => (this.inflight = undefined)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.inflight;
  }

  // Vuelve a calcular qué falta (para el menú lateral); si falla, no se bloquea nada
  refreshPending(): void {
    this.status().subscribe({ error: () => {} });
  }

  applyTemplate(key: string): Observable<{ items: number; categories: number }> {
    return this.http.post<{ items: number; categories: number }>(`${this.url}/template`, { key });
  }

  removeTemplate(): Observable<{ items: number; categories: number }> {
    return this.http.delete<{ items: number; categories: number }>(`${this.url}/template`);
  }

  createTables(count: number): Observable<{ created: number }> {
    return this.http.post<{ created: number }>(`${this.url}/tables`, { count });
  }
}
