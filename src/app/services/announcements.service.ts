import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  images: { key: string; url: string | null }[];
  important: boolean;
  publishedAt: string | null;
  read: boolean;
}

interface Unread {
  count: number;
  popup: Announcement | null;
}

// Novedades de Tavolapp para el administrador del local: campanita con las que no leyó y, para las importantes,
// una ventana al entrar. Las arma la Consola de plataforma.
@Injectable({ providedIn: 'root' })
export class AnnouncementsService {
  private readonly url = `${environment.apiUrl}/announcements`;

  private readonly state = new BehaviorSubject<Unread>({ count: 0, popup: null });
  readonly unread$ = this.state.asObservable();

  constructor(private http: HttpClient) {}

  // Cuántas faltan leer y, si hay una importante sin leer, cuál. Si falla no se molesta a nadie.
  refresh(): void {
    this.http.get<Unread>(`${this.url}/unread`).subscribe({ next: (u) => this.state.next(u), error: () => {} });
  }

  clear(): void {
    this.state.next({ count: 0, popup: null });
  }

  list(): Observable<Announcement[]> {
    return this.http.get<Announcement[]>(this.url);
  }

  markRead(id: string): Observable<unknown> {
    return this.http.post(`${this.url}/${encodeURIComponent(id)}/read`, {}).pipe(tap(() => this.refresh()));
  }

  markAllRead(): Observable<unknown> {
    return this.http.post(`${this.url}/read-all`, {}).pipe(tap(() => this.refresh()));
  }
}
