import { Component, OnInit } from '@angular/core';
import { GestionService } from 'src/app/services/gestionService';

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss']
})
export class LogsComponent implements OnInit{
  displayedColumns: string[] = ['timestamp', 'action'];
  logs: { action: string; timestamp: string }[] = [];

  constructor(private gestionService: GestionService) {}

  ngOnInit(): void {
    this.logs = this.gestionService.getLogs();
  }

  clearLogs(): void {
    this.gestionService.clearLogs();
    this.logs = [];
  }

}
