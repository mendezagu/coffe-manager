import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Table } from 'src/app/models/coffe.service';

@Component({
  selector: 'app-link-table-dialog',
  templateUrl: './link-table-dialog.component.html',
  styleUrls: ['./link-table-dialog.component.scss']
})
export class LinkTableDialogComponent {
  availableTables: Table[];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { tables: Table[]; currentTableId: number },
    private dialogRef: MatDialogRef<LinkTableDialogComponent>
  ) {
    // Filtrar mesas no disponibles o ya vinculadas
    this.availableTables = this.data.tables.filter(t => t.id !== this.data.currentTableId && !t.linkedTables.includes(this.data.currentTableId));
  }

  linkSelectedTables(selectedOptions: { value: number }[]): void {
    const tableIds = selectedOptions.map(option => option.value);
    this.dialogRef.close(tableIds); // Retornar las mesas seleccionadas
  }
}


