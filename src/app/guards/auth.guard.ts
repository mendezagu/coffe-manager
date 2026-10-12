import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppRole, UserService, homeFor } from '../services/user.service';

// Requiere sesión iniciada.
export const authGuard: CanActivateFn = () => {
  const users = inject(UserService);
  return users.isAuthenticated() ? true : inject(Router).createUrlTree(['/login']);
};

// Solo para quien NO tiene sesión (login); si ya la tiene, va al inicio.
export const guestGuard: CanActivateFn = () => {
  const users = inject(UserService);
  return users.isAuthenticated() ? inject(Router).createUrlTree([homeFor(users.currentRole())]) : true;
};

// Requiere sesión y uno de los roles indicados. El backend vuelve a validar el rol en cada llamada.
export const roleGuard =
  (...roles: AppRole[]): CanActivateFn =>
  () => {
    const users = inject(UserService);
    const router = inject(Router);
    if (!users.isAuthenticated()) return router.createUrlTree(['/login']);
    const role = users.currentRole();
    return role && roles.includes(role) ? true : router.createUrlTree([homeFor(role)]);
  };
