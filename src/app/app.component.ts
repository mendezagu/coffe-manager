import { Component, OnInit, ViewChild } from '@angular/core';
import { CoffeService, Table } from './models/coffe.service';
import { MatSidenav } from '@angular/material/sidenav';
import { DatePipe } from '@angular/common';
import { AppUser, ROLE_LABELS, UserService } from './services/user.service';
import { SettingsService } from './services/settings.service';
import { CashService } from './services/cash.service';
import { InventoryService, InventorySummary } from './services/inventory.service';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { GestionService } from './services/gestionService';
import { MatDialog } from '@angular/material/dialog';
import { QrCall, QrRequest, QrService } from './services/qr.service';
import { QrInboxDialogComponent } from './components/qr-inbox-dialog/qr-inbox-dialog.component';
import { OnboardingService } from './services/onboarding.service';
import { NavGuideService } from './services/nav-guide.service';

// Rutas que ve gente sin cuenta del restaurante
// (y el asistente de primeros pasos, que también va en pantalla completa, sin menú ni barra)
const PUBLIC_PREFIXES = ['/mesa/', '/hotel/', '/hotel-portal', '/bienvenida', '/cambiar-clave'];
export const isPublicPath = (url: string) => PUBLIC_PREFIXES.some((p) => url.split('?')[0].split('#')[0].startsWith(p));

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  showFiller = false;
  isLoggedIn: boolean = false;
  // Páginas públicas (cliente por QR, huésped y portal del hotel): nunca llevan el menú ni la barra del restaurante,
  // aunque en ese navegador haya una sesión del personal abierta
  publicPage = false;
  role$: Observable<string | null>;
  user$: Observable<AppUser | null>;
  roleLabels = ROLE_LABELS;

  // Variables para fecha y turno
  currentDate: string;
  shift: string;

    tables: any[] = [];
  menu: any[] = [];
  waiters: any[] = [];

  constructor(
    private datePipe: DatePipe,
    private userService: UserService,
    private router: Router,
    private gestionService: GestionService,
    public settings: SettingsService,
    public cash: CashService,
    private inventory: InventoryService,
    public qr: QrService,
    private dialog: MatDialog,
    public onboarding: OnboardingService,
    public nav: NavGuideService
  ) {
    this.currentDate = this.getFormattedDate();
    this.shift = this.settings.shiftLabel();
    this.settings.settings$.subscribe(() => {
      this.shift = this.settings.shiftLabel();
      this.refreshStock(); // por si se activó o desactivó el inventario
      this.refreshQrWatch(); // por si se activó o desactivó el pedido por QR
    });
    this.role$ = this.userService.getRoleState();
    this.user$ = this.userService.getAuthState();
  }

  private cashTimer?: ReturnType<typeof setInterval>;
  private setupTimer?: ReturnType<typeof setInterval>;

  // Aviso de insumos bajos o agotados (solo administrador, y solo si usa inventario)
  stock: InventorySummary | null = null;
  private isAdminRole = false;
  private stockTimer?: ReturnType<typeof setInterval>;

  // Pedidos por QR: el personal que atiende mesas recibe los pedidos y avisos de los clientes
  private qrRole: string | null = null;
  private refreshQrWatch() {
    const staff = this.qrRole === 'admin' || this.qrRole === 'cashier' || this.qrRole === 'waiter';
    this.qr.watch(staff && !!this.settings.value.qrActive);
  }

  // Ícono según el turno (mañana, tarde o noche)
  get shiftIcon(): string {
    return this.shift.includes('Mañana') ? 'light_mode' : this.shift.includes('Tarde') ? 'wb_twilight' : 'dark_mode';
  }

  userMenuOpen = false;

  // "Agustín Méndez" -> "AM"
  initials(name: string): string {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
  }

  // Avisos naranjas en pantalla cuando llega un pedido o un aviso de un cliente por QR
  qrAlerts: { id: string; title: string; detail: string; tableId: string; total?: number }[] = [];
  private qrAlertTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private pushQrAlerts(arrivals: { requests: QrRequest[]; calls: QrCall[] }) {
    const fresh = [
      ...arrivals.requests.map((r) => {
        const units = r.items.reduce((n, l) => n + l.quantity, 0);
        return {
          id: r.id,
          title: 'Nuevo pedido por QR',
          detail: `${r.tableName} · ${units} ${units === 1 ? 'ítem' : 'ítems'}${r.customerName ? ' · ' + r.customerName : ''}`,
          tableId: r.tableId,
          total: r.total,
        };
      }),
      ...arrivals.calls.map((c) => ({
        id: c.id,
        title: c.type === 'BILL' ? 'Piden la cuenta' : 'Llaman al mozo',
        detail: c.tableName,
        tableId: c.tableId,
      })),
    ];
    // Los más nuevos arriba; se muestran hasta 4 a la vez
    this.qrAlerts = [...fresh.reverse(), ...this.qrAlerts].slice(0, 4);
    for (const a of fresh) {
      this.qrAlertTimers.set(a.id, setTimeout(() => this.dismissQrAlert(a.id), 20000));
    }
  }

  trackAlert(_index: number, alert: { id: string }): string {
    return alert.id;
  }

  dismissQrAlert(id: string) {
    this.qrAlerts = this.qrAlerts.filter((a) => a.id !== id);
    const timer = this.qrAlertTimers.get(id);
    if (timer) clearTimeout(timer);
    this.qrAlertTimers.delete(id);
  }

  // "Atender": abre la bandeja de esa mesa para confirmar o rechazar el pedido
  attendQrAlert(alert: { id: string; tableId: string }) {
    this.dismissQrAlert(alert.id);
    this.dialog.open(QrInboxDialogComponent, { data: { tableId: alert.tableId }, width: '600px', maxWidth: '96vw', autoFocus: false });
  }

  openQrInbox() {
    this.dialog.open(QrInboxDialogComponent, { data: null, width: '600px', maxWidth: '96vw', autoFocus: false });
  }

  private refreshStock() {
    if (!this.isAdminRole || !this.settings.value.inventoryActive) {
      this.stock = null;
      return;
    }
    this.inventory.summary().subscribe({ next: (s) => (this.stock = s), error: () => {} });
  }

  ngOnInit() {
    this.qr.arrivals$.subscribe((a) => this.pushQrAlerts(a));
    // La caja la manejan administrador y cajero: se mantiene al día el indicador del encabezado
    this.userService.getRoleState().subscribe((role) => {
      this.isAdminRole = role === 'admin';
      // Mientras falten pasos obligatorios el menú lateral se acorta: se revisa cada tanto y al cambiar de pantalla
      if (this.setupTimer) clearInterval(this.setupTimer);
      if (this.isAdminRole) {
        this.onboarding.refreshPending();
        this.setupTimer = setInterval(() => {
          if (!this.publicPage) this.onboarding.refreshPending();
        }, 20000);
      }
      this.qrRole = role;
      this.refreshQrWatch();
      if (this.stockTimer) clearInterval(this.stockTimer);
      this.refreshStock();
      if (this.isAdminRole) this.stockTimer = setInterval(() => this.refreshStock(), 300000);

      if (this.cashTimer) clearInterval(this.cashTimer);
      if (role === 'admin' || role === 'cashier') {
        const refresh = () => this.cash.refresh().subscribe({ error: () => {} });
        refresh();
        this.cashTimer = setInterval(refresh, 60000);
      }
    });

    // Qué página se está viendo
    this.publicPage = isPublicPath(this.router.url);
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      this.publicPage = isPublicPath(e.urlAfterRedirects);
      if (this.isAdminRole && !this.publicPage) this.onboarding.refreshPending();
      this.nav.visited(e.urlAfterRedirects);
    });

    // Suscribirse a cambios en la autenticación
    this.userService.getAuthState().subscribe(user => {
      this.isLoggedIn = !!user; // Si hay usuario, true; si no, false
    });

    //NUEVOOOO

    
  }

  toggleSidenav() {
    this.sidenav.toggle();
  }

  // Método para obtener la fecha en formato DD/MM/YYYY
  getFormattedDate(): string {
    const now = new Date();
    return this.datePipe.transform(now, 'dd/MM/yyyy') || '';
  }

  // Método para determinar el turno según la hora actual
  getShift(): string {
    const hour = new Date().getHours(); // Obtiene la hora actual (0-23)

    if (hour >= 6 && hour < 12) {
      return 'Turno Mañana';
    } else if (hour >= 12 && hour < 18) {
      return 'Turno Tarde';
    } else {
      return 'Turno Noche';
    }
  }

  logout(){
    this.userService.logout();
    this.router.navigate(['/login']);
  }
}
