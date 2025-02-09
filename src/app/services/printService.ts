import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class PrintService {
  private apiUrl = 'http://localhost:8000/api/imprimir'; // URL corregida del plugin

  constructor(private http: HttpClient) {}

  imprimirTicket(operaciones: any) {
    const payload = {
      printerName: 'nictomPrinter', // Nombre de la impresora compartida
      imprimirEn: 'nictomPrinter',  // Asegurar que se imprima en la impresora
      operaciones: operaciones // La clave correcta debe ser "operaciones"
    };
    return this.http.post(this.apiUrl, payload);
  }
}