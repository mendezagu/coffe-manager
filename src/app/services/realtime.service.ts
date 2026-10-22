import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import { environment } from 'src/environments/environment';
import { refreshStream } from '../utils/refresh-stream';
import { UserService } from './user.service';

// Qué cambió. 'orders' es para el cliente del QR (el estado de sus pedidos); el resto, para el personal.
export type Topic = 'tables' | 'qr' | 'kitchen' | 'orders' | 'shift';

// Con la conexión en vivo basta una consulta de seguridad por minuto (por si se perdiera algún aviso)
const SAFETY_MS = 60_000;
// Espera entre intentos de reconexión cuando el servidor corta la conexión (vence la sesión, etc.)
const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 60_000;

// Un enlace en vivo con el servidor (el personal usa uno y el cliente del QR, otro)
class Link {
  socket?: Socket;
  readonly connected$ = new BehaviorSubject<boolean>(false);
  retry?: ReturnType<typeof setTimeout>;
  retryMs = RETRY_MIN_MS;
}

// Tiempo real: el servidor avisa "esto cambió" y la pantalla vuelve a pedir sus datos. No viajan datos por el socket.
// Si la conexión se corta, las pantallas consultan cada tanto como antes hasta que vuelve.
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly url = `${new URL(environment.apiUrl).origin}/realtime`;
  private readonly staff = new Link();
  private readonly customer = new Link();
  private readonly events = new Subject<Topic>();

  constructor(private zone: NgZone, private users: UserService) {
    // El personal se conecta al iniciar sesión y se desconecta al cerrarla
    this.users.getAuthState().subscribe((user) => {
      if (user) this.open(this.staff, () => ({ token: this.users.getToken() }));
      else this.close(this.staff);
    });
  }

  // Cliente del QR: se identifica con el código secreto de su mesa
  connectCustomer(qrToken: string) {
    this.open(this.customer, () => ({ qrToken }));
  }

  disconnectCustomer() {
    this.close(this.customer);
  }

  // Emite al suscribirse, cada vez que el servidor avisa un cambio de ese tema y al (re)conectarse.
  // Con la conexión en vivo agrega una consulta de seguridad por minuto; sin ella, consulta cada `fallbackMs`
  // (el intervalo que la pantalla ya usaba), así nunca queda desactualizada.
  refresh$(topic: Topic, fallbackMs: number): Observable<void> {
    const link = topic === 'orders' ? this.customer : this.staff;
    return refreshStream(link.connected$, this.events, topic, fallbackMs, SAFETY_MS);
  }

  get staffConnected(): boolean {
    return this.staff.connected$.value;
  }

  private open(link: Link, auth: () => Record<string, string | null>) {
    if (link.socket) return;
    // Fuera de Angular: el latido de la conexión no debe disparar la detección de cambios en cada ping
    this.zone.runOutsideAngular(() => {
      const socket = io(this.url, {
        auth: (cb) => cb(auth()), // se lee de nuevo en cada reconexión (por si la sesión cambió)
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1_000,
        reconnectionDelayMax: 15_000,
      });
      link.socket = socket;

      socket.on('connect', () => {
        link.retryMs = RETRY_MIN_MS;
        this.zone.run(() => link.connected$.next(true));
      });
      socket.on('disconnect', (reason) => {
        this.zone.run(() => link.connected$.next(false));
        // Si lo corta el servidor, socket.io no reintenta solo: se reintenta acá, con espera creciente
        if (reason === 'io server disconnect') this.scheduleRetry(link, socket);
      });
      socket.on('connect_error', () => this.zone.run(() => link.connected$.next(false)));
      socket.on('changed', (msg: { topic?: Topic }) => {
        if (msg?.topic) this.zone.run(() => this.events.next(msg.topic as Topic));
      });
    });
  }

  private scheduleRetry(link: Link, socket: Socket) {
    if (link.retry) clearTimeout(link.retry);
    link.retry = setTimeout(() => {
      if (link.socket === socket) socket.connect();
    }, link.retryMs);
    link.retryMs = Math.min(link.retryMs * 2, RETRY_MAX_MS);
  }

  private close(link: Link) {
    if (link.retry) clearTimeout(link.retry);
    link.retry = undefined;
    link.retryMs = RETRY_MIN_MS;
    link.socket?.removeAllListeners();
    link.socket?.disconnect();
    link.socket = undefined;
    if (link.connected$.value) link.connected$.next(false);
  }
}
