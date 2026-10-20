import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface FilterTab {
  key: string;
  label: string;
  count: number;
}

// Pestañas para filtrar una lista larga por grupo (sector de una mesa, categoría de un plato…).
// Se desplazan de costado con el dedo, la rueda del mouse o arrastrando; sin barra a la vista.
@Component({
  selector: 'app-filter-tabs',
  template: `
    <div #strip role="tablist" [attr.aria-label]="label"
      class="no-scrollbar -mx-1 flex cursor-grab select-none gap-1.5 overflow-x-auto px-1 py-1 active:cursor-grabbing"
      (wheel)="onWheel($event, strip)" (mousedown)="onDown($event, strip)" (mousemove)="onMove($event, strip)"
      (mouseup)="onUp()" (mouseleave)="onUp()">
      <button *ngFor="let t of tabs; trackBy: trackKey" type="button" role="tab" [attr.aria-selected]="selected === t.key" (click)="pick(t.key)"
        class="inline-flex h-10 flex-none items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cafe-green-700/40"
        [ngClass]="selected === t.key ? 'border-cafe-green-700 bg-cafe-green-700 text-white' : 'border-sage-200 bg-white text-sage-700 hover:bg-sage-100'">
        {{ t.label }}
        <span class="rounded-full px-1.5 text-[11px] leading-[18px]" [ngClass]="selected === t.key ? 'bg-white/20 text-white' : 'bg-sage-100 text-sage-500'">{{ t.count }}</span>
      </button>
    </div>
  `,
  styles: [
    `
      .no-scrollbar {
        scrollbar-width: none;
        touch-action: pan-x pan-y;
      }
      .no-scrollbar::-webkit-scrollbar {
        display: none;
      }
    `,
  ],
})
export class FilterTabsComponent {
  @Input() tabs: FilterTab[] = [];
  @Input() selected = 'all';
  @Input() label = 'Filtrar por grupo';
  @Output() selectedChange = new EventEmitter<string>();

  private drag = { active: false, startX: 0, startLeft: 0, moved: false };

  pick(key: string) {
    if (this.drag.moved) return; // el clic que cierra un arrastre no elige nada
    this.selectedChange.emit(key);
  }

  trackKey(_i: number, t: FilterTab) {
    return t.key;
  }

  onWheel(e: WheelEvent, el: HTMLElement) {
    // la rueda es vertical: se usa para ir de costado, solo si hay algo que recorrer
    if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }

  onDown(e: MouseEvent, el: HTMLElement) {
    if (e.button !== 0) return;
    this.drag = { active: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
  }

  onMove(e: MouseEvent, el: HTMLElement) {
    const d = this.drag;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 5) d.moved = true;
    if (d.moved) el.scrollLeft = d.startLeft - dx;
  }

  onUp() {
    this.drag.active = false;
    if (this.drag.moved) setTimeout(() => (this.drag.moved = false));
  }
}
