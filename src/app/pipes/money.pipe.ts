import { Pipe, PipeTransform } from '@angular/core';
import { SettingsService } from '../services/settings.service';

// Formatea dinero con la moneda del negocio (reemplaza a `currency`, que usaba siempre USD/$).
// No es puro: si el admin cambia la moneda, los importes en pantalla se actualizan.
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  constructor(private settings: SettingsService) {}

  transform(value: number | null | undefined): string {
    // Sin dato (o no numérico) no se muestra nada, en vez de inventar un $ 0,00
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '';
    return this.settings.format(value);
  }
}
