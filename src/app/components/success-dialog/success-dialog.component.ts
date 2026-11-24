import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface SuccessDialogData {
  title: string;
  sub?: string;
  // cuánto se ve antes de cerrarse solo (ms)
  duration?: number;
}

// Confirmación con un check animado: se muestra un momento y se cierra sola (o al tocarla).
@Component({
  selector: 'app-success-dialog',
  templateUrl: './success-dialog.component.html',
  styleUrls: ['./success-dialog.component.scss'],
})
export class SuccessDialogComponent implements OnInit {
  constructor(private ref: MatDialogRef<SuccessDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: SuccessDialogData) {}

  ngOnInit() {
    setTimeout(() => this.ref.close(), this.data.duration ?? 1900);
  }

  close() {
    this.ref.close();
  }
}
