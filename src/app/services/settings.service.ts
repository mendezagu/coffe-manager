import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environmentMongo } from 'src/environments/environmentMongo';
import { UserService } from './user.service';

// Datos del negocio: marca, datos para tickets, moneda y turnos. Vienen de la API (por negocio).
export interface TenantSettings {
  id: string;
  name: string;
  legalName: string;
  taxIdLabel: string;
  taxId: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  ticketFooter: string;
  logoUrl: string | null;
  currencyCode: string;
  locale: string;
  shiftMorningStart: number;
  shiftAfternoonStart: number;
  shiftNightStart: number;
  // plan y funciones habilitadas
  plan: string;
  features: string[];
  splitKitchenBar: boolean; // lo que el negocio eligió
  splitActive: boolean; // lo que rige (elegido y permitido por el plan)
  // propinas y caja
  tipEnabled: boolean;
  tipSuggestedPct: number;
  requireOpenRegister: boolean;
}

export type SettingsUpdate = Partial<Omit<TenantSettings, 'id'>>;

const CACHE_KEY = 'tenant_settings';

// Se usa antes de que lleguen los datos (y en el login, donde todavía no hay sesión).
const DEFAULTS: TenantSettings = {
  id: '',
  name: 'CoffeManager',
  legalName: '',
  taxIdLabel: 'CUIT',
  taxId: '',
  address: '',
  city: '',
  postalCode: '',
  phone: '',
  ticketFooter: '',
  logoUrl: null,
  currencyCode: 'ARS',
  locale: 'es-AR',
  shiftMorningStart: 6,
  shiftAfternoonStart: 12,
  shiftNightStart: 18,
  plan: 'pro',
  features: [],
  splitKitchenBar: false,
  splitActive: false,
  tipEnabled: false,
  tipSuggestedPct: 10,
  requireOpenRegister: true,
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly url = `${environmentMongo.apiUrl}/settings`;
  private state = new BehaviorSubject<TenantSettings>(this.readCache() ?? DEFAULTS);
  private formatter?: Intl.NumberFormat;

  readonly settings$ = this.state.asObservable();

  constructor(private http: HttpClient, users: UserService) {
    // Con sesión se traen los datos del negocio. Al cerrar sesión se conservan los últimos:
    // así la pantalla de login muestra la marca del último negocio que usó este dispositivo.
    users.getAuthState().subscribe((user) => {
      if (user) this.load();
    });
  }

  get value(): TenantSettings {
    return this.state.value;
  }

  // Pide los datos al servidor y los deja como vigentes en toda la app
  refresh(): Observable<TenantSettings> {
    return this.http.get<TenantSettings>(this.url).pipe(tap((s) => this.apply(s)));
  }

  load(): void {
    this.refresh().subscribe({ error: () => {} });
  }

  update(changes: SettingsUpdate): Observable<TenantSettings> {
    return this.http.put<TenantSettings>(this.url, changes).pipe(tap((s) => this.apply(s)));
  }

  // ---- Utilidades de presentación ----

  // Dinero con la moneda y el idioma del negocio (ej: $ 1.234,50)
  format(amount: number | null | undefined): string {
    const n = Number(amount ?? 0);
    if (!this.formatter) {
      try {
        this.formatter = new Intl.NumberFormat(this.value.locale, {
          style: 'currency',
          currency: this.value.currencyCode,
        });
      } catch {
        this.formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
      }
    }
    return this.formatter.format(n);
  }

  // El logo puede ser una ruta de la app (assets/...) o una imagen embebida.
  // En ventanas de impresión (about:blank) las rutas relativas no resuelven: se pasan a absolutas.
  absoluteLogoUrl(): string | null {
    const logo = this.value.logoUrl;
    if (!logo) return null;
    return logo.startsWith('data:') ? logo : new URL(logo, document.baseURI).href;
  }

  shiftLabel(date = new Date()): string {
    const h = date.getHours();
    const s = this.value;
    if (h >= s.shiftMorningStart && h < s.shiftAfternoonStart) return 'Turno Mañana';
    if (h >= s.shiftAfternoonStart && h < s.shiftNightStart) return 'Turno Tarde';
    return 'Turno Noche';
  }

  // Líneas de datos fiscales del negocio para tickets (omite las vacías)
  ticketHeaderLines(): string[] {
    const s = this.value;
    return [
      s.legalName,
      s.taxId ? `${s.taxIdLabel || 'CUIT'}: ${s.taxId}` : '',
      s.address ? `Dom.Comer: ${s.address}` : '',
      s.postalCode ? `CP: ${s.postalCode}` : '',
      s.city,
      s.phone ? `Tel: ${s.phone}` : '',
      ...(s.ticketFooter || '').split('\n'),
    ]
      .map((l) => l.trim())
      .filter(Boolean);
  }

  // Los textos del negocio van dentro de HTML de impresión: se escapan.
  escape(text: string): string {
    return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  }

  private apply(s: TenantSettings) {
    this.formatter = undefined;
    this.state.next(s);
    document.title = s.name;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(s));
    } catch {}
  }

  private readCache(): TenantSettings | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : null;
    } catch {
      return null;
    }
  }
}
