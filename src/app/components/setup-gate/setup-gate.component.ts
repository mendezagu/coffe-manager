import { Component, Input } from '@angular/core';
import { OnboardingStatus } from 'src/app/services/onboarding.service';

interface GateTask {
  title: string;
  hint: string;
  icon: string;
  step: number; // paso del asistente al que lleva
  done: boolean;
}

// Pantalla que reemplaza al tablero mientras falte lo básico (menú, mesas y mozo): el plato girando, un mensaje claro
// y la lista de lo obligatorio. Todo lleva al asistente de primeros pasos.
@Component({
  selector: 'app-setup-gate',
  templateUrl: './setup-gate.component.html',
})
export class SetupGateComponent {
  @Input() set status(s: OnboardingStatus) {
    const c = s.counts;
    this.tasks = [
      { title: 'Cargá tus platos', hint: 'Lo que vendés, con su precio', icon: 'restaurant_menu', step: 1, done: c.menuItems > 0 },
      { title: 'Creá tus mesas', hint: 'Una por cada mesa del local', icon: 'table_restaurant', step: 2, done: c.tables > 0 },
      { title: 'Sumá a tu mozo', hint: 'Quien atiende las mesas (si estás solo, tu nombre)', icon: 'person', step: 3, done: c.waiters > 0 },
      { title: 'Abrí la caja', hint: 'Hace falta para poder cobrar', icon: 'point_of_sale', step: 4, done: c.cashRegisters > 0 },
      { title: 'Hacé tu primera venta', hint: 'Ordená en una mesa y cobrá', icon: 'receipt_long', step: 4, done: c.sales > 0 },
    ];
  }

  tasks: GateTask[] = [];

  get doneCount(): number {
    return this.tasks.filter((t) => t.done).length;
  }

  trackTitle(_i: number, t: GateTask) {
    return t.title;
  }
}
