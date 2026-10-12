import { Component, OnInit, ViewChild } from '@angular/core';
import { CoffeService, Table } from './models/coffe.service';
import { MatSidenav } from '@angular/material/sidenav';
import { DatePipe } from '@angular/common';
import { AppUser, ROLE_LABELS, UserService } from './services/user.service';
import { SettingsService } from './services/settings.service';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { GestionService } from './services/gestionService';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  showFiller = false;
  isLoggedIn: boolean = false;
  role$: Observable<string | null>;
  user$: Observable<AppUser | null>;
  roleLabels = ROLE_LABELS;

  // Variables para fecha y turno
  currentDate: string;
  shift: string;

    tables: any[] = [];
  menu: any[] = [];
  waiters: any[] = [];

  constructor(
    private datePipe: DatePipe,
    private userService: UserService,
    private router: Router,
    private gestionService: GestionService,
    public settings: SettingsService
  ) {
    this.currentDate = this.getFormattedDate();
    this.shift = this.settings.shiftLabel();
    this.settings.settings$.subscribe(() => (this.shift = this.settings.shiftLabel()));
    this.role$ = this.userService.getRoleState();
    this.user$ = this.userService.getAuthState();
  }

  ngOnInit() {
    // Suscribirse a cambios en la autenticación
    this.userService.getAuthState().subscribe(user => {
      this.isLoggedIn = !!user; // Si hay usuario, true; si no, false
    });

    //NUEVOOOO

    
  }

  toggleSidenav() {
    this.sidenav.toggle();
  }

  // Método para obtener la fecha en formato DD/MM/YYYY
  getFormattedDate(): string {
    const now = new Date();
    return this.datePipe.transform(now, 'dd/MM/yyyy') || '';
  }

  // Método para determinar el turno según la hora actual
  getShift(): string {
    const hour = new Date().getHours(); // Obtiene la hora actual (0-23)

    if (hour >= 6 && hour < 12) {
      return 'Turno Mañana';
    } else if (hour >= 12 && hour < 18) {
      return 'Turno Tarde';
    } else {
      return 'Turno Noche';
    }
  }

  logout(){
    this.userService.logout();
    this.router.navigate(['/login']);
  }
}
