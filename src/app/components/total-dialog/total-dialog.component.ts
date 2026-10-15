import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GestionService } from 'src/app/services/gestionService';
import { SettingsService } from 'src/app/services/settings.service';
import { UserService } from 'src/app/services/user.service';
import { CashService } from 'src/app/services/cash.service';
import { PaymentValue } from '../payment-panel/payment-panel.component';
import { modifiersText, modifiersTotal } from 'src/app/utils/modifiers';

@Component({
  selector: 'app-total-dialog',
  templateUrl: './total-dialog.component.html',
  styleUrls: ['./total-dialog.component.scss'],
})
export class TotalDialogComponent implements OnInit {
      // Generar un orderId único al abrir el diálogo
      orderId: string = '';
    isProcessing: boolean = false;
  total: number = 0;
  discountedTotal: number = 0;
  discountableTotal: number = 0;
  promoTotal: number = 0;
  globalDiscountAmount: number = 0;
  discountPercentage: number = 0;
  orders: any[] = [];
  table: any = {};
  tableName: string = ''; // Nueva propiedad para almacenar el nombre de la mesa
  waiterName: string = ''; // Nueva propiedad para almacenar el nombre del mozo
  isTicketPrinted: boolean = false;
  isAdmin = false;
  canDiscount = false; // administrador, o cajero si el negocio lo habilitó
  modifiersText = modifiersText;
  // Cómo se paga (lo arma el panel de pago): propina, pagos y vuelto
  payment: PaymentValue | null = null;
  // Cobrar solo una parte de la mesa (división de cuenta por platos)
  partial = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<TotalDialogComponent>,
    private gestionService: GestionService,
    public settings: SettingsService,
    private userService: UserService,
    private cash: CashService
  ) {
    // El administrador aplica descuentos; el cajero solo si el negocio lo habilitó (el servidor también lo exige)
    const role = this.userService.currentRole();
    this.isAdmin = role === 'admin';
    this.canDiscount = this.isAdmin || (role === 'cashier' && !!this.settings.value.cashierDiscounts);
    // Se trabaja sobre copias: elegir cuánto cobrar no debe tocar la mesa que se ve de fondo
    this.orders = (data.orders || []).map((o: any) => ({ ...o, maxQuantity: o.quantity }));
    this.table = data.table || [];
    this.tableName = data.tableName || '';
    this.waiterName = data.waiterName || '';
    // Identifica este cobro: si se reintenta (doble toque, corte de red) el servidor no lo duplica
    this.orderId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.calculateTotal();
  }

  ngOnInit(): void {
    console.log('Nombre de la mesa:', this.tableName); // Muestra el nombre de la mesa
    console.log('Nombre del mozo:', this.waiterName); // Muestra el nombre del mozo
    this.printMenuItems();
    console.log(this.orders, 'ORDENES EN TOTAL');
    console.log(this.table, 'TABLESS');
    this.getTable();
    this.cash.refresh().subscribe({ error: () => {} });
  }

  getTable(): void {
    this.gestionService.getTables().subscribe((tables) => {
      const table = tables.find((table) => table.id === this.data.tableId);
      if (table) {
        this.table = table;
        console.log('Datos de la mesa:', table);
      } else {
        console.warn('No se encontró la mesa.');
      }
    });
  }

  printMenuItems(): void {
    let pricesAssignedCount = 0;

    this.orders.forEach((order) => {
      if (order && order.menuItem && order.quantity !== undefined) {
        this.gestionService.getMenu().subscribe((menuItems) => {
          const menuItem = menuItems.find(
            (item) => item._id === order.menuItem
          );
          if (menuItem) {
            order.name = menuItem.name;
            // precio de una unidad: el del plato + lo que sumaron las opciones elegidas
            order.price = menuItem.price + modifiersTotal(order.modifiers);
            // precio del plato solo (sin extras): es lo que se muestra en su renglón
            order.basePrice = menuItem.price;
            order.isPromo = !!menuItem.isPromo;
            // Los ítems en promo no admiten descuento (ni por ítem ni general)
            order.discount = order.isPromo ? 0 : (order.discount ?? 0); // descuento por ítem (porcentaje)
          } else {
            order.name = 'No encontrado';
            order.price = 0;
            order.isPromo = false;
            order.discount = order.discount ?? 0;
          }

          pricesAssignedCount++;

          if (pricesAssignedCount === this.orders.length) {
            this.calculateTotal();
          }
        });
      }
    });
  }

  calculateTotal() {
    if (this.orders.length === 0) {
      console.warn('No hay órdenes disponibles.');
      this.total = 0;
      this.discountableTotal = 0;
      this.promoTotal = 0;
      this.globalDiscountAmount = 0;
      this.discountedTotal = 0;
      return;
    }

    console.log('Datos de las órdenes:');
    this.orders.forEach((order) => {
      console.log(
        `Producto: ${order.name}, Cantidad: ${order.quantity || 1}, Precio: ${
          order.price
        }`
      );
    });

    // Total antes de aplicar el descuento global: ya incluye descuentos por ítem
    this.total = 0;
    this.discountableTotal = 0; // parte del total sobre la que aplica el descuento global (sin promos)
    this.promoTotal = 0; // parte del total correspondiente a promos (nunca lleva descuento)
    this.orders.forEach((item) => {
      const qty = item.quantity ?? 1;
      // Las promos nunca llevan descuento por ítem, aunque tengan un valor cargado
      const itemDiscount = item.isPromo ? 0 : Number(item.discount) || 0;
      const subtotal = item.price * qty * (1 - itemDiscount / 100);
      this.total += subtotal;
      if (item.isPromo) {
        this.promoTotal += subtotal;
      } else {
        this.discountableTotal += subtotal;
      }
    });

    this.calculateDiscountedTotal();
  }

  applyDiscount(discount: number) {
    this.discountPercentage = discount;
    this.calculateDiscountedTotal();
  }

  calculateDiscountedTotal() {
    // Primero se consideran los descuentos por ítem (ya en `this.total`),
    // luego se aplica un posible descuento global adicional
    // El descuento global solo aplica a los ítems que no son promo
    this.globalDiscountAmount = (this.discountableTotal * this.discountPercentage) / 100;
    this.discountedTotal = this.total - this.globalDiscountAmount;
  }

  get hasPromoItems(): boolean {
    return this.orders.some((order) => order.isPromo);
  }

  // ---- cobrar solo una parte (división por platos) ----

  // Platos que entran en este cobro (cantidad > 0)
  get chargeLines(): any[] {
    return this.orders.filter((o) => o.quantity > 0);
  }

  get partialIsFull(): boolean {
    return this.orders.every((o) => o.quantity === o.maxQuantity);
  }

  // Lo que queda en la mesa (todavía sin cobrar) mientras se arma esta parte
  get remainingLines(): any[] {
    return this.orders.filter((o) => o.maxQuantity - o.quantity > 0);
  }

  // Valor de lo que queda en la mesa, a precio de lista (sin descuentos)
  get remainingTotal(): number {
    return this.orders.reduce((sum, o) => sum + (o.price || 0) * (o.maxQuantity - o.quantity), 0);
  }

  // Pasa unidades de "queda en la mesa" a "esta parte"
  addToPart(order: any, count = 1) {
    this.stepQuantity(order, count);
  }

  setPartial(on: boolean) {
    this.partial = on;
    // Al dividir se empieza sin platos elegidos: se marca lo de cada persona. Al volver, todo.
    this.orders.forEach((o) => (o.quantity = on ? 0 : o.maxQuantity));
    this.calculateTotal();
  }

  stepQuantity(order: any, delta: number) {
    order.quantity = Math.max(0, Math.min(order.maxQuantity, (order.quantity ?? 0) + delta));
    this.calculateTotal();
  }

  selectAll() {
    this.orders.forEach((o) => (o.quantity = o.maxQuantity));
    this.calculateTotal();
  }

  selectNone() {
    this.orders.forEach((o) => (o.quantity = 0));
    this.calculateTotal();
  }

  // ---- caja y cobro ----

  // El negocio exige caja abierta y no hay una
  get cashBlocked(): boolean {
    const state = this.cash.value;
    return !!state && state.requireOpenRegister && !state.open;
  }

  get canCharge(): boolean {
    return (
      !this.cashBlocked &&
      !!this.payment?.valid &&
      this.chargeLines.length > 0 &&
      (this.discountedTotal > 0 || (this.payment?.due ?? 0) === 0)
    );
  }

  get chargeLabel(): string {
    return this.partial && !this.partialIsFull ? 'Cobrar esta parte' : 'Liberar Mesa';
  }

  liberarMesa() {
    if (this.isProcessing || !this.canCharge || !this.payment) return;
    if (!this.data.tableId) {
      console.error('No se pudo liberar la mesa: ID de la mesa no encontrado.');
      return;
    }
    this.isProcessing = true;
    const tableName = this.data.tableName || this.tableName || 'Mesa sin nombre';
    const waiterName = this.data.waiterName || this.waiterName || 'Sin mozo asignado';
    const isPartPayment = this.partial && !this.partialIsFull;

    // Cobrar y liberar es UNA sola llamada: o se guarda la venta y se descuentan los platos, o no pasa nada.
    // Solo se informan los descuentos pedidos y cómo se paga; el total lo calcula y guarda el servidor.
    const items = this.chargeLines
      .filter((o) => !o.isPromo && Number(o.discount) > 0)
      .map((o) => ({ orderId: o._id, discount: Number(o.discount) }));

    this.gestionService
      .checkout(this.data.tableId, {
        checkoutId: this.orderId,
        payments: this.payment.payments,
        tip: this.payment.tip,
        globalDiscount: this.discountPercentage,
        items,
        lines: isPartPayment ? this.chargeLines.map((o) => ({ orderId: o._id, quantity: o.quantity })) : undefined,
      })
      .subscribe({
        next: (sale) => {
          const logMessage = isPartPayment
            ? `Se cobró una parte de la mesa <strong>${tableName}</strong> atendida por <strong>${waiterName}</strong> por <strong>${this.settings.format(sale.totalAmount)}</strong> (la mesa sigue abierta)`
            : `Se liberó la mesa <strong>${tableName}</strong> atendida por <strong>${waiterName}</strong> con un total de <strong>${this.settings.format(sale.totalAmount)}</strong>`;
          this.gestionService.saveLog(logMessage);

          setTimeout(() => {
            this.dialogRef.close({
              status: isPartPayment ? 'parte_cobrada' : 'mesa_liberada',
              tableId: this.data.tableId,
            });
            location.reload();
            this.isProcessing = false;
          }, 1500); // Espera 1.5 segundos para mostrar el spinner y el texto
        },
        error: (error) => {
          console.error('Error al cobrar la mesa:', error);
          const msg = error?.error?.message;
          alert(
            (Array.isArray(msg) ? msg.join('. ') : msg) ||
              'No se pudo cobrar la mesa. Revisá la conexión e intentá de nuevo: no se registró ningún cobro.'
          );
          this.cash.refresh().subscribe({ error: () => {} }); // por si el motivo fue una caja cerrada
          this.isProcessing = false;
        },
      });
  }

  // Propina, total a pagar, medios de pago y vuelto del ticket (según lo elegido en el panel de pago)
  private ticketPaymentHtml(): string {
    const p = this.payment;
    const fmt = (n: number) => this.settings.format(n);
    const labels: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'QR', tarjeta: 'Tarjeta' };
    const rows: string[] = [];
    if (this.partial && !this.partialIsFull) rows.push('<p><strong>Cuenta dividida: esta es una parte</strong></p>');
    if (!p) return rows.join('');
    if (p.tip > 0) {
      rows.push(`<p><strong>Propina:</strong> ${fmt(p.tip)}</p>`);
      rows.push(`<p style="font-size: 16px"><strong style="font-size: 16px">Total a pagar:</strong> ${fmt(p.due)}</p>`);
    }
    for (const x of p.payments) rows.push(`<p>${labels[x.method] ?? x.method}: ${fmt(x.amount)}</p>`);
    if (p.change > 0) rows.push(`<p><strong>Vuelto:</strong> ${fmt(p.change)}</p>`);
    return rows.join('');
  }

  // Logo del negocio para las ventanas de impresión (vacío si no tiene)
  private ticketLogoHtml(): string {
    const logo = this.settings.absoluteLogoUrl();
    return logo ? `<div class="logo"><img src="${logo}" alt="Logo"></div>` : '';
  }

  // Nombre del negocio ya escapado para meterlo en HTML
  private ticketBusinessName(): string {
    return this.settings.escape(this.settings.value.name.toUpperCase());
  }

  printTicket(): void {
    // Un ticket con un pago que no cubre la cuenta mostraría importes que no se van a cobrar
    if (this.payment && !this.payment.valid) return;
    // Suponiendo que tienes el nombre de la mesa y el nombre del mozo disponibles
    const tableName = this.tableName; // Aquí debes usar la variable que contiene el nombre de la mesa
    const waiterName = this.waiterName; // Aquí debes usar la variable que contiene el nombre del mozo
    this.isTicketPrinted = true;
    const printContent = `
      <html>
        <head>
          <title>Ticket</title>
          <style>
            @page { size: 58mm landscape; margin: 0; }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 14px;
              font-weight: bold;
              margin: 0;
              padding: 0;
              text-align: left;
            }
            .ticket { width: 58mm; padding: 5px; }
            .header { text-align: left; margin-bottom: 5px; font-size: 14px; }
            .order-list { text-align: left; word-wrap: break-word; font-size: 14px; }
            .order-item { display: flex; justify-content: space-between; width: 100%; }
            .order-item p { margin: 0; padding-right: 5px; }
            .totals { margin-top: 5px; text-align: left; font-size: 14px; }
            .line { border-top: 1px dashed #000; margin: 3px 0; }
            .logo { text-align: center; margin-bottom: 10px; }
            .logo img { width: 70px; height: auto; max-width: 58mm; }
          </style>
        </head>
        <body>
          <div class="ticket">
            ${this.ticketLogoHtml()}
            <div class="header">
              <h2 style="font-size: 14px; margin-left: 4rem">${this.settings.escape(this.settings.value.name.toUpperCase())}</h2>
              <div class="line"></div>
              ${this.settings
                .ticketHeaderLines()
                .map((line) => `<p><strong style="font-size: 10px;">${this.settings.escape(line)}</strong></p>`)
                .join('')}
              <div class="line"></div>
              <p>${new Date().toLocaleString()}</p>
            </div>
            <div class="order-list">
              ${this.orders
                .filter((order) => order.quantity > 0)
                .map((order) => {
                  const qty = order.quantity ?? 1;
                  const itemDiscount = order.isPromo ? 0 : Number(order.discount) || 0;
                  const grossLine = order.price * qty;
                  const discountedSubtotal = grossLine * (1 - itemDiscount / 100);
                  const mods: any[] = order.modifiers ?? [];
                  const fmt = (n: number) => this.settings.format(n);
                  // Con extras, el plato muestra su precio base y cada extra su propio importe; el descuento
                  // va en un renglón aparte. Así los renglones de la línea suman lo que se cobra.
                  const itemAmount = mods.length ? (order.basePrice ?? order.price) * qty : discountedSubtotal;
                  const nameSuffix = `${order.isPromo ? '(PROMO)' : ''} ${itemDiscount > 0 && !mods.length ? `(${itemDiscount}% off)` : ''}`;
                  const modLines = mods
                    .map(
                      (m) => `<div class="order-item">
                        <p style="font-size: 11px; margin-left: 6px">+ ${this.settings.escape(m.name)}${qty > 1 && m.priceDelta ? ` x${qty}` : ''}</p>
                        <p style="font-size: 11px">${m.priceDelta ? `${m.priceDelta > 0 ? '+' : '-'}${fmt(Math.abs(m.priceDelta * qty))}` : ''}</p>
                      </div>`
                    )
                    .join('');
                  const discountLine =
                    mods.length && itemDiscount > 0
                      ? `<div class="order-item">
                        <p style="font-size: 11px; margin-left: 6px">Desc. ${itemDiscount}%</p>
                        <p style="font-size: 11px">-${fmt(grossLine - discountedSubtotal)}</p>
                      </div>`
                      : '';
                  return `
                    <div class="order-item">
                      <p style="font-size: 12px">${order.name} ${nameSuffix}</p>
                      <p style="font-size: 12px">x${qty}</p>
                      <p style="font-size: 12px">${fmt(itemAmount)}</p>
                    </div>${modLines}${discountLine}
                  `;
                })
                .join('')}
            </div>
            <div class="line"></div>
            <div class="totals">
              <p style="font-size: 16px"><strong style="font-size: 16px">Total:</strong> ${this.settings.format(this.total)}</p>
              ${
                this.discountPercentage > 0
                  ? `<p><strong>Descuento (${
                      this.discountPercentage
                    }%${this.hasPromoItems ? ' sin promos' : ''}):</strong> -${this.settings.format(this.globalDiscountAmount)}</p>
                     <p><strong>Total con descuento:</strong> ${this.settings.format(this.discountedTotal)}</p>`
                  : ''
              }
              ${this.ticketPaymentHtml()}
            </div>
            <div class="line"></div>
             <!-- Aquí agregamos el nombre de la mesa y del mozo -->
              <p style="font-size: 10px"><strong style="font-size: 10px">Nro de mesa:</strong> ${tableName}</p>
              <p style="font-size: 10px"><strong style="font-size: 10px">Atendido por:</strong> ${waiterName}</p>
               <div class="line"></div>
          </div>
          <script>
            window.print();
            window.onafterprint = function() {
              window.close();
              window.opener.postMessage('closeDialog', '*');
            }
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '', 'width=600,height=400');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
    }
    // ✅ Guardar log de impresión
    const logMessage = `Se imprimió <strong>el ticket final</strong> de la mesa <strong>${tableName}</strong> atendida por <strong>${
      waiterName || 'Sin asignar'
    }</strong>`;
    this.gestionService.saveLog(logMessage);
  }
}
