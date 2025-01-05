import { Injectable } from '@angular/core';

export interface MenuItem {
  id: number;
  name: string;
  price: number;
}

export interface Table {
  id: number;
  name: string;
  available: boolean;
  orders: MenuItem[];
}

@Injectable({
  providedIn: 'root'
})
export class CoffeService {
  tables: Table[] = [
    { id: 1, name: 'Mesa 1', available: true, orders: [] },
    { id: 2, name: 'Mesa 2', available: true, orders: [] },
    { id: 3, name: 'Mesa 3', available: true, orders: [] },
    { id: 4, name: 'Mesa 4', available: true, orders: [] },
    { id: 5, name: 'Mesa 5', available: true, orders: [] },
    { id: 6, name: 'Mesa 6', available: true, orders: [] },
    { id: 7, name: 'Mesa 7', available: true, orders: [] },
    { id: 8, name: 'Mesa 8', available: true, orders: [] },
    { id: 9, name: 'Mesa 9', available: true, orders: [] },
    { id: 10, name: 'Mesa 10', available: true, orders: [] },
  ];

  menu: MenuItem[] = [
    { id: 1, name: 'Café Americano', price: 2 },
    { id: 2, name: 'Latte', price: 3 },
    { id: 3, name: 'Cappuccino', price: 3.5 },
  ];

  constructor() {}

  getTables() {
    return this.tables;
  }

  getMenu() {
    return this.menu;
  }
}


