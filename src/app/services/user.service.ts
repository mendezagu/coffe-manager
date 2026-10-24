import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, fromEvent, merge, timer } from 'rxjs';
import { filter, map, tap, throttleTime } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export type AppRole = 'admin' | 'cashier' | 'waiter' | 'kitchen' | 'bar';

// Datos públicos de un local, para confirmar el código al ingresar
export interface LocalInfo {
  code: string;
  name: string;
  city: string;
  logoUrl: string | null;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  active?: boolean;
  createdAt?: string;
  // la contraseña se la puso otra persona: tiene que cambiarla antes de usar la app
  mustChangePassword?: boolean;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  cashier: 'Cajero',
  waiter: 'Mozo',
  kitchen: 'Cocina',
  bar: 'Barra',
};

// Pantalla de inicio según el rol: cocina y barra trabajan en su tablero, el resto en las mesas.
export const homeFor = (role: AppRole | null) => (role === 'kitchen' || role === 'bar' ? '/kitchen' : '/home');

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// El backend maneja los roles en mayúsculas (ADMIN, CASHIER, ...); acá se usan en minúsculas.
const fromApi = (u: any): AppUser => ({ ...u, role: String(u.role).toLowerCase() as AppRole });
const toApiRole = (role: AppRole) => role.toUpperCase();

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly baseUrl = environment.apiUrl;
  private authState = new BehaviorSubject<AppUser | null>(this.readStoredUser());

  constructor(private http: HttpClient) {
    // Si hay sesión guardada se revalida contra el servidor (rol actual, usuario activo).
    // Un 401 lo maneja el interceptor cerrando la sesión.
    if (this.getToken()) {
      this.startKeepAlive();
      this.http.get<any>(`${this.baseUrl}/auth/me`).subscribe({
        next: (u) => this.setUser(fromApi(u)),
        error: () => {},
      });
    }
  }

  // Nombre y logo de un local a partir de su código (para confirmar que se escribió bien antes de pedir la clave)
  localInfo(code: string): Observable<LocalInfo> {
    return this.http.get<LocalInfo>(`${this.baseUrl}/auth/local/${encodeURIComponent(code)}`);
  }

  // `email` es el usuario del local (puede ser un email); `code` es el código del local
  login({ email, password, code }: { email: string; password: string; code?: string }): Observable<AppUser> {
    return this.http
      .post<{ accessToken: string; user: any }>(`${this.baseUrl}/auth/login`, { email, password, ...(code ? { code } : {}) })
      .pipe(
        tap((res) => this.storeToken(res.accessToken)),
        map((res) => fromApi(res.user)),
        tap((user) => this.setUser(user)),
      );
  }

  logout(): void {
    this.storeToken(null);
    this.setUser(null);
  }

  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  getAuthState(): Observable<AppUser | null> {
    return this.authState.asObservable();
  }

  getRoleState(): Observable<AppRole | null> {
    return this.authState.pipe(map((u) => u?.role ?? null));
  }

  mustChangePassword(): boolean {
    return !!this.authState.value?.mustChangePassword;
  }

  // Cambia la contraseña del usuario con sesión (pide la actual). Después ya no se le exige el cambio.
  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string; accessToken?: string }> {
    return this.http
      .post<{ message: string; accessToken?: string }>(`${this.baseUrl}/auth/change-password`, { currentPassword, newPassword })
      .pipe(
        tap((res) => {
          // El servidor invalida las demás sesiones: esta sigue con el token nuevo
          if (res.accessToken) this.storeToken(res.accessToken);
          const user = this.authState.value;
          if (user?.mustChangePassword) this.setUser({ ...user, mustChangePassword: false });
        }),
      );
  }

  isAuthenticated(): boolean {
    return this.authState.value !== null && !!this.getToken();
  }

  currentRole(): AppRole | null {
    return this.authState.value?.role ?? null;
  }

  // ---- Administración de usuarios (solo admin) ----

  listUsers(): Observable<AppUser[]> {
    return this.http.get<any[]>(`${this.baseUrl}/users`).pipe(map((list) => list.map(fromApi)));
  }

  createUser(data: { email: string; name: string; password: string; role: AppRole }): Observable<AppUser> {
    return this.http
      .post<any>(`${this.baseUrl}/users`, { ...data, role: toApiRole(data.role) })
      .pipe(map(fromApi));
  }

  updateUser(
    id: string,
    data: { name?: string; role?: AppRole; active?: boolean; password?: string },
  ): Observable<AppUser> {
    const body = { ...data, role: data.role ? toApiRole(data.role) : undefined };
    return this.http.put<any>(`${this.baseUrl}/users/${id}`, body).pipe(map(fromApi));
  }

  deleteUser(id: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/users/${id}`);
  }

  // ---- Persistencia de sesión ----

  private setUser(user: AppUser | null) {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch {}
    this.authState.next(user);
    if (user) this.startKeepAlive();
    else this.stopKeepAlive();
  }

  // ---- Renovación de la sesión ----
  // El token dura 12 horas desde que se pide. Se renueva solo si hay uso REAL: la persona tocó, escribió o volvió a la
  // pantalla en los últimos 30 minutos. Así quien trabaja no se queda sin sesión a mitad del turno, pero un equipo
  // abandonado (nadie lo toca) deja de renovarse y la sesión vence a las 12 horas de la última actividad.
  // Excepción: las pantallas de cocina y barra, que se quedan mostrando pedidos sin que nadie las toque.
  private keepAlive?: Subscription;
  private lastActivity = Date.now();
  private activityBound = false;

  private bindActivity() {
    if (this.activityBound) return;
    this.activityBound = true;
    const mark = () => (this.lastActivity = Date.now());
    for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) window.addEventListener(ev, mark, { passive: true });
    // Volver a la pestaña (desbloquear la notebook, abrir la app) cuenta como presencia
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) mark();
    });
  }

  private startKeepAlive() {
    if (this.keepAlive && !this.keepAlive.closed) return;
    this.bindActivity();
    this.keepAlive = merge(
      timer(60_000, 20 * 60_000),
      fromEvent(document, 'visibilitychange').pipe(filter(() => !document.hidden)),
      fromEvent(window, 'online'),
    )
      .pipe(throttleTime(60_000))
      .subscribe(() => this.renewToken());
  }

  private stopKeepAlive() {
    this.keepAlive?.unsubscribe();
    this.keepAlive = undefined;
  }

  // ¿Hay alguien usando este equipo? (o es una pantalla que trabaja sola, como cocina o barra)
  private inUse(): boolean {
    const role = this.authState.value?.role;
    if (role === 'kitchen' || role === 'bar') return true;
    return Date.now() - this.lastActivity < 30 * 60_000;
  }

  private renewToken() {
    if (!this.getToken() || !this.inUse()) return;
    // Si el token ya venció, el servidor responde 401 y el interceptor cierra la sesión (es lo esperado)
    this.http.post<{ accessToken: string }>(`/auth/refresh`, {}).subscribe({
      next: (r) => this.storeToken(r.accessToken),
      error: () => {},
    });
  }

  private storeToken(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }

  private readStoredUser(): AppUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw && localStorage.getItem(TOKEN_KEY) ? (JSON.parse(raw) as AppUser) : null;
    } catch {
      return null;
    }
  }
}
