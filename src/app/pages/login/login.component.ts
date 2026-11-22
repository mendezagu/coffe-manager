import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LocalInfo, UserService, homeFor } from 'src/app/services/user.service';
import { SettingsService } from 'src/app/services/settings.service';

type Scene = 'logo' | 'plates' | 'staff';
const DEFAULT_SCENE: Scene = 'staff';


const LOCAL_KEY = 'tavolapp_local';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  formLogin = new FormGroup({
    email: new FormControl('', [Validators.required]),
    password: new FormControl('', [Validators.required]),
  });
  codeControl = new FormControl('', [Validators.required]);
  loading = false;
  error = '';

  step: 'local' | 'credentials' = 'local';
  local: LocalInfo | null = null;
  checkingCode = false;
  codeError = '';
  rememberLocal = true;


  scene: Scene = DEFAULT_SCENE;
  passwordChanged = false;

  constructor(private userService: UserService, private router: Router, public settings: SettingsService, route: ActivatedRoute) {
    this.passwordChanged = route.snapshot.queryParamMap.get('clave') === 'ok';
    const wanted = route.snapshot.queryParamMap.get('escena');
    if (wanted === 'mozo') this.scene = 'staff';
    else if (wanted === 'platos') this.scene = 'plates';
    else if (wanted === 'logo') this.scene = 'logo';
  }

  ngOnInit() {

    const fromLink = this.readQuery();
    if (fromLink) {
      this.codeControl.setValue(fromLink);
      this.checkCode();
      return;
    }
    const saved = this.readSaved();
    if (saved) {
      this.local = saved;
      this.step = 'credentials';

      this.userService.localInfo(saved.code).subscribe({
        next: (info) => {
          this.local = info;
          this.save(info);
        },
        error: (err) => {
          if (err?.status === 404) {
            this.forget();
            this.step = 'local';
            this.local = null;
            this.codeError = 'El código de tu local cambió. Pedile el nuevo a tu administrador.';
          }
        },
      });
    }
  }

  checkCode() {
    const code = this.normalized(this.codeControl.value);
    if (!code || this.checkingCode) return;
    this.checkingCode = true;
    this.codeError = '';
    this.userService.localInfo(code).subscribe({
      next: (info) => {
        this.checkingCode = false;
        this.local = info;
        this.step = 'credentials';
        this.error = '';
        if (this.rememberLocal) this.save(info);
      },
      error: (err) => {
        this.checkingCode = false;
        this.codeError =
          err?.status === 404
            ? 'No encontramos ese local. Revisá el código.'
            : err?.status === 429
              ? 'Demasiados intentos. Esperá unos minutos.'
              : 'No se pudo conectar con el servidor. Intentá de nuevo.';
      },
    });
  }

 
  changeLocal() {
    this.forget();
    this.local = null;
    this.step = 'local';
    this.error = '';
    this.codeError = '';
    this.codeControl.reset('');
    this.formLogin.reset({ email: '', password: '' });
  }

  skipCode() {
    this.local = null;
    this.step = 'credentials';
    this.error = '';
    this.codeError = '';
  }


  backToCode() {
    this.step = 'local';
    this.error = '';
  }

  onSubmit() {
    if (this.formLogin.invalid || this.loading) return;
    this.loading = true;
    this.error = '';
    const { email, password } = this.formLogin.value;

    this.userService.login({ email: email!, password: password!, code: this.local?.code }).subscribe({
      next: (user) => {

        if (this.rememberLocal && this.local) this.save(this.local);

        else if (this.rememberLocal) {
          this.settings.refresh().subscribe({
            next: (s) => {
              if (s.loginCode) this.save({ code: s.loginCode, name: s.name, city: s.city ?? '', logoUrl: s.logoUrl ?? null });
            },
            error: () => undefined,
          });
        }
        this.router.navigate([homeFor(user.role)]);
      },
      error: (err) => {
        this.loading = false;

        if (err?.status === 400 && !this.local) {
          this.step = 'local';
          this.codeError = 'Tu usuario está en más de un local. Ingresá el código del tuyo para continuar.';
          return;
        }
        this.error =
          err?.status === 401
            ? 'Usuario o contraseña incorrectos'
            : err?.status === 429
              ? 'Demasiados intentos. Esperá unos minutos.'
              : 'No se pudo conectar con el servidor. Intentá de nuevo.';
      },
    });
  }


  private normalized(code: string | null): string {
    return (code ?? '').trim().toLowerCase();
  }

  private readQuery(): string {
    try {
      return this.normalized(new URLSearchParams(location.search).get('local'));
    } catch {
      return '';
    }
  }

  private readSaved(): LocalInfo | null {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
      return raw && typeof raw.code === 'string' && raw.code ? { code: raw.code, name: raw.name ?? raw.code, city: raw.city ?? '', logoUrl: raw.logoUrl ?? null } : null;
    } catch {
      return null;
    }
  }

  private save(info: LocalInfo) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(info));
    } catch {

    }
  }

  private forget() {
    try {
      localStorage.removeItem(LOCAL_KEY);
    } catch {
    }
  }
}
