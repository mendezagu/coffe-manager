import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SettingsService, SettingsUpdate, TenantSettings } from 'src/app/services/settings.service';
import { QrService } from 'src/app/services/qr.service';
import { BrandImages, BrandKind, MenuImageService } from 'src/app/services/menu-image.service';
import { AUTO_BACKGROUND_INTENSITY, AUTO_COVER_INTENSITY, backgroundVeil, coverVeil } from 'src/app/utils/brand-intensity';
import { minToTime } from 'src/app/services/reservations.service';
import { BRAND_SWATCHES, DEFAULT_BRAND, brandStyle, legibleBrand } from 'src/app/services/brand';

export interface Region {
  label: string;
  currencyCode: string;
  locale: string;
}

// Moneda e idioma de formato van juntos: eligiendo el país queda resuelto $ 1.234,50 vs $1,234.50
export const REGIONS: Region[] = [
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

type SettingsTab = 'negocio' | 'operacion' | 'funciones' | 'cuenta';

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

  // Pestañas de la página (cada sección del formulario pertenece a una)
  readonly tabs: { key: SettingsTab; label: string; icon: string }[] = [
    { key: 'negocio', label: 'Negocio', icon: 'storefront' },
    { key: 'operacion', label: 'Operación', icon: 'tune' },
    { key: 'funciones', label: 'Funciones', icon: 'extension' },
    { key: 'cuenta', label: 'Seguridad', icon: 'lock' },
  ];
  tab: SettingsTab = 'negocio';

  // Reservas: opciones de los selectores y dirección pública
  readonly timeOptions = Array.from({ length: 48 }, (_, i) => ({ value: i * 30, label: minToTime(i * 30) }));
  readonly dayNames = [
    { n: 1, label: 'Lun' },
    { n: 2, label: 'Mar' },
    { n: 3, label: 'Mié' },
    { n: 4, label: 'Jue' },
    { n: 5, label: 'Vie' },
    { n: 6, label: 'Sáb' },
    { n: 0, label: 'Dom' },
  ];
  readonly slotOptions = [15, 30, 60];
  readonly durationOptions = [60, 90, 120, 150, 180, 240];
  readonly advanceOptions = [7, 14, 30, 60, 90];
  readonly noticeOptions = [
    { value: 0, label: 'Sin mínimo' },
    { value: 30, label: '30 minutos' },
    { value: 60, label: '1 hora' },
    { value: 120, label: '2 horas' },
    { value: 180, label: '3 horas' },
    { value: 360, label: '6 horas' },
    { value: 1440, label: '1 día' },
  ];

  // Color de marca de la carta QR y de las reservas
  readonly brandSwatches = BRAND_SWATCHES;
  readonly defaultBrand = DEFAULT_BRAND;

  get brandPreviewStyle(): string {
    return brandStyle(this.form?.brandColor);
  }

  // El color con el que se va a ver de verdad (si es muy claro, se oscurece para que el texto blanco se lea)
  get brandShown(): string {
    return legibleBrand(this.form?.brandColor ?? DEFAULT_BRAND);
  }

  get brandAdjusted(): boolean {
    return (this.form?.brandColor ?? '').toLowerCase() !== this.brandShown;
  }

  setBrand(color: string) {
    if (this.form) this.form.brandColor = color;
  }

  hasDay(n: number): boolean {
    return !!this.form?.reservationDays.includes(n);
  }

  toggleDay(n: number) {
    if (!this.form) return;
    const days = this.form.reservationDays;
    this.form.reservationDays = days.includes(n) ? days.filter((d) => d !== n) : [...days, n];
  }

  // Carta online: la dirección se arma al guardar con la carta activada
  get menuLink(): string | null {
    const slug = this.form?.menuSlug;
    return slug ? `${window.location.origin}/carta/${slug}` : null;
  }

  copyMenuLink() {
    const link = this.menuLink;
    if (!link) return;
    navigator.clipboard?.writeText(link).then(
      () => this.notify('Dirección copiada'),
      () => this.notify('No se pudo copiar'),
    );
  }

  // QR de la carta, listo para imprimir y pegar en el local
  async downloadMenuQr() {
    const link = this.menuLink;
    if (!link) return;
    const QRCode = (await import('qrcode')).default;
    const url = await QRCode.toDataURL(link, { width: 800, margin: 2, errorCorrectionLevel: 'M' });
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qr-carta.png';
    a.click();
  }

  // La dirección que se comparte: se arma cuando se guardan los ajustes con las reservas activadas
  get reservationLink(): string | null {
    const slug = this.form?.reservationSlug;
    return slug ? `${window.location.origin}/reservar/${slug}` : null;
  }

  copyReservationLink() {
    const link = this.reservationLink;
    if (!link) return;
    navigator.clipboard?.writeText(link).then(
      () => this.notify('Dirección copiada'),
      () => this.notify('No se pudo copiar'),
    );
  }

  setTab(tab: SettingsTab) {
    this.tab = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  hours = Array.from({ length: 24 }, (_, h) => h);

  // Sonido de aviso de pedidos QR: se guarda en este dispositivo apenas se cambia
  sound = { ...this.qr.sound };

  constructor(private settings: SettingsService, private snackBar: MatSnackBar, private qr: QrService, private images: MenuImageService) {}

  // Portada y fondo de la carta: se suben y quedan guardadas en el momento (no hace falta apretar Guardar)
  brandBusy: BrandKind | null = null;

  get imagesAvailable(): boolean {
    return !!this.form?.imagesAvailable;
  }

  async onBrandPicked(kind: BrandKind, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.brandBusy = kind;
    try {
      this.applyBrand(await this.images.uploadBrand(kind, file));
      this.notify(kind === 'cover' ? 'Portada guardada' : 'Fondo guardado');
    } catch (e: any) {
      const msg = e?.error?.message ?? e?.message;
      this.notify(Array.isArray(msg) ? msg.join('. ') : msg || 'No se pudo guardar la imagen');
    } finally {
      this.brandBusy = null;
    }
  }

  removeBrand(kind: BrandKind) {
    this.brandBusy = kind;
    this.images.removeBrand(kind).subscribe({
      next: (r) => {
        this.applyBrand(r);
        this.brandBusy = null;
      },
      error: () => {
        this.brandBusy = null;
        this.notify('No se pudo quitar la imagen');
      },
    });
  }

  // Intensidad de la portada y del fondo: automática (la decide el sistema) o a gusto con un deslizador. Se guarda al soltar.
  readonly intensityAuto = { cover: AUTO_COVER_INTENSITY, background: AUTO_BACKGROUND_INTENSITY };
  private intensityTimer: { [k in BrandKind]?: ReturnType<typeof setTimeout> } = {};

  intensityOf(kind: BrandKind): number | null {
    return (kind === 'cover' ? this.form?.coverIntensity : this.form?.backgroundIntensity) ?? null;
  }

  isAuto(kind: BrandKind): boolean {
    return this.intensityOf(kind) === null;
  }

  // Valor que muestra el deslizador (el automático si está en automático)
  sliderValue(kind: BrandKind): number {
    return this.intensityOf(kind) ?? this.intensityAuto[kind];
  }

  // Vista previa: el mismo velo que usa la carta
  veil(kind: BrandKind): string {
    return kind === 'cover' ? coverVeil(this.intensityOf(kind)) : backgroundVeil(this.intensityOf(kind));
  }

  setIntensity(kind: BrandKind, value: number | null) {
    if (!this.form) return;
    if (kind === 'cover') this.form.coverIntensity = value;
    else this.form.backgroundIntensity = value;
    clearTimeout(this.intensityTimer[kind]);
    this.intensityTimer[kind] = setTimeout(() => {
      const change = kind === 'cover' ? { coverIntensity: value } : { backgroundIntensity: value };
      this.settings.update(change).subscribe({
        error: () => this.notify('No se pudo guardar la intensidad'),
      });
    }, 400);
  }

  toggleAuto(kind: BrandKind) {
    this.setIntensity(kind, this.isAuto(kind) ? this.intensityAuto[kind] : null);
  }

  private applyBrand(r: BrandImages) {
    if (this.form) {
      this.form.coverImageUrl = r.coverImageUrl;
      this.form.backgroundImageUrl = r.backgroundImageUrl;
    }
    this.settings.refresh().subscribe({ error: () => {} });
  }

  saveSound() {
    this.qr.saveSound(this.sound);
  }

  testSound() {
    this.saveSound();
    this.qr.testSound();
  }

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

  // ¿El plan del negocio incluye el inventario?
  get canInventory(): boolean {
    return (this.form?.features ?? []).includes('inventory');
  }

  // ¿El plan del negocio incluye el pedido por QR?
  get canQr(): boolean {
    return (this.form?.features ?? []).includes('qr_ordering');
  }

  // ¿El plan del negocio incluye la comisión de mozos / las reservas?
  get canCommission(): boolean {
    return (this.form?.features ?? []).includes('commission');
  }

  get canReservations(): boolean {
    return (this.form?.features ?? []).includes('reservations');
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
