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
          box-shadow: 0 0 0 0 rgba(29, 91, 62, 0.35);
        }
        50% {
          box-shadow: 0 0 0 7px rgba(29, 91, 62, 0);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .gs-next {
          animation: none;
          box-shadow: 0 0 0 3px rgba(29, 91, 62, 0.2);
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
        this.tasks = [
          { title: 'Cargá tus platos', hint: 'Lo que vendés, con su precio', icon: 'restaurant_menu', link: ['/bienvenida'], done: c.menuItems > 0, cta: 'Cargar platos' },
          { title: 'Creá tus mesas', hint: 'Una por cada mesa del local', icon: 'table_restaurant', link: ['/bienvenida'], done: c.tables > 0, cta: 'Crear mesas' },
          { title: 'Sumá a tu mozo', hint: 'Quien atiende las mesas (si estás solo, tu nombre)', icon: 'person', link: ['/bienvenida'], done: c.waiters > 0, cta: 'Agregar mozo' },
          { title: 'Abrí la caja', hint: 'Hace falta para poder cobrar: abrila para empezar el día', icon: 'point_of_sale', link: ['/cash'], done: c.cashRegisters > 0, cta: 'Abrir caja' },
          { title: 'Hacé tu primera venta', hint: 'Tocá una mesa, elegí Ordenar y cobrá', icon: 'receipt_long', link: null, done: c.sales > 0, cta: 'Elegí una mesa' },
        ];
        // Aparece mientras falte algún paso obligatorio
        this.visible = isSetupPending(c);
      },
      error: () => (this.visible = false),
    });
  }

  // Posición del primer paso que falta: es el que se destaca
  get nextIndex(): number {
    return this.tasks.findIndex((t) => !t.done);
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
