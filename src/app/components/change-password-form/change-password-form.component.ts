import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UserService } from 'src/app/services/user.service';

const MIN_LENGTH = 8;

// Formulario para cambiar la propia contraseña (se usa en la pantalla obligatoria del primer ingreso y en "Mi negocio").
@Component({
  selector: 'app-change-password-form',
  templateUrl: './change-password-form.component.html',
})
export class ChangePasswordFormComponent {
  // En el primer ingreso la contraseña actual es la que dio Tavolapp: se aclara en la etiqueta
  @Input() first = false;
  @Output() changed = new EventEmitter<void>();

  current = '';
  next = '';
  repeat = '';
  busy = false;
  error = '';
  done = false;

  constructor(private users: UserService) {}

  get tooShort(): boolean {
    return this.next.length > 0 && this.next.length < MIN_LENGTH;
  }

  get mismatch(): boolean {
    return this.repeat.length > 0 && this.next !== this.repeat;
  }

  get sameAsCurrent(): boolean {
    return this.next.length > 0 && this.next === this.current;
  }

  get valid(): boolean {
    return (
      this.current.length > 0 && this.next.length >= MIN_LENGTH && this.next === this.repeat && this.next !== this.current
    );
  }

  submit() {
    if (!this.valid || this.busy) return;
    this.busy = true;
    this.error = '';
    this.done = false;
    this.users.changePassword(this.current, this.next).subscribe({
      next: () => {
        this.busy = false;
        this.done = true;
        this.current = this.next = this.repeat = '';
        this.changed.emit();
      },
      error: (err) => {
        this.busy = false;
        const msg = err?.error?.message;
        this.error = Array.isArray(msg) ? msg.join('. ') : msg || 'No se pudo cambiar la contraseña. Probá de nuevo.';
      },
    });
  }
}
