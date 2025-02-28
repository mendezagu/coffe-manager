import { Component, OnInit } from '@angular/core';
import { GestionService, Table } from 'src/app/services/gestionService';

interface BalanceEntry {
  tableName: string;
  waiterName: string;
  totalAmount: number;
}

@Component({
  selector: 'app-balance',
  templateUrl: './balance.component.html',
  styleUrls: ['./balance.component.scss']
})
export class BalanceComponent implements OnInit {
  balanceData: BalanceEntry[] = [];
  totalRevenue: number = 0;

  constructor(private gestionService: GestionService) {}

  ngOnInit(): void {
    this.loadBalance();
  }

  loadBalance(): void {
    this.gestionService.getBalance().subscribe({
      next: (data: BalanceEntry[]) => {
        this.balanceData = data;  // Cargar datos de balance
        this.calculateTotalRevenue();
      },
      error: (error) => {
        console.error('Error al obtener el balance:', error);
      },
    });
  }

  calculateTotalRevenue(): void {
    this.totalRevenue = this.balanceData.reduce((sum, entry) => sum + entry.totalAmount, 0);
  }
}