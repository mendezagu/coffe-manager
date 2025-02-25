import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GestionService, Table } from 'src/app/services/gestionService';

@Component({
  selector: 'app-link-tables-dialog',
  templateUrl: './link-table-dialog.component.html',
  styleUrls: ['./link-table-dialog.component.scss']
})
export class LinkTableDialogComponent implements OnInit {
  tables: Table[] = [];
  selectedTableIds: string[] = [];

  constructor(
    public dialogRef: MatDialogRef<LinkTableDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { table: Table },
    private gestionService: GestionService
  ) {}

  ngOnInit(): void {
    this.loadTables();
  }

  loadTables(): void {
    this.gestionService.getTables().subscribe((tables) => {
      this.tables = tables.filter(table => table.id !== this.data.table.id); // Excluir la mesa actual
    });
  }

  onTableSelectionChange(event: any, tableId: string): void {
    if (event.checked) {
      this.selectedTableIds.push(tableId);
    } else {
      this.selectedTableIds = this.selectedTableIds.filter(id => id !== tableId);
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onConfirm(): void {
    this.dialogRef.close(this.selectedTableIds);
  }
}