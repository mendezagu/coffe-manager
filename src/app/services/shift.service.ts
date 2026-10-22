import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const SHIFT_KEY = 'balance_shift_start';

// Turno en curso en este dispositivo. El Balance y el Inicio cuentan solo desde que se comenzó;
// las ventas no se borran: el historial completo vive en Reportes.
@Injectable({ providedIn: 'root' })
export class ShiftService {
  private readonly subject = new BehaviorSubject<Date | null>(this.read());
  readonly start$ = this.subject.asObservable();

  constructor() {
    // Si el turno se cambia desde otra pestaña, esta se entera
    window.addEventListener('storage', (e) => {
      if (e.key === SHIFT_KEY) this.subject.next(this.read());
    });
  }

  get start(): Date | null {
    return this.subject.value;
  }

  // Comienza un turno nuevo ahora mismo
  begin(): Date {
    const now = new Date();
    try {
      localStorage.setItem(SHIFT_KEY, now.toISOString());
    } catch {
      /* sin almacenamiento: el turno vale hasta que se cierre la pestaña */
    }
    this.subject.next(now);
    return now;
  }

  private read(): Date | null {
    try {
      const raw = localStorage.getItem(SHIFT_KEY);
      const d = raw ? new Date(raw) : null;
      return d && !isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
}
