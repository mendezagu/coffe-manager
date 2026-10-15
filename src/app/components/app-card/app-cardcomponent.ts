import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MenuDialogComponent } from '../menu-dialog/menu-dialog.component';
import { OrderInfoDialogComponent } from '../order-info-dialog/order-info-dialog.component';
import { GestionService, MenuItem, Table, Waiter } from 'src/app/services/gestionService';
import { WaiterDialogComponent } from '../waiter-dialog/waiter-dialog.component';
import { TotalDialogComponent } from '../total-dialog/total-dialog.component';
import { LinkTableDialogComponent } from '../link-table-dialog/link-table-dialog.component';
import { Observable } from 'rxjs';
import { UserService } from 'src/app/services/user.service';
import { SettingsService } from 'src/app/services/settings.service';
import { modifiersText } from 'src/app/utils/modifiers';
import { QrInbox, QrService } from 'src/app/services/qr.service';
import { LiveSummary, ReportsService } from 'src/app/services/reports.service';
import { QrInboxDialogComponent } from '../qr-inbox-dialog/qr-inbox-dialog.component';
import { Subscription } from 'rxjs';

interface TableGroup {
  key: string;
  name: string | null;
  position?: number; // orden definido por el usuario en Administrar Mesas
  tables: Table[];
}

@Component({
  selector: 'app-card',
  templateUrl: './app-card.component.html',
  styleUrls: ['./app-card.component.scss']
})
export class CardComponent implements OnInit, OnDestroy {
  private refresh?: ReturnType<typeof setInterval>;
  tables: Table[] = [];
  searchText: string = '';
  // 'grouped': una sección por sector, con su título. 'flat': todas las mesas juntas en una sola grilla.
  viewMode: 'grouped' | 'flat' = 'grouped';
  selectedGroupKey: string | null = null; // sector elegido en las pestañas; null o '__all__' = todos
  statusFilter: 'all' | 'free' | 'busy' | 'qr' = 'all';
  waiters: Waiter[] = [];
   selectedItems: MenuItem[] = [];
   menuItems: MenuItem[] = [];
     role$: Observable<string | null>;
    roleValue: string | null = null;

  constructor(
    private gestionService: GestionService,
    private dialog: MatDialog,
    private userService: UserService,
    private snackBar: MatSnackBar,
    public settings: SettingsService,
    private qr: QrService,
    private reports: ReportsService,
  ) {
    this.role$ = this.userService.getRoleState();
  }

  ngOnInit(): void {
    this.restoreView();
    this.loadTables();
    // Refresca las mesas para que el mozo vea cuándo cocina marca algo como listo.
    this.refresh = setInterval(() => this.loadTables(), 10000);
    this.loadMenu(); // 📌 Cargar los ítems del menú al iniciar

     // Cargar los mozos al iniciar el componente
     this.gestionService.getWaiters().subscribe({
      next: (waiters) => {
        this.waiters = waiters;
        console.log(waiters,'LOS MOZOS dede HOME');
        
      },
      error: (error) => {
        console.error('Error al cargar los mozos:', error);
      }
    });

    // Pedidos y avisos QR por mesa (badge en la tarjeta)
    this.qrSub = this.qr.inbox$.subscribe((inbox) => (this.qrInbox = inbox));

    // Suscribirse al rol para uso en handlers sin pipes en templates
    this.role$.subscribe(role => {
      this.roleValue = role;
      // Ventas de hoy y permanencia: solo las ve el administrador
      if (this.liveTimer) clearInterval(this.liveTimer);
      this.live = null;
      if (role === 'admin') {
        this.loadLive();
        this.liveTimer = setInterval(() => this.loadLive(), 60000);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.refresh) clearInterval(this.refresh);
    if (this.liveTimer) clearInterval(this.liveTimer);
    this.qrSub?.unsubscribe();
  }

  private qrSub?: Subscription;

  // ---- Resumen del administrador ----
  live: LiveSummary | null = null;
  private liveTimer?: ReturnType<typeof setInterval>;

  // Las tarjetas ocupan todo el ancho. El administrador tiene cinco: en celular van de a dos y desde
  // pantallas medianas todas en una sola fila. Los demás roles tienen tres y siempre van en una fila.
  get summaryCardWidth(): string {
    return this.roleValue === 'admin' ? 'w-[calc(50%-4px)] lg:w-auto lg:flex-1' : 'flex-1';
  }

  // Con cinco tarjetas en una fila los íconos solo entran en pantallas grandes
  get summaryIconVisibility(): string {
    return this.roleValue === 'admin' ? 'hidden xl:flex' : 'hidden sm:flex';
  }

  loadLive(): void {
    this.reports.live().subscribe({ next: (l) => (this.live = l), error: () => {} });
  }

  // 45 -> "45 min"; 75 -> "1 h 15 min"
  stayText(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) return '—';
    if (minutes < 60) return `${minutes} min`;
    const m = minutes % 60;
    return m ? `${Math.floor(minutes / 60)} h ${m} min` : `${minutes / 60} h`;
  }
  qrInbox: QrInbox = { active: false, requests: [], calls: [] };

  qrRequestsOf(table: any): number {
    return this.qrInbox.requests.filter((r) => r.tableId === table.id).length;
  }

  // Mesa que espera atención del cliente: pedido por confirmar o aviso (mozo / cuenta)
  needsQrAttention(table: any): boolean {
    const calls = this.qrCallsOf(table);
    return this.qrRequestsOf(table) > 0 || calls.waiter || calls.bill;
  }

  qrCallsOf(table: any): { waiter: boolean; bill: boolean } {
    const calls = this.qrInbox.calls.filter((c) => c.tableId === table.id);
    return { waiter: calls.some((c) => c.type === 'WAITER'), bill: calls.some((c) => c.type === 'BILL') };
  }

  openQrInbox(table: any) {
    this.dialog
      .open(QrInboxDialogComponent, { data: { tableId: table.id }, width: '600px', maxWidth: '96vw', autoFocus: false })
      .afterClosed()
      .subscribe(() => this.loadTables()); // una confirmación abre la mesa
  }

  // Cantidad de líneas que cocina ya terminó y esperan ser servidas
  readyCount(table: any): number {
    return (table.orders || []).filter((o: any) => o.status === 'READY').length;
  }

  // Mesas filtradas por nombre (sin distinguir mayúsculas ni tildes)
  get filteredTables(): Table[] {
    const query = this.normalizeText(this.searchText);
    return this.tables.filter(table => {
      const matchesText =
        !query ||
        [table.name, table.sectorName, table.waiterId ? table.waiterName : ''].some(v => this.normalizeText(v).includes(query));
      return matchesText && this.matchesStatus(table);
    });
  }

  // Tono de la tarjeta: verde = libre, ámbar = tiene un pedido o aviso por QR esperando, rojo = ocupada
  toneOf(table: Table): 'green' | 'amber' | 'red' {
    if (this.needsQrAttention(table)) return 'amber';
    return this.isFree(table) ? 'green' : 'red';
  }

  // Las clases van completas (no armadas por partes) para que Tailwind las encuentre
  readonly toneStyles = {
    green: {
      card: 'bg-cafe-green-50 border-cafe-green-200',
      title: 'text-cafe-green-900',
      pill: 'bg-cafe-green-100 text-cafe-green-800',
      dot: 'bg-cafe-green-700',
      meta: 'text-cafe-green-700',
      metaIcon: 'text-cafe-green-400',
      strong: 'text-cafe-green-900',
      ring: 'ring-cafe-green-200',
      primary: 'bg-cafe-green-700 text-white hover:bg-cafe-green-800',
      secondary: 'bg-cafe-green-100 text-cafe-green-800 hover:bg-cafe-green-200',
      box: 'bg-cafe-green-100 text-cafe-green-900',
      boxLabel: 'text-cafe-green-700',
    },
    amber: {
      card: 'bg-cafe-amber-50 border-cafe-amber-300 ring-2 ring-cafe-amber-100',
      title: 'text-cafe-amber-900',
      pill: 'bg-cafe-amber-100 text-cafe-amber-800',
      dot: 'bg-cafe-amber-700',
      meta: 'text-cafe-amber-800',
      metaIcon: 'text-cafe-amber-500',
      strong: 'text-cafe-amber-900',
      ring: 'ring-cafe-amber-200',
      primary: 'bg-cafe-amber-700 text-white hover:bg-cafe-amber-800',
      secondary: 'bg-cafe-amber-100 text-cafe-amber-800 hover:bg-cafe-amber-200',
      box: 'bg-cafe-amber-100 text-cafe-amber-900',
      boxLabel: 'text-cafe-amber-800',
    },
    red: {
      card: 'bg-cafe-red-50 border-cafe-red-200',
      title: 'text-cafe-red-900',
      pill: 'bg-cafe-red-100 text-cafe-red-800',
      dot: 'bg-cafe-red-700',
      meta: 'text-cafe-red-700',
      metaIcon: 'text-cafe-red-400',
      strong: 'text-cafe-red-900',
      ring: 'ring-cafe-red-200',
      primary: 'bg-cafe-red-700 text-white hover:bg-cafe-red-800',
      secondary: 'bg-cafe-red-100 text-cafe-red-800 hover:bg-cafe-red-200',
      box: 'bg-cafe-red-100 text-cafe-red-900',
      boxLabel: 'text-cafe-red-700',
    },
  } as const;

  // Estilos de una mesa según su tono
  styleOf(table: Table) {
    return this.toneStyles[this.toneOf(table)];
  }

  isFree(table: Table): boolean {
    return !!table.available && !table.controlledBy;
  }

  private matchesStatus(table: Table): boolean {
    switch (this.statusFilter) {
      case 'free': return this.isFree(table);
      case 'busy': return !this.isFree(table);
      case 'qr': return this.needsQrAttention(table);
      default: return true;
    }
  }

  // ---- Resumen de arriba ----
  get freeCount(): number { return this.tables.filter(t => this.isFree(t)).length; }
  get busyCount(): number { return this.tables.length - this.freeCount; }
  get qrTablesCount(): number { return this.tables.filter(t => this.needsQrAttention(t)).length; }
  get occupancyPct(): number { return this.tables.length ? Math.round((this.busyCount / this.tables.length) * 100) : 0; }
  // Platos que cocina ya terminó y esperan ser servidos
  get readyTotal(): number { return this.tables.reduce((n, t) => n + this.readyCount(t), 0); }
  // Platos pedidos que todavía están en cocina o barra
  get cookingTotal(): number {
    return this.tables.reduce((n, t) => n + ((t.orders || []) as any[]).filter(o => o.status !== 'READY').length, 0);
  }
  // Pedidos y avisos de clientes esperando al personal
  get qrPendingTotal(): number { return this.qrInbox.requests.length + this.qrInbox.calls.length; }

  // Mesas ocupadas de un grupo (para el título de cada sector)
  occupiedIn(group: { tables: Table[] }): number {
    return group.tables.filter(t => !this.isFree(t)).length;
  }

  openAllQr(): void {
    this.dialog
      .open(QrInboxDialogComponent, { data: null, width: '600px', maxWidth: '96vw', autoFocus: false })
      .afterClosed()
      .subscribe(() => this.loadTables());
  }

  // Mesas agrupadas por sector (ordenadas por nombre) y, al final, las que no tienen sector.
  // Sin ningún sector creado devuelve un solo grupo sin título, o sea la grilla de siempre.
  get tableGroups(): TableGroup[] {
    const tables = this.filteredTables;
    if (tables.length === 0) return [];

    const bySector = new Map<string, TableGroup>();
    const withoutSector: Table[] = [];
    for (const table of tables) {
      if (table.sectorId && table.sectorName) {
        const group = bySector.get(table.sectorId) ?? {
          key: table.sectorId,
          name: table.sectorName,
          position: table.sectorPosition ?? 0,
          tables: [],
        };
        group.tables.push(table);
        bySector.set(table.sectorId, group);
      } else {
        withoutSector.push(table);
      }
    }

    // Sin ningún sector creado: una sola grilla sin título. (Se mira hasSectors y no solo el
    // filtro actual, para que una búsqueda que deja solo mesas sin sector siga mostrando "Sin sector".)
    if (!this.hasSectors) return [{ key: '__all__', name: null, tables }];

    const groups: TableGroup[] = Array.from(bySector.values())
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || (a.name ?? '').localeCompare(b.name ?? '', 'es'));
    if (withoutSector.length > 0) {
      groups.push({ key: '__none__', name: 'Sin sector', tables: withoutSector });
    }
    return groups;
  }

  // Hay al menos una mesa con sector: recién ahí tiene sentido elegir tipo de vista
  get hasSectors(): boolean {
    return this.tables.some(table => !!table.sectorId);
  }

  // Grupo de la pestaña activa; si el elegido ya no existe (ej. la búsqueda lo dejó vacío), el primero
  get activeGroupKey(): string {
    const key = this.selectedGroupKey;
    return key && this.tableGroups.some(g => g.key === key) ? key : '__all__';
  }

  // Vista conjunta: todos los sectores uno arriba del otro. Vista por sector: solo el de la pestaña activa.
  get visibleGroups(): TableGroup[] {
    let groups = this.tableGroups;
    // El sector elegido solo filtra en la vista por sector; en la vista conjunta se ven todas las mesas
    if (this.viewMode === 'grouped' && this.hasSectors && this.activeGroupKey !== '__all__') {
      groups = groups.filter(g => g.key === this.activeGroupKey);
    }
    // Vista conjunta: sin títulos de sector, todas las mesas en una sola grilla
    if (this.viewMode === 'flat' && groups.length > 0) {
      return [{ key: '__flat__', name: null, tables: groups.flatMap(g => g.tables) }];
    }
    return groups;
  }

  setViewMode(mode: 'grouped' | 'flat'): void {
    this.viewMode = mode;
    this.persistView('tablesViewMode', mode);
  }

  // Arrastrar las pestañas de sector con el mouse (con el dedo ya se desplazan solas)
  private dragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragStartScroll = 0;

  dragStart(event: MouseEvent, el: HTMLElement): void {
    this.dragging = true;
    this.dragMoved = false;
    this.dragStartX = event.pageX;
    this.dragStartScroll = el.scrollLeft;
  }

  dragMove(event: MouseEvent, el: HTMLElement): void {
    if (!this.dragging) return;
    const dx = event.pageX - this.dragStartX;
    // Un movimiento chico sigue siendo un clic; uno grande es un arrastre y no debe elegir el sector
    if (Math.abs(dx) > 5) this.dragMoved = true;
    if (this.dragMoved) el.scrollLeft = this.dragStartScroll - dx;
  }

  dragEnd(): void {
    this.dragging = false;
  }

  selectGroup(key: string): void {
    if (this.dragMoved) {
      this.dragMoved = false; // el clic que cierra un arrastre no elige nada
      return;
    }
    this.selectedGroupKey = key;
    this.persistView('tablesSelectedGroup', key);
  }

  // Recuerda la vista elegida entre sesiones; si el navegador bloquea el storage, simplemente no se guarda
  private persistView(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* sin persistencia */
    }
  }

  private restoreView(): void {
    try {
      const mode = localStorage.getItem('tablesViewMode');
      if (mode === 'grouped' || mode === 'flat') this.viewMode = mode;
      this.selectedGroupKey = localStorage.getItem('tablesSelectedGroup');
    } catch {
      /* sin persistencia */
    }
  }

  private normalizeText(value: string | undefined | null): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  loadMenu(): void {
    this.gestionService.getMenu().subscribe({
      next: (menu) => {
        this.menuItems = menu; // Guardar los ítems en la variable global
        console.log('Menú cargado:', this.menuItems);
      },
      error: (error) => console.error('Error al cargar el menú:', error),
    });
  }

  loadTables(): void {
    this.gestionService.getTables().subscribe((tables) => {
      console.log(tables,'LAS MESAS desde CARD');
      
      this.tables = tables.map((table) => {
        const waiter = this.waiters.find((w) => w._id === table.waiterId);
        return {
          ...table,
          waiterName: waiter ? waiter.name : 'No asignado',
          available: table.controlledBy ? false : table.available, // Ocupa las mesas vinculadas
          linkedTables: table.linkedTables || [] // Asegura que siempre haya un array
        };
      });
    });
  }

  // Método para abrir el diálogo de agregar ítems
addMenuItems(table: Table): void {
  if (table.waiterId) {
    // 👉 Ya tiene mozo asignado: ir directo al menú
    const menuDialogRef = this.dialog.open(MenuDialogComponent, {
      width: '400px',
      maxWidth: '95vw',
      data: {
        ...table,
        waiter: this.waiters.find(w => w._id === table.waiterId) || null
      }
    });

    menuDialogRef.afterClosed().subscribe((menu: any[]) => {
      if (menu && menu.length > 0) {
        this.gestionService.addItemsToTable(table.id, menu).subscribe(() => {
          this.loadTables();
        });
      }
    });

  } else {
    // 👉 No tiene mozo: primero asignar mozo, luego mostrar menú
    const waiterDialogRef = this.dialog.open(WaiterDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      height: 'auto',
      data: { table }
    });

    waiterDialogRef.afterClosed().subscribe(result => {
      if (result) {
        const { waiterId, waiterName } = result;

        this.gestionService.assignWaiterToTable(table.id, waiterId).subscribe({
          next: () => {
            table.waiterId = waiterId;
            table.waiterName = waiterName;

            const logMessage = `Se asignó el mozo <strong>${waiterName}</strong> a la mesa <strong>${table.name}</strong>`;
            this.gestionService.saveLog(logMessage);

            const menuDialogRef = this.dialog.open(MenuDialogComponent, {
              width: '400px',
              maxWidth: '95vw',
              data: {
                ...table,
                waiter: this.waiters.find(w => w._id === waiterId) || null
              }
            });

            menuDialogRef.afterClosed().subscribe((menu: any[]) => {
              if (menu && menu.length > 0) {
                this.gestionService.addItemsToTable(table.id, menu).subscribe(() => {
                  this.loadTables();
                });
              }
            });
          },
          error: (error) => {
            console.error('Error al asignar el mozo:', error);
            alert('No se pudo asignar el mozo. Inténtalo nuevamente.');
          }
        });
      }
    });
  }
}

  // Método para abrir el diálogo de información de la mesa
  openTableInfoDialog(table: Table): void {
    if (table && Array.isArray(table.orders)) {  // Validamos que orders sea un array
      const dialogRef = this.dialog.open(OrderInfoDialogComponent, {
        width: '500px',
        maxWidth: '95vw',
        data: table
      });
  
      dialogRef.afterClosed().subscribe(result => {
        this.loadTables();
      });
    } else {
      console.error('La mesa no tiene órdenes o es undefined:', table);
    }
  }
  openTotalDialog(table: Table): void {
    if (table && table.orders && table.orders.length > 0) {
      const dialogRef = this.dialog.open(TotalDialogComponent, {
        width: '450px',
        maxWidth: '95vw',
        panelClass: 'custom-dialog-container',
        data: { tableId: table.id,
            orders: table.orders,
            tableName: table.name,        // Asegúrate de pasar el nombre de la mesa
            waiterName: table.waiterName  }
      });
  
      dialogRef.afterClosed().subscribe(result => {
        this.loadLive(); // un cobro cambia las ventas de hoy
        if (result?.status === 'mesa_liberada') {
          console.log(`Mesa con ID ${result.tableId} liberada correctamente.`);
          
          // 🔄 Recargar las mesas si la mesa fue liberada
          this.loadTables();
        }
      });
    } else {
      console.warn('La mesa no tiene órdenes.');
    }
  }

  // Método para abrir el diálogo de asignación de mozo
openWaiterDialog(table: Table): void {
  const dialogRef = this.dialog.open(WaiterDialogComponent, {
    width: '500px',
    maxWidth: '95vw',
    data: { table }
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result) {
      const { waiterId, waiterName } = result;

      this.gestionService.assignWaiterToTable(table.id, waiterId).subscribe({
        next: (response) => {
          console.log('Mozo asignado correctamente:', response);

          table.waiterId = response.table.waiterId;
          table.waiterName = response.table.waiterName;

          // ✅ Guardar en logs
          const logMessage = `Se asignó el mozo <strong>${table.waiterName}</strong> a la mesa <strong>${table.name}</strong>`;
          this.gestionService.saveLog(logMessage);

          // Abre el diálogo de menú después de asignar el mozo
          const menuDialogRef = this.dialog.open(MenuDialogComponent, {
            width: '400px',
            maxWidth: '95vw',
            data: {
              ...table,
              waiter: this.waiters.find(w => w._id === table.waiterId) || null
            }
          });

          menuDialogRef.afterClosed().subscribe((menu: any[]) => {
            if (menu && menu.length > 0) {
              this.gestionService.addItemsToTable(table.id, menu).subscribe(() => {
                this.loadTables();
              });
            }
          });
        },
        error: (error) => {
          console.error('Error al asignar el mozo:', error);
          alert('No se pudo asignar el mozo. Inténtalo nuevamente.');
        }
      });
    }
  });
}


// Método para abrir el diálogo de vinculación de mesas
openLinkTablesDialog(table: Table): void {
  const dialogRef = this.dialog.open(LinkTableDialogComponent, {
    width: '400px',
    maxWidth: '95vw',
    data: { table }
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result) {
      this.gestionService.linkTables(table.id, result).subscribe({
        next: (response) => {
          console.log('Mesas vinculadas correctamente:', response);

          // 🔄 Actualizar directamente el estado de las mesas
          this.tables = this.tables.map((t) => {
            if (t.id === table.id) {
              return { ...t, linkedTables: result, available: false };
            } else if (result.includes(t.id)) {
              return { ...t, controlledBy: table.id, available: false };
            }
            return t;
          });
        },
        error: (error) => {
          console.error('Error al vincular las mesas:', error);
        }
      });
    }
  });
}

// Método para desvincular mesas
unlinkTables(table: Table): void {
  const linkedTableIds = table.linkedTables;
  this.gestionService.unlinkTables(table.id, linkedTableIds).subscribe({
    next: (response) => {
      console.log('Mesas desvinculadas correctamente:', response);
      this.loadTables(); // Recargar las mesas actualizadas
    },
    error: (error) => {
      console.error('Error al desvincular las mesas:', error);
    }
  });
}

// Obtener el nombre de una mesa por su ID
getTableNameById(tableId: string): string {
  const table = this.tables.find(t => t.id === tableId);
  return table ? table.name : 'Desconocida';
}

getControllingTableName(controlledById: string): string {
  const controllingTable = this.tables.find((t) => t.id === controlledById);
  return controllingTable ? controllingTable.name : 'Desconocida';
}

// Verificar si una mesa es la última en la lista de mesas vinculadas
isLastLinkedTable(linkedTables: string[], tableId: string): boolean {
  return linkedTables.indexOf(tableId) === linkedTables.length - 1;
}

printTicket(tableId: string): void {
  const table = this.tables.find(t => t.id === tableId);

  if (!table) {
    alert("Mesa no encontrada.");
    return;
  }

  if (!table.orders || table.orders.length === 0) {
    alert("No hay órdenes registradas para imprimir.");
    return;
  }

  // Obtener la fecha y la hora actual
  const formattedDate = new Date().toLocaleString();

  // Generar contenido del ticket con el nombre correcto de cada item
  const printContent = `
    <html>
      <head>
        <title>Ticket</title>
        <style>
          @page { size: 58mm landscape; margin: 0; }
          body { font-family: 'Courier New', monospace; font-size: 14px; font-weight: bold; margin: 0; padding: 0; text-align: left; }
          .ticket { width: 58mm; padding: 5px; }
          .header { text-align: left; margin-bottom: 5px; }
          .order-list { text-align: left; word-wrap: break-word; }
          .order-item { display: flex; justify-content: space-between; width: 100%; }
          .order-item p { margin: 0; padding-right: 5px; font-size: 18px; }
          .totals { margin-top: 5px; text-align: left; font-size: 18px; }
          .line { border-top: 1px dashed #000; margin: 3px 0; }
          .logo { text-align: center; margin-bottom: 10px; }
          .logo img { width: 70px; max-width: 58mm; height: auto; }
        </style>
      </head>
      <body>
        <div class="ticket">
          ${this.ticketLogoHtml()}
          <div class="header">
            <h2 style="font-size: 14px;">🍽️ ${this.ticketBusinessName()}</h2>
            <p style="font-size: 14px;">Mesa: <strong>${table.name}</strong></p>
            <p>Mozo: <strong>${table.waiterName || 'No asignado'}</strong></p>
            <p>${formattedDate}</p>
          </div>
          <div class="line"></div>
          <div class="order-list">
            ${table.orders.map(order => {
              // Buscar el nombre del producto en la lista de menú
              const menuItem = this.menuItems.find(item => item._id === order.menuItem);
              return `
                <div class="order-item">
                  <p>${menuItem ? menuItem.name : 'Producto desconocido'}</p>
                  <p>x${order.quantity}</p>
                </div>${this.modsLine(order)}
              `;
            }).join('')}
          </div>
          <div class="line"></div>
          <div class="totals">
            <p>Aclaración:</p>
            ${table.orders.filter(order => order.note).map(order => {
              const menuItem = this.menuItems.find(item => item._id === order.menuItem);
              return `<p>- ${menuItem ? menuItem.name : 'Producto desconocido'}: ${order.note}</p>`;
            }).join('') || '<p>-</p>'}
          </div>
          <div class="line"></div>
          <p style="text-align:center; font-size:8px;"><br></p>
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

  // Imprimir dos copias del ticket
  for (let i = 0; i < 2; i++) {
    const printWindow = window.open('', '', 'width=900,height=900');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      
    }
  }
    location.reload();
    // ✅ Guardar log de impresión
  const logMessage = `Se imprimió <strong>la comanda</strong> de la mesa <strong>${table.name}</strong> atendida por <strong>${table.waiterName || 'Sin asignar'}</strong>`;
  this.gestionService.saveLog(logMessage);
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

  // Opciones elegidas (ya escapadas) como renglón de la comanda impresa
  private modsLine(order: any): string {
    return order.modifiers?.length
      ? `<div style="font-size: 14px; margin-left: 8px">+ ${this.settings.escape(modifiersText(order.modifiers))}</div>`
      : '';
  }

  // Handler del botón Ordenar (evita usar pipes en template)
  orderButtonClicked(table: Table): void {
    this.addMenuItems(table);
  }

}
