// Plantilla única de los papeles que imprime la app (58 mm): la comanda (cocina/barra, sin precios) y la
// cuenta (lo que se le da al cliente). Son funciones puras: reciben datos ya listos y devuelven el HTML.
// Todo texto que viene de afuera (negocio, mesa, mozo, platos, aclaraciones) se escapa acá, en un solo lugar.

// Marca del negocio que se repite en todos los papeles
export interface TicketBrand {
  name: string;
  logoUrl: string | null; // ya absoluta: la ventana de impresión no resuelve rutas relativas
  headerLines: string[]; // datos fiscales y pie (solo los usa la cuenta)
}

// ---- Comanda ----
export interface ComandaLine {
  name: string;
  quantity: number;
  modifiers?: string; // opciones elegidas, ya en texto ("Con leche · Grande")
  note?: string;
}

export interface ComandaData {
  tableName: string;
  waiterName?: string | null;
  lines: ComandaLine[];
}

// ---- Cuenta ----
export interface CuentaSubLine {
  text: string;
  amount?: string;
}

export interface CuentaLine {
  name: string;
  suffix?: string; // "(PROMO)", "(10% off)"
  quantity: number;
  amount: string; // ya con formato de moneda
  mods?: CuentaSubLine[]; // extras con su importe
  discount?: CuentaSubLine; // renglón de descuento cuando el plato tiene extras
}

// Renglón del resumen: "Etiqueta: valor" (label + value) o una línea de texto suelta (text)
export interface CuentaRow {
  label?: string;
  value?: string;
  text?: string;
  bold?: boolean;
  big?: boolean; // tamaño grande (el total)
}

export interface CuentaData {
  tableName: string;
  waiterName: string;
  lines: CuentaLine[];
  summary: CuentaRow[];
}

export interface TicketOptions {
  // Fecha y hora impresas (por defecto, ahora)
  date?: Date;
}

export function escapeHtml(text: unknown): string {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const CSS = `
  @page { size: 58mm landscape; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 14px; font-weight: bold; margin: 0; padding: 0; text-align: left; }
  .ticket { width: 58mm; padding: 5px; }
  .header { text-align: left; margin-bottom: 5px; }
  .header h2 { font-size: 14px; }
  .order-list { text-align: left; word-wrap: break-word; }
  .order-item { display: flex; justify-content: space-between; width: 100%; }
  .order-item p { margin: 0; padding-right: 5px; }
  .totals { margin-top: 5px; text-align: left; }
  .line { border-top: 1px dashed #000; margin: 3px 0; }
  .logo { text-align: center; margin-bottom: 10px; }
  .logo img { width: 70px; max-width: 58mm; height: auto; }
  .spacer { text-align: center; font-size: 8px; }

  /* Comanda: letra grande para leerla de lejos */
  .comanda .order-item p, .comanda .totals { font-size: 18px; }
  .comanda .mods { font-size: 14px; margin-left: 8px; }

  /* Cuenta: letra más chica para que entre el detalle */
  .cuenta .header, .cuenta .order-list, .cuenta .totals { font-size: 14px; }
  .cuenta .title { margin-left: 4rem; }
  .cuenta .fiscal strong, .cuenta .foot, .cuenta .foot strong { font-size: 10px; }
  .cuenta .item p { font-size: 12px; }
  .cuenta .sub p { font-size: 11px; }
  .cuenta .sub p:first-child { margin-left: 6px; }
  .cuenta .big, .cuenta .big strong { font-size: 16px; }
`;

// Arma la página completa: estilo, contenido y el script que imprime y avisa a la pantalla de origen
function page(kind: 'comanda' | 'cuenta', inner: string): string {
  return `<html>
  <head>
    <meta charset="utf-8">
    <title>Ticket</title>
    <style>${CSS}</style>
  </head>
  <body>
    <div class="ticket ${kind}">
${inner}
    </div>
    <script>
      window.print();
      window.onafterprint = function() {
        window.close();
        window.opener.postMessage('closeDialog', '*');
      }
    </script>
  </body>
</html>`;
}

function logo(brand: TicketBrand): string {
  return brand.logoUrl ? `<div class="logo"><img src="${escapeHtml(brand.logoUrl)}" alt="Logo"></div>` : '';
}

function when(opts: TicketOptions): string {
  return escapeHtml((opts.date ?? new Date()).toLocaleString());
}

// Comanda: lo que hay que preparar. Sin precios.
export function buildComanda(data: ComandaData, brand: TicketBrand, opts: TicketOptions = {}): string {
  const e = escapeHtml;
  const items = data.lines
    .map((l) => {
      const mods = l.modifiers ? `<div class="mods">+ ${e(l.modifiers)}</div>` : '';
      return `      <div class="order-item"><p>${e(l.name)}</p><p>x${e(l.quantity)}</p></div>${mods}`;
    })
    .join('\n');
  const notes =
    data.lines
      .filter((l) => l.note)
      .map((l) => `<p>- ${e(l.name)}: ${e(l.note)}</p>`)
      .join('') || '<p>-</p>';

  return page(
    'comanda',
    `      ${logo(brand)}
      <div class="header">
        <h2>🍽️ ${e(brand.name.toUpperCase())}</h2>
        <p>Mesa: <strong>${e(data.tableName)}</strong></p>
        <p>Mozo: <strong>${e(data.waiterName?.trim() || 'No asignado')}</strong></p>
        <p>${when(opts)}</p>
      </div>
      <div class="line"></div>
      <div class="order-list">
${items}
      </div>
      <div class="line"></div>
      <div class="totals">
        <p>Aclaración:</p>
        ${notes}
      </div>
      <div class="line"></div>
      <p class="spacer"><br></p>`
  );
}

// Cuenta: el detalle con precios, el total y los pagos, para el cliente.
export function buildCuenta(data: CuentaData, brand: TicketBrand, opts: TicketOptions = {}): string {
  const e = escapeHtml;
  const sub = (s: CuentaSubLine) => `      <div class="order-item sub"><p>${e(s.text)}</p><p>${e(s.amount ?? '')}</p></div>`;
  const items = data.lines
    .map((l) => {
      const name = [l.name, l.suffix?.trim()].filter(Boolean).join(' ');
      return [
        `      <div class="order-item item"><p>${e(name)}</p><p>x${e(l.quantity)}</p><p>${e(l.amount)}</p></div>`,
        ...(l.mods ?? []).map(sub),
        ...(l.discount ? [sub(l.discount)] : []),
      ].join('\n');
    })
    .join('\n');

  const rows = data.summary
    .map((r) => {
      if (r.label !== undefined) return `<p${r.big ? ' class="big"' : ''}><strong>${e(r.label)}</strong> ${e(r.value ?? '')}</p>`;
      return r.bold ? `<p><strong>${e(r.text)}</strong></p>` : `<p>${e(r.text)}</p>`;
    })
    .join('\n        ');

  const fiscal = brand.headerLines.map((l) => `<p class="fiscal"><strong>${e(l)}</strong></p>`).join('');

  return page(
    'cuenta',
    `      ${logo(brand)}
      <div class="header">
        <h2 class="title">${e(brand.name.toUpperCase())}</h2>
        <div class="line"></div>
        ${fiscal}
        <div class="line"></div>
        <p>${when(opts)}</p>
      </div>
      <div class="order-list">
${items}
      </div>
      <div class="line"></div>
      <div class="totals">
        ${rows}
      </div>
      <div class="line"></div>
      <p class="foot"><strong>Nro de mesa:</strong> ${e(data.tableName)}</p>
      <p class="foot"><strong>Atendido por:</strong> ${e(data.waiterName)}</p>
      <div class="line"></div>`
  );
}
