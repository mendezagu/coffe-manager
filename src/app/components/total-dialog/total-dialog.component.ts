import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GestionService } from 'src/app/services/gestionService';
import { SettingsService } from 'src/app/services/settings.service';
import { UserService } from 'src/app/services/user.service';
import { CashService } from 'src/app/services/cash.service';
import { PaymentValue } from '../payment-panel/payment-panel.component';
import { modifiersText, modifiersTotal } from 'src/app/utils/modifiers';
import { TicketService } from 'src/app/services/ticket.service';
import { CuentaLine, CuentaRow } from 'src/app/utils/ticket-html';
import { CheckedVoucher, HotelsService, apiMessage } from 'src/app/services/hotels.service';

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
  // Voucher de hotel (uno por mesa): fija el descuento y no se combina con descuentos manuales
  voucherInput = '';
  voucher: CheckedVoucher | null = null;
  voucherError = '';
  voucherChecking = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<TotalDialogComponent>,
    private gestionService: GestionService,
    public settings: SettingsService,
    private userService: UserService,
    private cash: CashService,
    private tickets: TicketService,
    private hotels: HotelsService
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

  // ---- voucher de hotel ----

  // Los descuentos manuales (general y por plato) se bloquean mientras haya un voucher
  get manualDiscountAllowed(): boolean {
    return this.canDiscount && !this.voucher;
  }

  applyVoucher() {
    const code = this.voucherInput.trim();
    if (!code || this.voucherChecking) return;
    this.voucherError = '';
    this.voucherChecking = true;
    this.hotels.validate(code).subscribe({
      next: (v) => {
        this.voucherChecking = false;
        // El voucher reemplaza cualquier descuento manual que hubiera
        this.orders.forEach((o) => (o.discount = 0));
        this.voucher = v;
        this.voucherInput = '';
        this.discountPercentage = v.discountPct;
        this.calculateTotal();
      },
      error: (err) => {
        this.voucherChecking = false;
        this.voucherError = apiMessage(err, 'No se pudo revisar el voucher. Probá de nuevo.');
      },
    });
  }

  removeVoucher() {
    this.voucher = null;
    this.voucherError = '';
    this.discountPercentage = 0;
    this.calculateTotal();
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
    const items = this.voucher
      ? []
      : this.chargeLines
      .filter((o) => !o.isPromo && Number(o.discount) > 0)
      .map((o) => ({ orderId: o._id, discount: Number(o.discount) }));

    this.gestionService
      .checkout(this.data.tableId, {
        checkoutId: this.orderId,
        payments: this.payment.payments,
        tip: this.payment.tip,
        // con voucher, el servidor fija el descuento: no se manda uno manual
        globalDiscount: this.voucher ? 0 : this.discountPercentage,
        voucherCode: this.voucher?.code,
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
            // La pantalla de mesas se actualiza al cerrarse el diálogo (y por el aviso en vivo del servidor)
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
  private paymentRows(): CuentaRow[] {
    const p = this.payment;
    const fmt = (n: number) => this.settings.format(n);
    const labels: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'QR', tarjeta: 'Tarjeta' };
    const rows: CuentaRow[] = [];
    if (this.partial && !this.partialIsFull) rows.push({ text: 'Cuenta dividida: esta es una parte', bold: true });
    if (!p) return rows;
    if (p.tip > 0) {
      rows.push({ label: 'Propina:', value: fmt(p.tip) });
      rows.push({ label: 'Total a pagar:', value: fmt(p.due), big: true });
    }
    for (const x of p.payments) rows.push({ text: `${labels[x.method] ?? x.method}: ${fmt(x.amount)}` });
    if (p.change > 0) rows.push({ label: 'Vuelto:', value: fmt(p.change) });
    return rows;
  }

  printTicket(): void {
    // Un ticket con un pago que no cubre la cuenta mostraría importes que no se van a cobrar
    if (this.payment && !this.payment.printable) return;
    const tableName = this.tableName;
    const waiterName = this.waiterName;
    this.isTicketPrinted = true;
    const fmt = (n: number) => this.settings.format(n);

    // Un renglón por plato. Con extras, el plato muestra su precio base y cada extra su propio importe; el
    // descuento va en un renglón aparte. Así los renglones de la línea suman lo que se cobra.
    const lines: CuentaLine[] = this.orders
      .filter((order) => order.quantity > 0)
      .map((order) => {
        const qty = order.quantity ?? 1;
        const itemDiscount = order.isPromo ? 0 : Number(order.discount) || 0;
        const grossLine = order.price * qty;
        const discountedSubtotal = grossLine * (1 - itemDiscount / 100);
        const mods: any[] = order.modifiers ?? [];
        const itemAmount = mods.length ? (order.basePrice ?? order.price) * qty : discountedSubtotal;
        const suffix = `${order.isPromo ? '(PROMO)' : ''} ${itemDiscount > 0 && !mods.length ? `(${itemDiscount}% off)` : ''}`.trim();
        return {
          name: order.name,
          suffix,
          quantity: qty,
          amount: fmt(itemAmount),
          mods: mods.map((m) => ({
            text: `+ ${m.name}${qty > 1 && m.priceDelta ? ` x${qty}` : ''}`,
            amount: m.priceDelta ? `${m.priceDelta > 0 ? '+' : '-'}${fmt(Math.abs(m.priceDelta * qty))}` : '',
          })),
          discount:
            mods.length && itemDiscount > 0
              ? { text: `Desc. ${itemDiscount}%`, amount: `-${fmt(grossLine - discountedSubtotal)}` }
              : undefined,
        };
      });

    const summary: CuentaRow[] = [{ label: 'Total:', value: fmt(this.total), big: true }];
    if (this.discountPercentage > 0) {
      const what = this.voucher ? `Voucher ${this.voucher.hotelName}` : 'Descuento';
      summary.push({ label: `${what} (${this.discountPercentage}%${this.hasPromoItems ? ' sin promos' : ''}):`, value: `-${fmt(this.globalDiscountAmount)}` });
      summary.push({ label: 'Total con descuento:', value: fmt(this.discountedTotal) });
    }
    summary.push(...this.paymentRows());

    // Ticket impreso con la plantilla única (TicketService)
    this.tickets.printCuenta(
      { tableName: String(tableName ?? ''), waiterName: String(waiterName ?? ''), lines, summary },
      { windowSize: 'width=600,height=400' }
    );
    // ✅ Guardar log de impresión
    const logMessage = `Se imprimió <strong>el ticket final</strong> de la mesa <strong>${tableName}</strong> atendida por <strong>${
      waiterName || 'Sin asignar'
    }</strong>`;
    this.gestionService.saveLog(logMessage);
  }
}
