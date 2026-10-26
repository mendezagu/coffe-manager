import { Injectable } from '@angular/core';
import { OnboardingService } from './onboarding.service';
import { UserService } from './user.service';

export interface NavInfo {
  title: string;
  text: string;
}

// Qué hace cada sección del menú lateral, en una o dos frases (se ve al tocar la ayuda de un ítem nuevo)
export const NAV_INFO: Record<string, NavInfo> = {
  reservations: { title: 'Reservas', text: 'Las reservas del día y la lista de espera. Tus clientes reservan desde una página propia y vos las ves acá.' },
  counter: { title: 'Mostrador', text: 'Vendé y cobrá al instante, sin mesa: ideal para cafés al paso y pedidos para llevar.' },
  caja: { title: 'Caja', text: 'Abrila al empezar el día con el efectivo inicial y cerrala al terminar. Sin caja abierta no se puede cobrar.' },
  kitchen: { title: 'Cocina', text: 'Pantalla donde la cocina ve los pedidos y los marca como en preparación o listos.' },
  balance: { title: 'Balance', text: 'Lo que vendiste: totales por día, por turno y por forma de pago.' },
  reports: { title: 'Reportes', text: 'Ventas por fecha, producto y mozo, para ver qué se vende más y cómo viene el negocio.' },
  inventory: { title: 'Inventario', text: 'Controlá el stock de insumos y las recetas de cada plato.' },
  admin: { title: 'Administrar', text: 'Acá cargás y editás tus mesas, platos, categorías, modificadores, mozos y usuarios.' },
  settings: { title: 'Mi negocio', text: 'Nombre, logo y datos de tus tickets, propinas, permisos y las funciones que querés usar.' },
  logs: { title: 'Logs', text: 'Historial de lo que se hizo: pedidos, cobros, impresiones y cambios.' },
};

// Ruta → ítem del menú, para dar por visto un ítem cuando se entra a su pantalla
const ROUTES: [string, string][] = [
  ['/counter', 'counter'],
  ['/cash', 'caja'],
  ['/reservations', 'reservations'],
  ['/kitchen', 'kitchen'],
  ['/balance', 'balance'],
  ['/reports', 'reports'],
  ['/inventory', 'inventory'],
  ['/admin', 'admin'],
  ['/settings', 'settings'],
  ['/logs', 'logs'],
];

const KEY = 'nav_guide_v1';

// Resalta los ítems del menú lateral que se fueron habilitando durante los primeros pasos, con una ayuda corta.
// Solo se activa si este negocio pasó por los primeros pasos: un negocio que ya venía andando no ve nada resaltado.
@Injectable({ providedIn: 'root' })
export class NavGuideService {
  readonly info = NAV_INFO;
  // ítem con la ayuda abierta
  helpOpen: string | null = null;

  private active = false;
  private seen = new Set<string>();

  constructor(onboarding: OnboardingService, private users: UserService) {
    this.load();
    // Cuando el negocio ya terminó los primeros pasos, las ayudas y los resaltados se apagan (antes quedaban para siempre
    // en los dispositivos donde alguna vez se había visto el negocio a medio configurar)
    onboarding.setupLoaded$.subscribe((pending) => {
      if (!pending && this.active) {
        this.active = false;
        this.seen.clear();
        this.save();
      }
    });
    onboarding.setupPending$.subscribe((pending) => {
      if (pending && !this.active) {
        this.active = true;
        this.save();
      }
    });
  }

  // Las ayudas de primeros pasos son para quien configura el negocio (administrador), no para cajeros o mozos
  private get forAdmin(): boolean {
    return this.users.currentRole() === 'admin';
  }

  isNew(key: string): boolean {
    return this.active && this.forAdmin && !this.seen.has(key);
  }

  // El botón de ayuda se queda aunque ya se haya entrado a la sección (solo se apaga el resaltado de "nuevo")
  hasHelp(key: string): boolean {
    return this.active && this.forAdmin && key in this.info;
  }

  markSeen(key: string) {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.save();
  }

  // Al navegar: la pantalla visitada deja de estar resaltada
  visited(url: string) {
    const path = url.split('?')[0].split('#')[0];
    const hit = ROUTES.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'));
    if (hit) this.markSeen(hit[1]);
  }

  toggleHelp(key: string) {
    this.helpOpen = this.helpOpen === key ? null : key;
  }

  private load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw) {
        this.active = !!raw.active;
        this.seen = new Set(Array.isArray(raw.seen) ? raw.seen : []);
      }
    } catch {}
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ active: this.active, seen: [...this.seen] }));
    } catch {}
  }
}
