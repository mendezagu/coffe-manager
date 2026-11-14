import { AfterViewInit, Component, ElementRef, Inject, Injectable, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

// value = ancho / alto del recorte; null = "Original" (la proporción de la foto tal cual)
export interface CropAspect {
  label: string;
  value: number | null;
}

export const DISH_ASPECTS: CropAspect[] = [
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
  { label: '16:9', value: 16 / 9 },
  { label: 'Original', value: null },
];
export const COVER_ASPECTS: CropAspect[] = [
  { label: '3:1', value: 3 },
  { label: '16:9', value: 16 / 9 },
  { label: 'Original', value: null },
];
export const BACKGROUND_ASPECTS: CropAspect[] = [
  { label: 'Original', value: null },
  { label: '1:1', value: 1 },
  { label: '9:16', value: 9 / 16 },
];

export interface CropOptions {
  title?: string;
  aspects?: CropAspect[];
  // etiqueta de la proporción que arranca elegida (por defecto, la primera)
  aspect?: string;
}

interface CropDialogData extends CropOptions {
  file: File;
}

// Recorte opcional antes de subir una foto: devuelve la foto recortada, la original si el usuario elige
// "Usar sin recortar", o null si cancela. No depende de ninguna librería externa.
@Injectable({ providedIn: 'root' })
export class ImageCropService {
  constructor(private dialog: MatDialog) {}

  async crop(file: File, options: CropOptions = {}): Promise<File | null> {
    const result = await firstValueFrom(
      this.dialog
        .open<ImageCropDialogComponent, CropDialogData, File | null>(ImageCropDialogComponent, {
          data: { ...options, file },
          width: '520px',
          maxWidth: '96vw',
          autoFocus: false,
        })
        .afterClosed(),
    );
    return result ?? null;
  }
}

const MAX_ZOOM = 5;
const MAX_OUTPUT_SIDE = 2000; // el recorte sale a buen tamaño; después se achica para subir

@Component({
  selector: 'app-image-crop-dialog',
  templateUrl: './image-crop-dialog.component.html',
})
export class ImageCropDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('stage', { static: true }) stageRef!: ElementRef<HTMLDivElement>;
  @ViewChild('img', { static: true }) imgRef!: ElementRef<HTMLImageElement>;

  readonly url: string;
  readonly aspects: CropAspect[];
  aspectIdx = 0;
  loaded = false;
  failed = false;
  busy = false;
  readonly maxZoom = MAX_ZOOM;

  zoom = 1;
  // Geometría (en px de pantalla) que usa la plantilla
  frameW = 0;
  frameH = 0;
  frameL = 0;
  frameT = 0;
  imgL = 0;
  imgT = 0;
  imgDispW = 0;
  imgDispH = 0;

  private imgW = 0;
  private imgH = 0;
  private cx = 0; // centro del recorte, en px de la foto original
  private cy = 0;
  private scale = 1; // px de pantalla por px de foto
  private stageW = 0;
  private stageH = 0;
  private observer?: ResizeObserver;
  private pts = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;

  constructor(
    public ref: MatDialogRef<ImageCropDialogComponent, File | null>,
    @Inject(MAT_DIALOG_DATA) public data: CropDialogData,
    private zone: NgZone,
  ) {
    this.url = URL.createObjectURL(data.file);
    this.aspects = data.aspects?.length ? data.aspects : DISH_ASPECTS;
    const wanted = this.aspects.findIndex((a) => a.label === data.aspect);
    this.aspectIdx = wanted >= 0 ? wanted : 0;
  }

  ngAfterViewInit() {
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.zone.run(() => this.measure()));
      this.observer.observe(this.stageRef.nativeElement);
    }
    this.measure();
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    URL.revokeObjectURL(this.url);
  }

  get aspect(): CropAspect {
    return this.aspects[this.aspectIdx];
  }

  get noCrop(): boolean {
    return this.aspect.value === null && this.zoom <= 1.001;
  }

  onLoad() {
    const img = this.imgRef.nativeElement;
    this.imgW = img.naturalWidth;
    this.imgH = img.naturalHeight;
    if (!this.imgW || !this.imgH) {
      this.failed = true;
      return;
    }
    this.cx = this.imgW / 2;
    this.cy = this.imgH / 2;
    this.loaded = true;
    this.measure();
  }

  onError() {
    this.failed = true;
  }

  setAspect(i: number) {
    this.aspectIdx = i;
    this.recalc();
  }

  setZoom(value: string | number) {
    this.zoom = Number(value);
    this.recalc();
  }

  // ---- Arrastrar (1 dedo / mouse), pellizcar (2 dedos), rueda y teclado
  onPointerDown(e: PointerEvent) {
    if (!this.loaded) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pts.size === 2) this.pinchDist = this.distance();
  }

  onPointerMove(e: PointerEvent) {
    const p = this.pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pts.size === 1) {
      this.cx -= dx / this.scale;
      this.cy -= dy / this.scale;
    } else if (this.pts.size === 2) {
      const d = this.distance();
      if (this.pinchDist > 0 && d > 0) this.zoom *= d / this.pinchDist;
      this.pinchDist = d;
    }
    this.recalc();
  }

  onPointerUp(e: PointerEvent) {
    this.pts.delete(e.pointerId);
    this.pinchDist = 0;
  }

  onWheel(e: WheelEvent) {
    if (!this.loaded) return;
    e.preventDefault();
    this.zoom *= Math.exp(-e.deltaY * 0.0015);
    this.recalc();
  }

  onKey(e: KeyboardEvent) {
    if (!this.loaded) return;
    const step = 24 / this.scale;
    switch (e.key) {
      case 'ArrowLeft': this.cx -= step; break;
      case 'ArrowRight': this.cx += step; break;
      case 'ArrowUp': this.cy -= step; break;
      case 'ArrowDown': this.cy += step; break;
      case '+': case '=': this.zoom *= 1.1; break;
      case '-': case '_': this.zoom /= 1.1; break;
      default: return;
    }
    e.preventDefault();
    this.recalc();
  }

  // ---- Resultado
  useOriginal() {
    this.ref.close(this.data.file);
  }

  async apply() {
    if (!this.loaded || this.busy) return;
    if (this.noCrop) return this.useOriginal();
    this.busy = true;
    try {
      const w = this.frameW / this.scale;
      const h = this.frameH / this.scale;
      const k = Math.min(1, MAX_OUTPUT_SIDE / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * k));
      canvas.height = Math.max(1, Math.round(h * k));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#ffffff'; // por si la foto tiene transparencia (el JPEG no la tiene)
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(this.imgRef.nativeElement, this.cx - w / 2, this.cy - h / 2, w, h, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('blob');
      const name = (this.data.file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
      this.ref.close(new File([blob], name, { type: 'image/jpeg' }));
    } catch {
      // si el navegador no pudo recortar, se sigue con la foto entera en vez de trabar al usuario
      this.ref.close(this.data.file);
    }
  }

  // ---- Geometría
  private measure() {
    const el = this.stageRef.nativeElement;
    this.stageW = el.clientWidth;
    this.stageH = el.clientHeight;
    this.recalc();
  }

  private distance(): number {
    const [a, b] = Array.from(this.pts.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private recalc() {
    if (!this.imgW || !this.stageW || !this.stageH) return;
    const a = this.aspect.value ?? this.imgW / this.imgH;
    const availW = Math.max(40, this.stageW - 32);
    const availH = Math.max(40, this.stageH - 32);
    this.frameW = Math.min(availW, availH * a);
    this.frameH = this.frameW / a;
    this.frameL = (this.stageW - this.frameW) / 2;
    this.frameT = (this.stageH - this.frameH) / 2;

    const minScale = Math.max(this.frameW / this.imgW, this.frameH / this.imgH);
    this.zoom = Math.min(MAX_ZOOM, Math.max(1, this.zoom));
    this.scale = minScale * this.zoom;

    // el recorte nunca se sale de la foto
    this.cx = this.clampCenter(this.cx, this.frameW / (2 * this.scale), this.imgW);
    this.cy = this.clampCenter(this.cy, this.frameH / (2 * this.scale), this.imgH);

    this.imgDispW = this.imgW * this.scale;
    this.imgDispH = this.imgH * this.scale;
    this.imgL = this.stageW / 2 - this.cx * this.scale;
    this.imgT = this.stageH / 2 - this.cy * this.scale;
  }

  private clampCenter(v: number, half: number, max: number): number {
    const lo = half;
    const hi = max - half;
    return lo >= hi ? max / 2 : Math.min(hi, Math.max(lo, v));
  }
}
