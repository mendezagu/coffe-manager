import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import QRCode from 'qrcode';
import { QrService, QrTableRow, QrTablesView } from 'src/app/services/qr.service';
import { SettingsService } from 'src/app/services/settings.service';

interface QrCard extends QrTableRow {
  url: string;
  image: string; // data URL del QR
}

const BASE_KEY = 'qr_base_url';

// Administrar → Códigos QR: un QR por mesa para imprimir y pegar, con su código secreto.
@Component({
  selector: 'app-qr-codes',
  templateUrl: './qr-codes.component.html',
})
export class QrCodesComponent implements OnInit {
  loading = true;
  view: QrTablesView | null = null;
  cards: QrCard[] = [];
  baseUrl = this.readBase() || this.appBase();
  busy = false;

  constructor(private qr: QrService, public settings: SettingsService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.load(true);
  }

  // Con "generate" se crean los códigos de las mesas que todavía no tienen (las impresas no cambian)
  load(generate = false) {
    this.loading = true;
    this.qr.tables().subscribe({
      next: (view) => {
        this.view = view;
        const missing = view.tables.some((t) => !t.hasQr || (view.requirePin && !t.pin));
        if (generate && view.planIncluded && missing) {
          this.qr.generate().subscribe({ next: () => this.load(false), error: () => this.render(view) });
        } else {
          this.render(view);
        }
      },
      error: () => {
        this.loading = false;
        this.notify('No se pudieron cargar las mesas');
      },
    });
  }

  private async render(view: QrTablesView) {
    const base = this.cleanBase();
    this.cards = await Promise.all(
      view.tables
        .filter((t) => t.token)
        .map(async (t) => {
          const url = `${base}/mesa/${t.token}`;
          return { ...t, url, image: await QRCode.toDataURL(url, { width: 600, margin: 1, errorCorrectionLevel: 'M' }) };
        }),
    );
    this.loading = false;
  }

  get baseIsLocal(): boolean {
    return /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\./.test(this.baseUrl);
  }

  saveBase() {
    this.baseUrl = this.cleanBase();
    try {
      localStorage.setItem(BASE_KEY, this.baseUrl);
    } catch {}
    if (this.view) this.render(this.view);
  }

  copy(card: QrCard) {
    navigator.clipboard?.writeText(card.url).then(
      () => this.notify('Dirección copiada'),
      () => this.notify('No se pudo copiar'),
    );
  }

  regenerate(card: QrCard) {
    const ok = confirm(
      `¿Regenerar el QR de "${card.name}"?\n\nEl QR que ya está impreso y pegado en esa mesa va a dejar de funcionar y vas a tener que imprimir y pegar uno nuevo.`,
    );
    if (!ok || this.busy) return;
    this.busy = true;
    this.qr.regenerate(card.id).subscribe({
      next: () => {
        this.busy = false;
        this.notify(`QR de ${card.name} regenerado. Imprimí el nuevo.`);
        this.load(false);
      },
      error: (err) => {
        this.busy = false;
        this.notify(err?.error?.message || 'No se pudo regenerar el QR');
      },
    });
  }

  print(cards: QrCard[]) {
    if (cards.length === 0) return;
    const win = window.open('', '_blank', 'width=900,height=1000');
    if (!win) {
      this.notify('Tu navegador bloqueó la ventana de impresión. Permitila e intentá de nuevo.');
      return;
    }
    const esc = (t: string) => this.settings.escape(t);
    const s = this.settings.value;
    const logo = this.settings.absoluteLogoUrl();
    const sheets = cards
      .map(
        (c) => `
      <section class="card">
        ${logo ? `<img class="logo" src="${logo}" alt="">` : ''}
        <h1>${esc(s.name)}</h1>
        <p class="lead">Escaneá para ver la carta<br>y pedir desde tu celular</p>
        <img class="qr" src="${c.image}" alt="QR de ${esc(c.name)}">
        <p class="table">${esc(c.name)}</p>
        <p class="hint">Abrí la cámara de tu celular y apuntá al código</p>
      </section>`,
      )
      .join('');
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Códigos QR</title>
      <style>
        @page { size: A4; margin: 10mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Roboto, Arial, sans-serif; color: #1e2b24; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
        .card { border: 1.5px dashed #86958b; border-radius: 6mm; padding: 8mm 6mm; text-align: center; break-inside: avoid; page-break-inside: avoid; height: 135mm; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .logo { width: 22mm; height: 22mm; object-fit: cover; border-radius: 50%; margin-bottom: 3mm; }
        h1 { font-size: 17pt; margin: 0 0 3mm; }
        .lead { font-size: 11pt; margin: 0 0 4mm; color: #3b4a41; }
        .qr { width: 62mm; height: 62mm; }
        .table { font-size: 22pt; font-weight: 700; margin: 4mm 0 2mm; }
        .hint { font-size: 8.5pt; color: #6a7a70; margin: 0; }
        @media print { .card { border-color: #999; } }
      </style></head><body><div class="grid">${sheets}</div>
      <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };<\/script>
      </body></html>`);
    win.document.close();
  }

  private cleanBase(): string {
    return (this.baseUrl || this.appBase()).trim().replace(/\/+$/, '');
  }

  // Dirección de la app con la carpeta en la que está publicada (ej: https://usuario.github.io/coffe-manager)
  // y no solo el dominio: si no, los QR apuntarían a una página que no existe.
  private appBase(): string {
    const u = new URL(document.baseURI);
    return (u.origin + u.pathname).replace(/\/+$/, '');
  }

  private readBase(): string {
    try {
      return localStorage.getItem(BASE_KEY) ?? '';
    } catch {
      return '';
    }
  }

  private notify(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 3500 });
  }
}
