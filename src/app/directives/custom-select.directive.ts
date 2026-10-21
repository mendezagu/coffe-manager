import { Directive, ElementRef, HostListener, OnDestroy } from '@angular/core';

// Lista desplegable propia para TODOS los <select> de la app (con mouse o teclado).
// La lista de un <select> nativo la dibuja el sistema operativo y no se puede diseñar. Acá el <select> sigue siendo el
// mismo (formularios, ngModel y etiquetas funcionan igual): solo se reemplaza la lista que se abre.
// En pantallas táctiles se deja el selector del sistema (en el celular es más cómodo y ya se ve bien).
@Directive({ selector: 'select:not([multiple]):not([size]):not([nativeSelect])' })
export class CustomSelectDirective implements OnDestroy {
  private panel: HTMLElement | null = null;
  private options: HTMLOptionElement[] = [];
  private items: HTMLElement[] = [];
  private active = -1;
  private off: (() => void)[] = [];

  constructor(private el: ElementRef<HTMLSelectElement>) {}

  private get select() {
    return this.el.nativeElement;
  }

  private get enabled(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches && !this.select.disabled;
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(e: MouseEvent) {
    if (!this.enabled || e.button !== 0) return;
    e.preventDefault(); // evita que se abra la lista del sistema
    this.select.focus();
    this.panel ? this.close() : this.open();
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if (!this.enabled) return;
    if (!this.panel) {
      // cerrada: Enter, espacio o Alt+↓ abren la lista (las flechas y las letras siguen cambiando el valor, como siempre)
      if (e.key === 'Enter' || e.key === ' ' || (e.altKey && e.key === 'ArrowDown')) {
        e.preventDefault();
        this.open();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.move(-1);
        break;
      case 'Home':
        e.preventDefault();
        this.setActive(this.next(-1, 1));
        break;
      case 'End':
        e.preventDefault();
        this.setActive(this.next(this.options.length, -1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (this.active >= 0) this.pick(this.active);
        break;
      case 'Escape':
      case 'Tab':
        if (e.key === 'Escape') e.preventDefault();
        this.close();
        break;
    }
  }

  @HostListener('blur')
  onBlur() {
    // si se toca la lista el foco no se pierde (mousedown con preventDefault); si se va a otro campo, se cierra
    setTimeout(() => {
      if (this.panel && document.activeElement !== this.select) this.close();
    });
  }

  ngOnDestroy() {
    this.close();
  }

  // ---- lista ----

  private open() {
    this.close();
    this.options = Array.from(this.select.options);
    if (this.options.length === 0) return;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'listbox');
    panel.style.cssText =
      'position:fixed;z-index:100000;overflow-y:auto;box-sizing:border-box;padding:6px;background:#fff;border:1px solid #e0e7dc;' +
      'border-radius:14px;box-shadow:0 18px 40px -12px rgba(30,43,36,.35),0 2px 6px rgba(30,43,36,.08);font:500 14px Roboto,system-ui,sans-serif;';

    this.items = this.options.map((opt, i) => {
      const item = document.createElement('div');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(opt.selected));
      item.style.cssText =
        'display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;cursor:pointer;color:#1e2b24;line-height:1.3;user-select:none;';
      const label = document.createElement('span');
      label.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      label.textContent = opt.textContent?.trim() || ' ';
      item.appendChild(label);
      if (opt.selected && !opt.disabled) {
        const check = document.createElement('span');
        check.className = 'material-icons';
        check.style.cssText = 'font-size:18px;line-height:1;color:#1d5b3e;';
        check.textContent = 'check';
        item.appendChild(check);
        item.style.fontWeight = '700';
      }
      if (opt.disabled) {
        item.style.color = '#9aa8a0';
        item.style.cursor = 'default';
      }
      item.onmouseenter = () => !opt.disabled && this.setActive(i);
      // mousedown con preventDefault: la lista se puede tocar sin quitarle el foco al campo
      item.onmousedown = (ev) => ev.preventDefault();
      item.onclick = () => this.pick(i);
      panel.appendChild(item);
      return item;
    });

    document.body.appendChild(panel);
    this.panel = panel;
    this.position();

    const selected = this.options.findIndex((o) => o.selected && !o.disabled);
    this.setActive(selected >= 0 ? selected : this.next(-1, 1));
    this.items[this.active]?.scrollIntoView({ block: 'nearest' });

    // se cierra al tocar afuera, al desplazar la página o al cambiar el tamaño de la ventana
    const outside = (ev: Event) => {
      const t = ev.target as Node;
      if (!panel.contains(t) && t !== this.select) this.close();
    };
    const scroll = (ev: Event) => {
      if (!panel.contains(ev.target as Node)) this.close();
    };
    document.addEventListener('mousedown', outside, true);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', this.closeBound);
    this.off = [
      () => document.removeEventListener('mousedown', outside, true),
      () => window.removeEventListener('scroll', scroll, true),
      () => window.removeEventListener('resize', this.closeBound),
    ];
  }

  private closeBound = () => this.close();

  private close() {
    this.off.forEach((f) => f());
    this.off = [];
    this.panel?.remove();
    this.panel = null;
    this.items = [];
    this.active = -1;
  }

  // debajo del campo, o encima si abajo no hay lugar
  private position() {
    const panel = this.panel!;
    const r = this.select.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const wanted = Math.min(panel.scrollHeight + 2, 300);
    const up = below < Math.min(wanted, 180) && above > below;
    panel.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8))}px`;
    panel.style.minWidth = `${r.width}px`;
    panel.style.maxWidth = `${Math.max(r.width, Math.min(440, window.innerWidth - 16))}px`;
    panel.style.maxHeight = `${Math.max(120, Math.min(300, up ? above : below))}px`;
    if (up) panel.style.bottom = `${window.innerHeight - r.top + 6}px`;
    else panel.style.top = `${r.bottom + 6}px`;
  }

  private next(from: number, step: 1 | -1): number {
    for (let i = from + step; i >= 0 && i < this.options.length; i += step) if (!this.options[i].disabled) return i;
    return from >= 0 && from < this.options.length ? from : -1;
  }

  private move(step: 1 | -1) {
    this.setActive(this.next(this.active, step));
  }

  private setActive(index: number) {
    if (index < 0) return;
    this.items[this.active] && (this.items[this.active].style.background = '');
    this.active = index;
    const item = this.items[index];
    if (!item) return;
    item.style.background = '#edf1ea';
    item.scrollIntoView({ block: 'nearest' });
  }

  private pick(index: number) {
    const opt = this.options[index];
    if (!opt || opt.disabled) return;
    const changed = this.select.value !== opt.value;
    this.select.value = opt.value;
    this.close();
    if (changed) {
      // los mismos eventos que lanza el selector del sistema: así ngModel y los formularios se enteran
      this.select.dispatchEvent(new Event('input', { bubbles: true }));
      this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    this.select.focus();
  }
}
