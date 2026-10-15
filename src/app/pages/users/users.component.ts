import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppRole, AppUser, ROLE_LABELS, UserService } from 'src/app/services/user.service';
import { SettingsService } from 'src/app/services/settings.service';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
})
export class UsersComponent implements OnInit {
  users: AppUser[] = [];
  loading = true;
  saving = false;
  currentUserId: string | null = null;

  // Los roles "Cocina" y "Barra" solo tienen sentido si el negocio usa la pantalla de cocina
  get roles() {
    const kitchen = !!this.settings.value.kitchenEnabled;
    return (Object.keys(ROLE_LABELS) as AppRole[])
      .filter((value) => kitchen || (value !== 'kitchen' && value !== 'bar'))
      .map((value) => ({ value, label: ROLE_LABELS[value] }));
  }
  roleLabel = (role: AppRole) => ROLE_LABELS[role];

  form = { name: '', email: '', password: '', role: 'waiter' as AppRole };

  // Avisa al panel de administración que cambió la lista (para actualizar el contador de la tarjeta)
  @Output() changed = new EventEmitter<void>();

  constructor(private userService: UserService, private snackBar: MatSnackBar, private settings: SettingsService) {}

  ngOnInit() {
    this.userService.getAuthState().subscribe((u) => (this.currentUserId = u?.id ?? null));
    this.load();
  }

  load() {
    this.loading = true;
    this.userService.listUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.notify(this.errorMessage(err, 'No se pudieron cargar los usuarios'));
      },
    });
  }

  create() {
    if (this.saving) return;
    this.saving = true;
    this.userService.createUser({ ...this.form }).subscribe({
      next: () => {
        this.saving = false;
        this.form = { name: '', email: '', password: '', role: 'waiter' };
        this.notify('Usuario creado');
        this.load();
        this.changed.emit();
      },
      error: (err) => {
        this.saving = false;
        this.notify(this.errorMessage(err, 'No se pudo crear el usuario'));
      },
    });
  }

  changeRole(user: AppUser, role: AppRole) {
    this.update(user, { role }, 'Rol actualizado');
  }

  toggleActive(user: AppUser) {
    this.update(user, { active: !user.active }, user.active ? 'Usuario desactivado' : 'Usuario activado');
  }

  resetPassword(user: AppUser) {
    const password = window.prompt(`Nueva contraseña para ${user.name} (mínimo 8 caracteres):`);
    if (password === null) return;
    if (password.length < 8) {
      this.notify('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    this.update(user, { password }, 'Contraseña actualizada');
  }

  remove(user: AppUser) {
    if (!window.confirm(`¿Eliminar a ${user.name}? Esta acción no se puede deshacer.`)) return;
    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        this.notify('Usuario eliminado');
        this.load();
        this.changed.emit();
      },
      error: (err) => this.notify(this.errorMessage(err, 'No se pudo eliminar el usuario')),
    });
  }

  private update(user: AppUser, data: Parameters<UserService['updateUser']>[1], okMessage: string) {
    this.userService.updateUser(user.id, data).subscribe({
      next: () => {
        this.notify(okMessage);
        this.load();
        this.changed.emit();
      },
      error: (err) => {
        this.notify(this.errorMessage(err, 'No se pudo actualizar el usuario'));
        this.load();
      },
    });
  }

  private errorMessage(err: any, fallback: string): string {
    const msg = err?.error?.message;
    return Array.isArray(msg) ? msg.join('. ') : msg || fallback;
  }

  private notify(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 3500 });
  }
}
