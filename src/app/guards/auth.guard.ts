import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppRole, UserService, homeFor } from '../services/user.service';

// Requiere sesión iniciada.
export const authGuard: CanActivateFn = () => {
  const users = inject(UserService);
  if (!users.isAuthenticated()) return inject(Router).createUrlTree(['/login']);
  return users.mustChangePassword() ? inject(Router).createUrlTree(['/cambiar-clave']) : true;
};

// Solo para quien NO tiene sesión (login); si ya la tiene, va al inicio.
export const guestGuard: CanActivateFn = () => {
  const users = inject(UserService);
  if (!users.isAuthenticated()) return true;
  const router = inject(Router);
  return router.createUrlTree([users.mustChangePassword() ? '/cambiar-clave' : homeFor(users.currentRole())]);
};

// Pantalla de cambio obligatorio: solo para quien tiene la contraseña pendiente de cambiar.
export const pendingPasswordGuard: CanActivateFn = () => {
  const users = inject(UserService);
  const router = inject(Router);
  if (!users.isAuthenticated()) return router.createUrlTree(['/login']);
  return users.mustChangePassword() ? true : router.createUrlTree([homeFor(users.currentRole())]);
};

// Requiere sesión y uno de los roles indicados. El backend vuelve a validar el rol en cada llamada.
export const roleGuard =
  (...roles: AppRole[]): CanActivateFn =>
  () => {
    const users = inject(UserService);
    const router = inject(Router);
    if (!users.isAuthenticated()) return router.createUrlTree(['/login']);
    if (users.mustChangePassword()) return router.createUrlTree(['/cambiar-clave']);
    const role = users.currentRole();
    return role && roles.includes(role) ? true : router.createUrlTree([homeFor(role)]);
  };
