import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, homeFor } from 'src/app/services/user.service';
import { SettingsService } from 'src/app/services/settings.service';

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

  constructor(private userService: UserService, private router: Router, public settings: SettingsService) {}

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
