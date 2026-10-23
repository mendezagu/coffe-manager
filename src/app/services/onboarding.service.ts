import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
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

  // Emite cada vez que se consulta el estado, con el resultado real (a diferencia de setupPending$, que arranca en false
  // antes de saber nada): sirve para apagar ayudas de primeros pasos cuando el negocio ya terminó de configurarse
  private loaded = new Subject<boolean>();
  readonly setupLoaded$ = this.loaded.asObservable();

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
      this.cache = undefined;
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

  // Además, la última respuesta se reutiliza 2 segundos: al cargar, cada pantalla lo pide una tras otra (no a la vez).
  // Las acciones que cambian lo que falta (plantilla, mesas) la descartan.
  private cache?: { at: number; value: OnboardingStatus };

  status(): Observable<OnboardingStatus> {
    if (this.cache && Date.now() - this.cache.at < 2000) return of(this.cache.value);
    if (this.inflight) return this.inflight;
    this.inflight = this.http.get<OnboardingStatus>(`${this.url}/status`).pipe(
      tap((s) => {
        this.cache = { at: Date.now(), value: s };
        this.loaded.next(isSetupPending(s.counts));
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
    return this.http.post<{ items: number; categories: number }>(`${this.url}/template`, { key }).pipe(tap(() => (this.cache = undefined)));
  }

  removeTemplate(): Observable<{ items: number; categories: number }> {
    return this.http.delete<{ items: number; categories: number }>(`${this.url}/template`).pipe(tap(() => (this.cache = undefined)));
  }

  createTables(count: number): Observable<{ created: number }> {
    return this.http.post<{ created: number }>(`${this.url}/tables`, { count }).pipe(tap(() => (this.cache = undefined)));
  }
}
