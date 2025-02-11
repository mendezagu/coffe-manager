import { Component, OnInit, ViewChild } from '@angular/core';
import { CoffeService, Table } from './models/coffe.service';
import { MatSidenav } from '@angular/material/sidenav';
import { DatePipe } from '@angular/common';
import { UserService } from './services/user.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  showFiller = false;
  isLoggedIn: boolean = false;

  // Variables para fecha y turno
  currentDate: string;
  shift: string;

  constructor(
    private datePipe: DatePipe,
    private userService: UserService,
    private router: Router
  ) {
    this.currentDate = this.getFormattedDate();
    this.shift = this.getShift();
  }

  ngOnInit() {
    // Suscribirse a cambios en la autenticación
    this.userService.getAuthState().subscribe(user => {
      this.isLoggedIn = !!user; // Si hay usuario, true; si no, false
    });
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
    this.userService.logout()
    .then(()=>{
      this.router.navigate(['/login'])
    })
    .catch(error=> console.log(error))
  }
}
