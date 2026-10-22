import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { RealtimeService } from './realtime.service';
import { UserService } from './user.service';

// Turno en curso del NEGOCIO: lo guarda el servidor, así todos los dispositivos (caja, tablet del salón, celular del
// dueño) ven lo mismo. El Balance y el Inicio cuentan solo desde que se comenzó; las ventas no se borran: el historial
// completo está siempre en Reportes.
@Injectable({ providedIn: 'root' })
export class ShiftService {
  private readonly url = `${environment.apiUrl}/shift`;
  private readonly subject = new BehaviorSubject<Date | null>(null);
  readonly start$ = this.subject.asObservable();
  private sub?: Subscription;

  constructor(private http: HttpClient, users: UserService, realtime: RealtimeService) {
    // Antes el turno se guardaba en cada dispositivo: esa copia ya no vale y se descarta
    try {
      localStorage.removeItem('balance_shift_start');
    } catch {
      /* sin almacenamiento: no hay nada que borrar */
    }
    users.getAuthState().subscribe((user) => {
      this.sub?.unsubscribe();
      this.sub = undefined;
      this.subject.next(null);
      // Se pide al iniciar sesión, cada vez que otro dispositivo comienza un turno y, de respaldo, cada minuto
      if (user) this.sub = realtime.refresh$('shift', 60_000).subscribe(() => this.refresh());
    });
  }

  get start(): Date | null {
    return this.subject.value;
  }

  refresh(): void {
    this.http.get<{ startedAt: string | null }>(this.url).subscribe({
      next: (r) => this.set(r.startedAt ? new Date(r.startedAt) : null),
      error: () => {
        /* sin conexión: se sigue mostrando el último turno conocido */
      },
    });
  }

  // Comienza un turno nuevo ahora mismo, para todo el negocio
  begin(): Observable<Date> {
    return this.http.post<{ startedAt: string }>(`${this.url}/start`, {}).pipe(
      map((r) => new Date(r.startedAt)),
      tap((d) => this.set(d)),
    );
  }

  private set(d: Date | null) {
    const cur = this.subject.value;
    if ((cur?.getTime() ?? null) !== (d?.getTime() ?? null)) this.subject.next(d);
  }
}
