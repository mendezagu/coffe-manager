import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-waiter-dialog',
  templateUrl: './waiter-dialog.component.html',
  styleUrls: ['./waiter-dialog.component.scss']
})
export class WaiterDialogComponent {
  selectedWaiterId: string = '';

  constructor(
    public dialogRef: MatDialogRef<WaiterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onConfirm(): void {
    this.dialogRef.close(this.selectedWaiterId);
  }
}
