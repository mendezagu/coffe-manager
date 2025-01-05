import { Component, Input, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CoffeService, Table } from 'src/app/models/coffe.service';
import { MenuDialogComponent } from '../menu-dialog/menu-dialog.component';
import { TotalDialogComponent } from '../total-dialog/total-dialog.component';

@Component({
  selector: 'app-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss']
})
export class TableComponent { 
  @Input() table!: Table;

  constructor(public dialog: MatDialog) {}

  openMenuDialog() {
    const dialogRef = this.dialog.open(MenuDialogComponent, {
      width: '400px',
      data: this.table
    });

    dialogRef.afterClosed().subscribe(() => {
      console.log('Dialog cerrado');
    });
  }

  openTotalDialog() {
    const dialogRef = this.dialog.open(TotalDialogComponent, {
      width: '400px',
      data: this.table
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'liberar') {
        this.table.available = true;
        this.table.orders = [];
      }
    });
  }

}