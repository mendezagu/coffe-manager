import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';
import { ComandaData, CuentaData, TicketBrand, TicketOptions, buildComanda, buildCuenta } from '../utils/ticket-html';

export interface PrintOptions extends TicketOptions {
  copies?: number; // cuántas ventanas de impresión abrir (por defecto, 1)
  windowSize?: string; // tamaño de la ventana, en el formato de window.open
  // Ventana ya abierta con preopen() en el momento del clic: la primera copia se imprime en ella
  win?: Window | null;
}

// Imprime los papeles de la app con una plantilla única (ver utils/ticket-html.ts).
// Devuelve cuántas ventanas se pudieron abrir: 0 significa que el navegador bloqueó la impresión.
@Injectable({ providedIn: 'root' })
export class TicketService {
  constructor(private settings: SettingsService) {}

  // El navegador solo deja abrir una ventana emergente justo después de un clic (unos 5 segundos).
  // Si antes de imprimir hay que esperar al servidor (por ejemplo, guardar el pedido), la ventana se abre acá,
  // en el clic, y se completa después con printComanda(..., { win }). Devuelve null si el navegador la bloqueó.
  preopen(windowSize = 'width=900,height=900'): Window | null {
    return window.open('', '', windowSize);
  }

  printComanda(data: ComandaData, opts: PrintOptions = {}): number {
    return this.open(buildComanda(data, this.brand(), opts), opts);
  }

  printCuenta(data: CuentaData, opts: PrintOptions = {}): number {
    return this.open(buildCuenta(data, this.brand(), opts), opts);
  }

  // Nombre, logo y datos fiscales del negocio, tomados de su configuración
  private brand(): TicketBrand {
    return {
      name: this.settings.value.name,
      logoUrl: this.settings.absoluteLogoUrl(),
      headerLines: this.settings.ticketHeaderLines(),
    };
  }

  private open(html: string, opts: PrintOptions): number {
    let opened = 0;
    for (let i = 0; i < (opts.copies ?? 1); i++) {
      const win = i === 0 && opts.win ? opts.win : window.open('', '', opts.windowSize ?? 'width=900,height=900');
      if (!win) continue;
      win.document.write(html);
      win.document.close();
      win.focus();
      opened++;
    }
    return opened;
  }
}
