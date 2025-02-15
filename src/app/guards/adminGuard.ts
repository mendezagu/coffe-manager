import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { Observable } from 'rxjs';
import { first, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AdminGuard implements CanActivate {
  constructor(private userService: UserService, private router: Router) {}

  canActivate(): Observable<boolean> {
    return this.userService.getRoleState().pipe(
      first(), // ✅ Obtiene solo el primer valor del observable (evita el delay)
      map((role) => {
        if (role === 'admin') {
          console.log('✅ Acceso permitido: Usuario es admin');
          return true;
        } else {
          console.log('⛔ Acceso denegado: No es admin');
          this.router.navigate(['/']);
          return false;
        }
      })
    );
  }
}