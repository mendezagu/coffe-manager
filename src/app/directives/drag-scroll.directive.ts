import { AfterViewInit, Directive, ElementRef, HostListener, NgZone, OnDestroy } from '@angular/core';

// Fila que se desliza hacia los costados: con el dedo (celular) lo hace el navegador; con el mouse (compu) se puede
// arrastrar con el botón apretado y, si quien la usa quiere, mover con las flechas (scrollPage).
// Uso: <ul appDragScroll #rail="dragScroll"> ... <button (click)="rail.scrollPage(1)" [disabled]="!rail.canNext">
@Directive({
  selector: '[appDragScroll]',
  exportAs: 'dragScroll',
})
export class DragScrollDirective implements AfterViewInit, OnDestroy {
  canPrev = false;
  canNext = false;

  private pressed = false;
  private moved = false;
  private startX = 0;
  private startLeft = 0;
  private observer?: ResizeObserver;

  private readonly onClickCapture = (e: Event) => {
    // si se arrastró, el soltar el mouse no cuenta como un clic sobre la tarjeta
    if (this.moved) {
      e.stopPropagation();
      e.preventDefault();
      this.moved = false;
    }
  };

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {
    const el = host.nativeElement;
    el.style.cursor = 'grab';
    el.style.touchAction = 'pan-x pan-y'; // el dedo puede deslizar hacia los costados y hacia abajo
    el.style.overscrollBehaviorX = 'contain';
    el.addEventListener('click', this.onClickCapture, true);
  }

  ngAfterViewInit() {
    this.update();
    // el contenido puede cambiar (por ejemplo al buscar): se vuelve a medir
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.zone.run(() => this.update()));
      this.observer.observe(this.host.nativeElement);
      Array.from(this.host.nativeElement.children).forEach((c) => this.observer!.observe(c));
    }
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.host.nativeElement.removeEventListener('click', this.onClickCapture, true);
  }

  update() {
    const el = this.host.nativeElement;
    this.canPrev = el.scrollLeft > 4;
    this.canNext = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
  }

  scrollPage(direction: 1 | -1) {
    const el = this.host.nativeElement;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  @HostListener('scroll') onScroll() {
    this.update();
  }

  @HostListener('window:resize') onResize() {
    this.update();
  }

  // La imagen no se "agarra" como archivo al arrastrar
  @HostListener('dragstart', ['$event']) onDragStart(e: Event) {
    e.preventDefault();
  }

  @HostListener('pointerdown', ['$event']) onDown(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return; // con el dedo lo resuelve el navegador
    const el = this.host.nativeElement;
    this.pressed = true;
    this.moved = false;
    this.startX = e.clientX;
    this.startLeft = el.scrollLeft;
  }

  @HostListener('window:pointermove', ['$event']) onMove(e: PointerEvent) {
    if (!this.pressed) return;
    const el = this.host.nativeElement;
    const dx = e.clientX - this.startX;
    if (!this.moved && Math.abs(dx) > 5) {
      this.moved = true;
      el.style.scrollSnapType = 'none'; // sin imanes mientras se arrastra
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    }
    if (this.moved) el.scrollLeft = this.startLeft - dx;
  }

  @HostListener('window:pointerup') onUp() {
    if (!this.pressed) return;
    this.pressed = false;
    const el = this.host.nativeElement;
    el.style.scrollSnapType = ''; // vuelve el imán y la fila se acomoda sola
    el.style.cursor = 'grab';
    el.style.userSelect = '';
    // si se movió, el clic que viene a continuación se descarta (onClickCapture)
    setTimeout(() => (this.moved = false), 0);
  }
}
