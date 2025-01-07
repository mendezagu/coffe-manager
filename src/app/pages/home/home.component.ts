import { Component, OnInit } from '@angular/core';
import { CoffeService, MenuItem, Table } from 'src/app/models/coffe.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit{
  tables: Table[] = [];
  refreshLinkedTables: boolean = false; 

  constructor(private coffeService: CoffeService){}


  ngOnInit(): void {
    this.getTables();
  }

  getTables(){
    this.tables = this.coffeService.getTables();
  }

  addOrder(tableId: number, menuItem: MenuItem): void {
    this.coffeService.addOrderToTable(tableId, menuItem);
  }
  
  removeOrder(tableId: number, orderId: number): void {
    this.coffeService.removeOrderFromTable(tableId, orderId);
  }


  handleAddOrder(event: { tableId: number; menuItem: MenuItem }): void {
    this.addOrder(event.tableId, event.menuItem);
  }
  
  handleRemoveOrder(event: { tableId: number; orderId: number }): void {
    this.removeOrder(event.tableId, event.orderId);
  }

  handleLinkTables(): void {
    // Cambiar el valor para forzar la actualización de las tarjetas
    this.refreshLinkedTables = !this.refreshLinkedTables;
  }
  
}
