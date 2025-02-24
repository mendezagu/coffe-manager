import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GestionService, Waiter } from 'src/app/services/gestionService';

@Component({
  selector: 'app-waiter-dialog',
  templateUrl: './waiter-dialog.component.html',
  styleUrls: ['./waiter-dialog.component.scss']
})
export class WaiterDialogComponent implements OnInit {
  waiters: Waiter[] = [];  // Lista de mozos disponibles
  selectedWaiterId: string = '';  // ID del mozo seleccionado

  constructor(
    public dialogRef: MatDialogRef<WaiterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private gestionService: GestionService
  ) {}

  ngOnInit(): void {
    // Cargar los mozos al iniciar el componente
    this.gestionService.getWaiters().subscribe({
      next: (waiters) => {
        this.waiters = waiters;
        console.log(waiters,'LOS MOZOS');
        
      },
      error: (error) => {
        console.error('Error al cargar los mozos:', error);
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onConfirm(): void {
    const selectedWaiter = this.waiters.find(w => w._id === this.selectedWaiterId);
    if (selectedWaiter) {
      this.dialogRef.close({ waiterId: selectedWaiter._id, waiterName: selectedWaiter.name });
    } else {
      console.error('Mozo no seleccionado');
      alert('Por favor selecciona un mozo válido.');
    }
  }
}
