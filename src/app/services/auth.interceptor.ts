import { Injectable, Injector } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environmentMongo } from 'src/environments/environmentMongo';
import { UserService } from './user.service';

// Agrega el token a las llamadas a la API y cierra la sesión si el servidor responde 401.
// UserService se obtiene con Injector (no por constructor) para evitar la dependencia
// circular HttpClient -> interceptor -> UserService -> HttpClient.
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private injector: Injector) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!req.url.startsWith(environmentMongo.apiUrl)) return next.handle(req);

    const users = this.injector.get(UserService);
    const token = users.getToken();
    const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

    return next.handle(authReq).pipe(
      catchError((err) => {
        const isLogin = req.url.endsWith('/auth/login');
        if (err instanceof HttpErrorResponse && err.status === 401 && !isLogin) {
          users.logout();
          this.injector.get(Router).navigate(['/login']);
        }
        return throwError(() => err);
      }),
    );
  }
}
