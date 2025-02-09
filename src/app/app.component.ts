import { Component, OnInit, ViewChild } from '@angular/core';
import { CoffeService, Table } from './models/coffe.service';
import { MatSidenav } from '@angular/material/sidenav';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  showFiller = false;

  // Variables para fecha y turno
  currentDate: string;
  shift: string;

  constructor(private datePipe: DatePipe) {
    this.currentDate = this.getFormattedDate();
    this.shift = this.getShift();
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
}
