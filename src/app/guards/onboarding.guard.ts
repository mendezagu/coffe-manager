import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { OnboardingService } from '../services/onboarding.service';
import { UserService } from '../services/user.service';

// Un administrador con el negocio recién creado pasa primero por el asistente de primeros pasos.
// Si la consulta falla, se lo deja pasar: el asistente nunca debe bloquear el uso de la app.
export const onboardingGuard: CanActivateFn = () => {
  const users = inject(UserService);
  const onboarding = inject(OnboardingService);
  const router = inject(Router);

  if (users.currentRole() !== 'admin' || onboarding.knownDone) return true;
  return onboarding.status().pipe(
    map((s) => (s.done ? true : router.createUrlTree(['/bienvenida']))),
    catchError(() => of(true)),
  );
};
