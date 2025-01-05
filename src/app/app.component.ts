import { Component } from '@angular/core';
import { CoffeService, Table } from './models/coffe.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  tables: Table[];

  constructor(private coffeService: CoffeService) {
    this.tables = this.coffeService.getTables();
  }
}
