import { AfterViewInit, Directive, ElementRef, OnDestroy } from '@angular/core';

// Agrega a un campo de contraseña el botón del "ojito" para mostrarla u ocultarla.
// Uso: <input type="password" appPasswordToggle ...>
// El botón se inserta como hermano del campo (no se mueve el campo de lugar), así no interfiere con formularios ni con Angular.
@Directive({ selector: 'input[appPasswordToggle]' })
export class PasswordToggleDirective implements AfterViewInit, OnDestroy {
  private button?: HTMLButtonElement;
  private icon?: HTMLSpanElement;
  private observer?: ResizeObserver;

  constructor(private el: ElementRef<HTMLInputElement>) {}

  ngAfterViewInit() {
    const input = this.el.nativeElement;
    const parent = input.parentElement;
    if (!parent) return;

    // el botón se posiciona sobre el campo, dentro de su contenedor
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    input.style.paddingRight = '2.75rem'; // que el texto no quede debajo del botón

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Mostrar la contraseña');
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Mostrar la contraseña';
    button.style.cssText =
      'position:absolute;right:6px;width:36px;height:36px;display:grid;place-items:center;border:0;border-radius:9999px;' +
      'background:transparent;color:#86958b;cursor:pointer;padding:0;';
    button.onmouseenter = () => (button.style.background = '#edf1ea');
    button.onmouseleave = () => (button.style.background = 'transparent');

    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.style.cssText = 'font-size:20px;line-height:1;';
    icon.textContent = 'visibility';
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);

    // mousedown: que tocar el ojito no le quite el foco al campo
    button.onmousedown = (e) => e.preventDefault();
    button.onclick = () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      icon.textContent = show ? 'visibility_off' : 'visibility';
      button.setAttribute('aria-pressed', String(show));
      const label = show ? 'Ocultar la contraseña' : 'Mostrar la contraseña';
      button.setAttribute('aria-label', label);
      button.title = label;
      input.focus();
    };

    input.insertAdjacentElement('afterend', button);
    this.button = button;
    this.icon = icon;

    // centrado vertical sobre el campo (aunque haya una etiqueta arriba), y se recalcula si cambia el tamaño
    const place = () => {
      button.style.top = `${input.offsetTop + (input.offsetHeight - 36) / 2}px`;
    };
    place();
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(place);
      this.observer.observe(input);
      this.observer.observe(parent);
    }
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.button?.remove();
  }
}
