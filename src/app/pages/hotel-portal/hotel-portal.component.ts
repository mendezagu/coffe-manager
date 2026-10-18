import { Component, OnInit } from '@angular/core';
import QRCode from 'qrcode';
import { HotelPortalService, HotelSummary, VoucherView, apiMessage } from 'src/app/services/hotels.service';

const STATUS_LABELS: Record<VoucherView, string> = {
  ISSUED: 'Sin usar',
  REDEEMED: 'Usado',
  CANCELLED: 'Anulado',
  EXPIRED: 'Vencido',
};

const STATUS_CLASSES: Record<VoucherView, string> = {
  ISSUED: 'bg-cafe-green-50 text-cafe-green-800',
  REDEEMED: 'bg-sage-100 text-sage-700',
  CANCELLED: 'bg-cafe-red-50 text-cafe-red-700',
  EXPIRED: 'bg-sage-100 text-sage-500',
};

// Sin 0/O ni 1/I/L: el código se lee y se dicta en recepción
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Portal del hotel: su propio login (no es el de los restaurantes). Cambia el código que reparte a sus
// huéspedes, imprime su QR y ve cuántos vouchers se emitieron y se usaron.
@Component({
  selector: 'app-hotel-portal',
  templateUrl: './hotel-portal.component.html',
})
export class HotelPortalComponent implements OnInit {
  loggedIn = false;
  email = '';
  password = '';
  loginError = '';
  busy = false;

  summary: HotelSummary | null = null;
  loading = false;
  error = '';
  notice = '';
  newCode = '';
  url = '';
  qr = '';

  constructor(private portal: HotelPortalService) {}

  ngOnInit() {
    if (this.portal.token) {
      this.loggedIn = true;
      this.load();
    }
  }

  login() {
    if (!this.email.trim() || !this.password || this.busy) return;
    this.busy = true;
    this.loginError = '';
    this.portal.login(this.email, this.password).subscribe({
      next: () => {
        this.busy = false;
        this.password = '';
        this.loggedIn = true;
        this.load();
      },
      error: (err) => {
        this.busy = false;
        this.loginError = err?.status === 429 ? 'Demasiados intentos. Esperá unos minutos.' : apiMessage(err, 'No se pudo iniciar sesión');
      },
    });
  }

  logout() {
    this.portal.logout();
    this.loggedIn = false;
    this.summary = null;
  }

  load() {
    this.loading = true;
    this.portal.summary().subscribe({
      next: async (s) => {
        this.summary = s;
        this.loading = false;
        this.error = '';
        this.url = `${window.location.origin}/hotel/${s.hotel.slug}`;
        this.qr = await QRCode.toDataURL(this.url, { width: 500, margin: 1, errorCorrectionLevel: 'M' }).catch(() => '');
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 401) return this.logout();
        this.error = apiMessage(err, 'No se pudo cargar la información');
      },
    });
  }

  generateCode() {
    const prefix = (this.summary?.hotel.slug ?? 'hotel').replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase();
    const suffix = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
    this.newCode = `${prefix}-${suffix}`;
  }

  saveCode() {
    const code = this.newCode.trim();
    if (!code) return;
    this.portal.setAccessCode(code).subscribe({
      next: () => {
        this.newCode = '';
        this.say('Código actualizado. Los vouchers que ya se emitieron siguen valiendo hasta que venzan.');
        this.load();
      },
      error: (err) => this.fail(apiMessage(err, 'No se pudo cambiar el código')),
    });
  }

  cancel(id: string, guest: string) {
    if (!confirm(`¿Anular el voucher de ${guest}? No se puede deshacer.`)) return;
    this.portal.cancelVoucher(id).subscribe({
      next: () => {
        this.say('Voucher anulado');
        this.load();
      },
      error: (err) => this.fail(apiMessage(err, 'No se pudo anular el voucher')),
    });
  }

  copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => this.say('Copiado'), () => {});
  }

  // Tarjeta para imprimir y dejar en las habitaciones o en recepción
  printCard() {
    const s = this.summary;
    if (!s) return;
    const w = window.open('', '_blank', 'width=600,height=800');
    if (!w) return this.fail('El navegador bloqueó la ventana de impresión. Permití las ventanas emergentes.');
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(s.hotel.name)}</title>
      <style>body{font-family:Roboto,Arial,sans-serif;text-align:center;padding:40px;color:#1b2822}
      h1{font-size:28px;margin:0 0 8px}p{margin:6px 0;font-size:16px}.code{font-size:30px;letter-spacing:6px;font-weight:700;margin:14px 0}
      img{width:260px;height:260px;margin:16px 0}</style></head><body>
      <h1>${esc(s.hotel.name)}</h1>
      <p>Descuentos en restaurantes para nuestros huéspedes</p>
      <img src="${this.qr}" alt="QR">
      <p>Escaneá el código, elegí un restaurante y recibí tu voucher.</p>
      <p>Tu código de huésped:</p>
      <p class="code">${esc(s.hotel.accessCode)}</p>
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  }

  label(s: VoucherView) {
    return STATUS_LABELS[s];
  }

  chip(s: VoucherView) {
    return STATUS_CLASSES[s];
  }

  private say(msg: string) {
    this.notice = msg;
    this.error = '';
  }

  private fail(msg: string) {
    this.error = msg;
    this.notice = '';
  }
}
