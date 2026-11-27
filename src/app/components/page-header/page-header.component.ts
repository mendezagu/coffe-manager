import { Component, Input } from '@angular/core';

// Encabezado de pantalla, igual en todas las vistas.
//
//   <app-page-header icon="table_restaurant" title="Mesas">
//     <div phChips class="contents"> <span class="ph-chip"><b>14</b> de 35 ocupadas</span> </div>
//     <div phActions class="contents"> <button class="ph-btn ph-btn--primary">Nueva</button> </div>
//     <div phTools class="contents"> …filtros o períodos… </div>
//     <a phBack …>Volver</a>
//   </app-page-header>
//
// - Título y subtítulo (una frase que dice qué hay en la pantalla), sin ícono. `icon` se acepta pero no se dibuja.
// - phChips: información de sólo lectura (estado, conteos). En celular bajan a una segunda fila.
// - phActions: a la derecha; una sola principal (.ph-btn--primary), el resto secundarias o destructivas.
// - phTools: fila opcional debajo (filtros, períodos).
@Component({
  selector: 'app-page-header',
  styles: [':host { display: block; }'],
  template: `
    <header class="page-header">
      <div class="page-header__inner">
        <div class="ph-back"><ng-content select="[phBack]"></ng-content></div>
        <div class="ph-main">
          <div class="min-w-0">
            <h1 class="page-title">{{ title }}</h1>
            <p *ngIf="subtitle" class="page-sub">{{ subtitle }}</p>
          </div>
        </div>
        <div class="ph-chips"><ng-content select="[phChips]"></ng-content></div>
        <div class="ph-actions"><ng-content select="[phActions]"></ng-content></div>
      </div>
      <div class="ph-tools"><ng-content select="[phTools]"></ng-content></div>
    </header>
  `,
})
export class PageHeaderComponent {
  @Input() icon = '';
  @Input() title = '';
  @Input() subtitle = '';
}
