import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OnboardingService, OnboardingStatus, isSetupPending } from 'src/app/services/onboarding.service';
import { UserService } from 'src/app/services/user.service';

interface Task {
  title: string;
  hint: string;
  icon: string;
  link: string[] | null;
  done: boolean;
  cta: string; // texto del botón cuando es el próximo paso
  why: string; // para qué sirve este paso
  how: string[]; // qué hacer, en pocos pasos concretos
  eta: string; // cuánto lleva
}

// Checklist "Primeros pasos" del inicio (solo administrador): lo que falta para tener el negocio andando.
// No se puede ocultar: desaparece sola cuando están hechos los pasos obligatorios (son 5 pasos, todos obligatorios).
@Component({
  selector: 'app-getting-started',
  templateUrl: './getting-started.component.html',
  styles: [
    `
      /* Brillo verde que late alrededor del próximo paso, para que se note al entrar */
      .gs-next {
        animation: gs-glow 2.2s ease-in-out infinite;
      }
      @keyframes gs-glow {
        0%,
        100% {
          box-shadow: 0 0 0 0 rgba(11, 125, 102, 0.35);
        }
        50% {
          box-shadow: 0 0 0 7px rgba(11, 125, 102, 0);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .gs-next {
          animation: none;
          box-shadow: 0 0 0 3px rgba(11, 125, 102, 0.2);
        }
      }
    `,
  ],
})
export class GettingStartedComponent implements OnInit {
  tasks: Task[] = [];
  status: OnboardingStatus | null = null;
  visible = false;
  busy = false;
  open = true;

  constructor(private users: UserService, private onboarding: OnboardingService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    if (this.users.currentRole() !== 'admin') return;
    this.load();
  }

  private load() {
    this.onboarding.status().subscribe({
      next: (s) => {
        this.status = s;
        const c = s.counts;
        const counterOnly = this.onboarding.counterOnly;
        const all: Task[] = [
          { title: 'Cargá tus platos', hint: 'Lo que vendés, con su precio', icon: 'restaurant_menu', link: ['/bienvenida'], done: c.menuItems > 0, cta: 'Cargar platos', why: 'Sin platos no hay nada para vender ni para ordenar.', how: ['Tocá "Cargar platos"', 'Usá el menú de ejemplo o cargá los tuyos', 'Poné el precio de cada plato'], eta: '3 min' },
          { title: 'Creá tus mesas', hint: 'Una por cada mesa del local', icon: 'table_restaurant', link: ['/bienvenida'], done: c.tables > 0, cta: 'Crear mesas', why: 'Cada mesa del local es una tarjeta en la que se toman los pedidos.', how: ['Indicá cuántas mesas tenés', 'Tocá "Crear mesas"'], eta: '1 min' },
          { title: 'Sumá a tu mozo', hint: 'Quien atiende las mesas (si estás solo, tu nombre)', icon: 'person', link: ['/bienvenida'], done: c.waiters > 0, cta: 'Agregar mozo', why: 'Cada pedido queda a nombre de quien atiende la mesa.', how: ['Escribí un nombre (si atendés solo, el tuyo)', 'Tocá "Agregar"'], eta: '1 min' },
          { title: 'Abrí la caja', hint: 'Hace falta para poder cobrar: abrila para empezar el día', icon: 'point_of_sale', link: ['/cash'], done: c.cashRegisters > 0, cta: 'Abrir caja', why: 'Con la caja abierta se registran los cobros del día. Sin caja no se puede cobrar.', how: ['Tocá "Abrir caja"', 'Escribí con cuánto efectivo empezás (puede ser 0)', 'Confirmá'], eta: '1 min' },
          counterOnly
            ? { title: 'Hacé tu primera venta', hint: 'Tocá los productos y cobrá en el Mostrador', icon: 'receipt_long', link: ['/counter'], done: c.sales > 0, cta: 'Ir al Mostrador', why: 'Hacé una venta de prueba para ver cómo se trabaja de principio a fin.', how: ['Tocá los productos que pide el cliente', 'Tocá cobrar', 'Elegí cómo paga'], eta: '2 min' }
            : { title: 'Hacé tu primera venta', hint: 'Tocá una mesa, elegí Ordenar y cobrá', icon: 'receipt_long', link: null, done: c.sales > 0, cta: 'Ir a las mesas', why: 'Hacé una venta de prueba para ver cómo trabaja tu equipo de principio a fin.', how: ['Tocá una mesa libre, por ejemplo la Mesa 1', 'Elegí "Ordenar" y agregá un plato', 'Cobrá desde "Total" y liberá la mesa'], eta: '2 min' },
        ];
        // un negocio de mostrador no necesita mesas ni mozos
        this.tasks = counterOnly ? all.filter((t) => t.icon !== 'table_restaurant' && t.icon !== 'person') : all;
        // Aparece mientras falte algún paso obligatorio
        this.visible = isSetupPending(c, counterOnly);
      },
      error: () => (this.visible = false),
    });
  }

  // Posición del primer paso que falta: es el que se destaca
  get nextIndex(): number {
    return this.tasks.findIndex((t) => !t.done);
  }

  get nextTask(): Task | null {
    return this.tasks[this.nextIndex] ?? null;
  }

  // Los pasos que no tienen pantalla propia (la venta en una mesa) llevan a las mesas, más abajo
  goToTables() {
    // Se ancla a la mesa que late (la que hay que tocar); si todavía no se dibujó, a la sección de mesas
    const target = document.querySelector('[data-guide-table]') ?? document.querySelector('app-card');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (target as HTMLElement | null)?.focus?.({ preventScroll: true });
  }

  get doneCount(): number {
    return this.tasks.filter((t) => t.done).length;
  }

  get percent(): number {
    return this.tasks.length ? Math.round((this.doneCount / this.tasks.length) * 100) : 0;
  }

  get hasExample(): boolean {
    return (this.status?.counts.exampleItems ?? 0) > 0;
  }

  removeExample() {
    if (this.busy) return;
    this.busy = true;
    this.onboarding.removeTemplate().subscribe({
      next: () => {
        this.busy = false;
        this.snackBar.open('Menú de ejemplo borrado', 'Cerrar', { duration: 3000 });
        this.load();
      },
      error: () => {
        this.busy = false;
        this.snackBar.open('No se pudo borrar el ejemplo', 'Cerrar', { duration: 3500 });
      },
    });
  }

  trackTitle(_i: number, t: Task) {
    return t.title;
  }
}
