import { Component, Input } from '@angular/core';

// Pantalla de carga de Tavolapp: el plato (la "o" del logo) girando, con un texto opcional debajo.
// Con `splash` ocupa toda la pantalla en verde oscuro, igual que la que se ve al abrir la app (index.html).
@Component({
  selector: 'app-loader',
  template: `
    <div class="loader" [class.loader--lg]="size === 'lg'" [class.loader--splash]="splash" role="status" aria-live="polite">
      <svg class="plate" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="48" stroke-width="4" [attr.fill]="well" [attr.stroke]="rim" />
        <circle cx="50" cy="50" r="38.5" fill="none" stroke-width="6" [attr.stroke]="rim" />
        <circle cx="50" cy="50" r="29" stroke-width="2.5" [attr.fill]="well" [attr.stroke]="rim" stroke-opacity=".35" />
        <g fill="none" [attr.stroke]="rim" stroke-linecap="round" stroke-linejoin="round">
          <path d="M34 31 V44 M39 31 V44 M44 31 V44" stroke-width="2.6" />
          <path d="M34 44 Q39 52 44 44" stroke-width="2.6" />
          <path d="M39 50 V69" stroke-width="3.6" />
        </g>
        <path d="M58.5 31 C66.5 36 67 49 62.5 56 H58.5 Z" [attr.fill]="accent" />
        <rect x="58.5" y="55" width="4" height="14" rx="2" [attr.fill]="accent" />
      </svg>
      <span class="label" *ngIf="label">{{ label }}</span>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .loader {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        color: #5d6e63;
        font-size: 13px;
      }
      .loader--splash {
        position: fixed;
        inset: 0;
        z-index: 2000;
        justify-content: center;
        gap: 14px;
        background: #1b2822;
        color: #edf1ea;
        font: 500 18px Roboto, system-ui, sans-serif;
        letter-spacing: 0.01em;
      }
      .plate {
        width: 44px;
        height: 44px;
        animation: spin 1.1s linear infinite;
      }
      .loader--lg .plate {
        width: 64px;
        height: 64px;
      }
      .loader--splash .plate {
        width: 88px;
        height: 88px;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .plate {
          animation-duration: 3s;
        }
      }
    `,
  ],
})
export class AppLoaderComponent {
  @Input() label = '';
  @Input() size: 'sm' | 'lg' = 'sm';
  @Input() splash = false;

  get rim() {
    return this.splash ? '#5fae86' : '#1d5b3e';
  }
  get well() {
    return this.splash ? '#22322a' : '#f6f8f4';
  }
  get accent() {
    return this.splash ? '#d9786a' : '#8a2a1c';
  }
}
