import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SettingsService, SettingsUpdate, TenantSettings } from 'src/app/services/settings.service';

interface Region {
  label: string;
  currencyCode: string;
  locale: string;
}

// Moneda e idioma de formato van juntos: eligiendo el país queda resuelto $ 1.234,50 vs $1,234.50
const REGIONS: Region[] = [
  { label: 'Argentina (ARS)', currencyCode: 'ARS', locale: 'es-AR' },
  { label: 'Chile (CLP)', currencyCode: 'CLP', locale: 'es-CL' },
  { label: 'Uruguay (UYU)', currencyCode: 'UYU', locale: 'es-UY' },
  { label: 'Paraguay (PYG)', currencyCode: 'PYG', locale: 'es-PY' },
  { label: 'Bolivia (BOB)', currencyCode: 'BOB', locale: 'es-BO' },
  { label: 'Perú (PEN)', currencyCode: 'PEN', locale: 'es-PE' },
  { label: 'Colombia (COP)', currencyCode: 'COP', locale: 'es-CO' },
  { label: 'México (MXN)', currencyCode: 'MXN', locale: 'es-MX' },
  { label: 'España (EUR)', currencyCode: 'EUR', locale: 'es-ES' },
  { label: 'Brasil (BRL)', currencyCode: 'BRL', locale: 'pt-BR' },
  { label: 'Estados Unidos (USD)', currencyCode: 'USD', locale: 'en-US' },
];

const LOGO_MAX_SIDE = 256;
const LOGO_MAX_CHARS = 300_000;

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  form: Omit<TenantSettings, 'id'> | null = null;
  regions: Region[] = REGIONS;
  region = ''; // `${currencyCode}|${locale}`
  saving = false;
  hours = Array.from({ length: 24 }, (_, h) => h);

  constructor(private settings: SettingsService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    // El formulario se llena con la versión del servidor (no con la guardada en el navegador).
    this.settings.refresh().subscribe({
      next: (s) => {
      const { id, ...rest } = s;
      this.form = { ...rest };
      this.region = `${s.currencyCode}|${s.locale}`;
      if (!REGIONS.some((r) => `${r.currencyCode}|${r.locale}` === this.region)) {
        this.regions = [...REGIONS, { label: `Personalizada (${s.currencyCode}, ${s.locale})`, currencyCode: s.currencyCode, locale: s.locale }];
      }
      },
      error: () => this.notify('No se pudieron cargar los datos del negocio'),
    });
  }

  regionKey(r: Region) {
    return `${r.currencyCode}|${r.locale}`;
  }

  // Vista previa del encabezado del ticket con lo que se está escribiendo
  get previewLines(): string[] {
    const f = this.form;
    if (!f) return [];
    return [
      f.legalName,
      f.taxId ? `${f.taxIdLabel || 'CUIT'}: ${f.taxId}` : '',
      f.address ? `Dom.Comer: ${f.address}` : '',
      f.postalCode ? `CP: ${f.postalCode}` : '',
      f.city,
      f.phone ? `Tel: ${f.phone}` : '',
      ...(f.ticketFooter || '').split('\n'),
    ]
      .map((l) => l.trim())
      .filter(Boolean);
  }

  get previewLogo(): string | null {
    const logo = this.form?.logoUrl;
    return logo ?? null;
  }

  // ¿El plan del negocio incluye separar cocina y barra?
  get canSplit(): boolean {
    return (this.form?.features ?? []).includes('kitchen_bar_split');
  }

  get shiftsValid(): boolean {
    const f = this.form;
    return !!f && f.shiftMorningStart < f.shiftAfternoonStart && f.shiftAfternoonStart < f.shiftNightStart;
  }

  async onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite volver a elegir el mismo archivo
    if (!file || !this.form) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      this.notify('Elegí una imagen PNG, JPG o WEBP');
      return;
    }
    try {
      this.form.logoUrl = await this.shrinkImage(file);
    } catch {
      this.notify('No se pudo leer la imagen');
    }
  }

  removeLogo() {
    if (this.form) this.form.logoUrl = null;
  }

  save() {
    if (!this.form || this.saving || !this.form.name.trim() || !this.shiftsValid) return;
    const [currencyCode, locale] = this.region.split('|');
    const changes: SettingsUpdate = { ...this.form, currencyCode, locale };

    this.saving = true;
    this.settings.update(changes).subscribe({
      next: () => {
        this.saving = false;
        this.notify('Datos del negocio guardados');
      },
      error: (err) => {
        this.saving = false;
        const msg = err?.error?.message;
        this.notify(Array.isArray(msg) ? msg.join('. ') : msg || 'No se pudieron guardar los cambios');
      },
    });
  }

  // Achica el logo antes de subirlo: el servidor lo guarda en la base y lo manda en cada ticket.
  private shrinkImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let data = canvas.toDataURL('image/png');
        if (data.length > LOGO_MAX_CHARS) data = canvas.toDataURL('image/jpeg', 0.85);
        data.length > LOGO_MAX_CHARS ? reject(new Error('size')) : resolve(data);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('load'));
      };
      img.src = url;
    });
  }

  private notify(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 3500 });
  }
}
