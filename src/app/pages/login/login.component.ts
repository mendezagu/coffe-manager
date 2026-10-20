import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService, homeFor } from 'src/app/services/user.service';
import { SettingsService } from 'src/app/services/settings.service';

type Scene = 'logo' | 'plates' | 'staff';
const DEFAULT_SCENE: Scene = 'staff';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  formLogin = new FormGroup({
    email: new FormControl('', [Validators.required]),
    password: new FormControl('', [Validators.required]),
  });
  loading = false;
  error = '';

  // Escena animada de los costados. Hay tres y se alternan sin borrar ninguna:
  //  - 'staff'  : el mozo caminando y los comensales en la mesa (por defecto)
  //  - 'logo'   : plato de Tavolapp girando a la izquierda y verduras cortándose a la derecha
  //  - 'plates' : platos de Tavolapp girando a los dos lados
  // Para compararlas: /login?escena=mozo, /login?escena=logo o /login?escena=platos
  scene: Scene = DEFAULT_SCENE;

  constructor(private userService: UserService, private router: Router, public settings: SettingsService, route: ActivatedRoute) {
    const wanted = route.snapshot.queryParamMap.get('escena');
    if (wanted === 'mozo') this.scene = 'staff';
    else if (wanted === 'platos') this.scene = 'plates';
    else if (wanted === 'logo') this.scene = 'logo';
  }

  onSubmit() {
    if (this.formLogin.invalid || this.loading) return;
    this.loading = true;
    this.error = '';
    const { email, password } = this.formLogin.value;

    this.userService.login({ email: email!, password: password! }).subscribe({
      next: (user) => this.router.navigate([homeFor(user.role)]),
      error: (err) => {
        this.loading = false;
        this.error =
          err?.status === 401
            ? 'Email o contraseña incorrectos'
            : 'No se pudo conectar con el servidor. Intentá de nuevo.';
      },
    });
  }
}
