import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GestionService, Waiter } from 'src/app/services/gestionService';

@Component({
  selector: 'app-waiter-dialog',
  templateUrl: './waiter-dialog.component.html',
  styleUrls: ['./waiter-dialog.component.scss']
})
export class WaiterDialogComponent {
  waiterId: string = '';

  constructor(
    public dialogRef: MatDialogRef<WaiterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private gestionService: GestionService
  ) {}

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onConfirm(): void {
    if (this.waiterId.trim() === '') {
      console.error('Por favor ingresa un ID válido');
      return;
    }

    // Busca el mozo directamente por ID
    this.gestionService.getWaiters().subscribe({
      next: (waiters) => {
        const waiter = waiters.find(w => w._id === this.waiterId);
        if (waiter) {
          this.dialogRef.close({ waiterId: waiter._id, waiterName: waiter.name });
        } else {
          console.error('Mozo no encontrado');
          alert('Mozo no encontrado. Verifica el ID.');
        }
      },
      error: (error) => {
        console.error('Error al buscar el mozo:', error);
        alert('Ocurrió un error al buscar el mozo.');
      }
    });
  }
}