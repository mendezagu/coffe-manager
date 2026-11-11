import { Pipe, PipeTransform } from '@angular/core';
import { SettingsService } from '../services/settings.service';

// Formatea dinero con la moneda del negocio (reemplaza a `currency`, que usaba siempre USD/$).
// No es puro: si el admin cambia la moneda, los importes en pantalla se actualizan.
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  constructor(private settings: SettingsService) {}

  // short: sin los ceros de los centavos cuando el monto es redondo ($ 6.300 en vez de $ 6.300,00)
  transform(value: number | null | undefined, short = false): string {
    // Sin dato (o no numérico) no se muestra nada, en vez de inventar un $ 0,00
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '';
    const s = this.settings.format(value);
    return short && Number.isInteger(Number(value)) ? s.replace(/[.,]0+$/, '') : s;
  }
}
