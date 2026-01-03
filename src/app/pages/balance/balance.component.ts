import { Component, OnInit } from '@angular/core';
import { GestionService, Table } from 'src/app/services/gestionService';

interface BalanceEntry {
  tableName: string;
  waiterName: string;
  totalAmount: number;
  paymentMethod?: string;
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
    // Primero intentar cargar desde localStorage
    const localBalances = JSON.parse(localStorage.getItem('localBalances') || '[]');
    
    if (localBalances.length > 0) {
      // Si hay datos en localStorage, usarlos directamente
      this.balanceData = localBalances;
      this.calculateTotalRevenue();
    } else {
      // Si no hay datos locales, cargar desde el backend
      this.gestionService.getBalance().subscribe({
        next: (data: BalanceEntry[]) => {
          this.balanceData = data.map(entry => ({
            ...entry,
            paymentMethod: 'efectivo' // Por defecto si vienen del backend sin localStorage
          }));
          this.calculateTotalRevenue();
        },
        error: (error) => {
          console.error('Error al obtener el balance:', error);
        },
      });
    }
  }

  calculateTotalRevenue(): void {
    this.totalRevenue = this.balanceData.reduce((sum, entry) => sum + entry.totalAmount, 0);
  }
  
  deleteBalance(): void {
    if (confirm('¿Estás seguro de que deseas eliminar todos los datos del balance?')) {
      this.gestionService.deleteAllBalances().subscribe({
        next: (response) => {
          console.log(response.message);
          this.balanceData = []; // Limpiar datos en el frontend
          this.totalRevenue = 0; // Reiniciar total recaudado
          localStorage.removeItem('localBalances'); // Limpiar también los datos locales
        },
        error: (error) => {
          console.error('Error al eliminar balance:', error);
        },
      });
    }
  }
}