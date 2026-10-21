import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import Chart from 'chart.js/auto';

export type ThemeMode = 'light' | 'dark' | 'auto';

const KEY = 'theme_mode';

// Claro / oscuro / automático (sigue al sistema). Se guarda en cada dispositivo.
// El modo oscuro es solo del panel interno: las pantallas de clientes (carta QR, reservas, hotel) y el ingreso
// quedan siempre claros, así cada restaurante controla cómo se ven con su color de marca.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly modeSubject = new BehaviorSubject<ThemeMode>(this.read());
  readonly mode$ = this.modeSubject.asObservable();

  // ¿Se está viendo el panel interno? (con el menú lateral)
  private inShell = false;
  private readonly query = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

  constructor() {
    this.query?.addEventListener?.('change', () => this.apply());
  }

  get mode(): ThemeMode {
    return this.modeSubject.value;
  }

  // Lo que realmente rige (en automático, depende del sistema)
  get dark(): boolean {
    return this.mode === 'dark' || (this.mode === 'auto' && !!this.query?.matches);
  }

  setMode(mode: ThemeMode) {
    try {
      localStorage.setItem(KEY, mode);
    } catch {}
    this.modeSubject.next(mode);
    this.apply();
  }

  setShell(on: boolean) {
    this.inShell = on;
    this.apply();
  }

  private apply() {
    const dark = this.inShell && this.dark;
    document.documentElement.classList.toggle('dark', dark);
    Chart.defaults.color = dark ? '#b5bac1' : '#666666';
    Chart.defaults.borderColor = dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  }

  private read(): ThemeMode {
    try {
      const v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' || v === 'auto' ? v : 'light';
    } catch {
      return 'light';
    }
  }
}
