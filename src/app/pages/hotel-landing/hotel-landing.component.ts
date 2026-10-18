import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import QRCode from 'qrcode';
import { HotelPublicInfo, HotelPublicService, IssuedVoucher, apiMessage } from 'src/app/services/hotels.service';

type Phase = 'loading' | 'notFound' | 'error' | 'ready';

interface StoredVoucher extends IssuedVoucher {
  restaurantId: string;
  qr?: string;
}

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* sin almacenamiento: funciona igual, solo no recuerda */
    }
  },
};

// Pantalla que ve el huésped al escanear el QR del hotel. No necesita sesión ni instalar nada:
// elige un restaurante, escribe su nombre y el código que le dio el hotel, y recibe un voucher.
@Component({
  selector: 'app-hotel-landing',
  templateUrl: './hotel-landing.component.html',
})
export class HotelLandingComponent implements OnInit {
  phase: Phase = 'loading';
  info: HotelPublicInfo | null = null;
  slug = '';

  guestName = '';
  accessCode = '';
  pendingId: string | null = null; // restaurante cuyo voucher se está pidiendo
  error = '';
  errorFor: string | null = null;

  vouchers: StoredVoucher[] = [];

  constructor(private route: ActivatedRoute, private api: HotelPublicService) {}

  ngOnInit() {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.guestName = store.get('hotel_guest_name') ?? '';
    this.accessCode = store.get(`hotel_code_${this.slug}`) ?? '';
    this.vouchers = this.readVouchers();
    this.load();
  }

  load() {
    this.phase = 'loading';
    this.api.info(this.slug).subscribe({
      next: (info) => {
        this.info = info;
        this.phase = 'ready';
      },
      error: (err) => (this.phase = err?.status === 404 ? 'notFound' : 'error'),
    });
  }

  get canAsk(): boolean {
    return this.guestName.trim().length >= 2 && this.accessCode.trim().length > 0 && !this.pendingId;
  }

  // Un voucher vigente (sin vencer) que el huésped ya tiene para ese restaurante
  activeFor(restaurantId: string): StoredVoucher | undefined {
    return this.vouchers.find((v) => v.restaurantId === restaurantId);
  }

  ask(restaurantId: string) {
    if (!this.canAsk) return;
    this.error = '';
    this.errorFor = null;
    this.pendingId = restaurantId;
    this.api.issue(this.slug, { restaurantId, guestName: this.guestName.trim(), accessCode: this.accessCode.trim() }).subscribe({
      next: async (v) => {
        store.set('hotel_guest_name', this.guestName.trim());
        store.set(`hotel_code_${this.slug}`, this.accessCode.trim());
        const stored: StoredVoucher = { ...v, restaurantId, qr: await this.qrOf(v.code) } as StoredVoucher;
        this.vouchers = [stored, ...this.vouchers];
        this.saveVouchers();
        this.pendingId = null;
      },
      error: (err) => {
        this.pendingId = null;
        this.errorFor = restaurantId;
        this.error =
          err?.status === 429
            ? 'Demasiados intentos. Esperá unos minutos.'
            : apiMessage(err, 'No se pudo pedir el voucher. Revisá tu conexión e intentá de nuevo.');
      },
    });
  }

  daysLeft(v: IssuedVoucher): number {
    return Math.max(0, Math.ceil((new Date(v.validTo).getTime() - Date.now()) / 86400000));
  }

  private qrOf(code: string): Promise<string> {
    return QRCode.toDataURL(code, { width: 300, margin: 1, errorCorrectionLevel: 'M' }).catch(() => '');
  }

  // ---- vouchers guardados en este celular (vigentes) ----

  private key() {
    return `hotel_vouchers_${this.slug}`;
  }

  private readVouchers(): StoredVoucher[] {
    try {
      const list: StoredVoucher[] = JSON.parse(store.get(this.key()) ?? '[]');
      return list.filter((v) => new Date(v.validTo).getTime() > Date.now());
    } catch {
      return [];
    }
  }

  private saveVouchers() {
    store.set(this.key(), JSON.stringify(this.vouchers.slice(0, 10)));
  }
}
