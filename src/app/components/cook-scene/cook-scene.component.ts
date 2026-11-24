import { Component } from '@angular/core';

// Decoración animada para pantallas anchas (la misma cocina del ingreso): un cocinero salteando y una tabla donde se corta una zanahoria.
// No tiene lógica: todo se anima con CSS y se oculta en pantallas chicas.
@Component({
  selector: 'app-cook-scene',
  templateUrl: './cook-scene.component.html',
  styleUrls: ['./cook-scene.component.scss'],
})
export class CookSceneComponent {
  readonly slices = [1, 2, 3, 4, 5, 6];
}
