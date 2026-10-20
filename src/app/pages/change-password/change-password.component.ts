import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from 'src/app/services/user.service';

// Primer ingreso con una contraseña que puso otra persona (por ejemplo, el alta desde la consola de Tavolapp):
// lo primero es elegir la propia. Al terminar se cierra la sesión y se vuelve a ingresar con la nueva.
@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
})
export class ChangePasswordComponent {
  constructor(private users: UserService, private router: Router) {}

  onChanged() {
    this.users.logout();
    this.router.navigate(['/login'], { queryParams: { clave: 'ok' } });
  }

  cancel() {
    this.users.logout();
    this.router.navigate(['/login']);
  }
}
