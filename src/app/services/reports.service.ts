import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environmentMongo } from 'src/environments/environmentMongo';

export interface SalesReport {
  range: { from: string; to: string; tz: string };
  summary: {
    salesCount: number;
    totalAmount: number;
    averageTicket: number;
    grossTotal: number;
    discountTotal: number;
    itemsSold: number;
    salesWithoutDetail: number;
    tipsTotal: number;
  };
  byDay: { date: string; salesCount: number; totalAmount: number }[];
  items: { name: string; quantity: number; amount: number }[];
  byWaiter: { name: string; salesCount: number; totalAmount: number; tips: number }[];
  byPayment: { method: string; salesCount: number; totalAmount: number }[];
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  constructor(private http: HttpClient) {}

  // from/to: YYYY-MM-DD (inclusive). La zona horaria es la del navegador: define dónde empieza cada día.
  sales(from: string, to: string): Observable<SalesReport> {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const params = new HttpParams().set('from', from).set('to', to).set('tz', tz);
    return this.http.get<SalesReport>(`${environmentMongo.apiUrl}/reports/sales`, { params });
  }
}
