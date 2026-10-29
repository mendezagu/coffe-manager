import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { MenuItem } from '../models/coffe.models';

// Lado más largo de la foto una vez achicada, y peso objetivo (el servidor rechaza más de 400 KB)
const MAX_SIDE = 800;
const TARGET_BYTES = 300 * 1024;

export type BrandKind = 'cover' | 'background';
export interface BrandImages {
  coverImageUrl: string | null;
  backgroundImageUrl: string | null;
}

interface UploadSlot {
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
  maxBytes: number;
}

// Fotos de los platos: se achican acá (en el celular o la compu) y se suben DIRECTO al almacenamiento con un permiso
// firmado de la API; después se le avisa a la API para que la asocie al plato.
@Injectable({ providedIn: 'root' })
export class MenuImageService {
  private readonly base = `${environment.apiUrl}/menu`;

  constructor(private http: HttpClient) {}

  // Achica la foto a WebP: un archivo de varios MB sale de unos 60–150 KB, sin pérdida que se note en pantalla
  async shrink(file: File, maxSide = MAX_SIDE, targetBytes = TARGET_BYTES): Promise<Blob> {
    if (!file.type.startsWith('image/')) throw new Error('Elegí una foto (JPG, PNG o WebP)');
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo preparar la foto');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const toBlob = (quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    let blob: Blob | null = null;
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
      blob = await toBlob(quality);
      if (blob && blob.size <= targetBytes) break;
    }
    if (!blob || blob.type !== 'image/webp') throw new Error('Tu navegador no pudo preparar la foto. Probá con otro.');
    return blob;
  }

  // Achica, sube y asocia la foto al plato. Devuelve el plato con su dirección de foto.
  async upload(itemId: string, file: File): Promise<MenuItem> {
    const blob = await this.shrink(file);
    const slot = await firstValueFrom(this.http.post<UploadSlot>(`${this.base}/${itemId}/image/upload-url`, { contentType: blob.type }));
    if (blob.size > slot.maxBytes) throw new Error('La foto pesa demasiado. Probá con otra.');

    // Camino directo: fetch y no HttpClient, porque el permiso ya viaja firmado en la dirección y no hay que
    // mandarle nuestra sesión al almacenamiento
    let direct = false;
    try {
      const res = await fetch(slot.uploadUrl, { method: 'PUT', headers: slot.headers, body: blob });
      direct = res.ok;
    } catch {
      direct = false; // algunas redes o antivirus cortan la conexión directa con el almacenamiento
    }
    if (direct) return firstValueFrom(this.http.post<MenuItem>(`${this.base}/${itemId}/image`, { key: slot.key }));

    // Alternativa: la foto (ya chica) viaja por la API y la API la guarda
    return firstValueFrom(
      this.http.post<MenuItem>(`${this.base}/${itemId}/image/file`, blob, { headers: { 'Content-Type': blob.type } }),
    );
  }

  // ---- Portada (banda de arriba) y fondo de la carta: mismo camino que las fotos de los platos
  async uploadBrand(kind: BrandKind, file: File): Promise<BrandImages> {
    const blob = await this.shrink(file, kind === 'cover' ? 1600 : 1400, 450 * 1024);
    const base = `${environment.apiUrl}/settings/brand-image`;
    const slot = await firstValueFrom(this.http.post<UploadSlot>(`${base}/upload-url`, { kind, contentType: blob.type }));
    if (blob.size > slot.maxBytes) throw new Error('La imagen pesa demasiado. Probá con otra.');

    let direct = false;
    try {
      const res = await fetch(slot.uploadUrl, { method: 'PUT', headers: slot.headers, body: blob });
      direct = res.ok;
    } catch {
      direct = false;
    }
    if (direct) return firstValueFrom(this.http.post<BrandImages>(`${base}/attach`, { kind, key: slot.key }));
    return firstValueFrom(this.http.post<BrandImages>(`${base}/file/${kind}`, blob, { headers: { 'Content-Type': blob.type } }));
  }

  removeBrand(kind: BrandKind): Observable<BrandImages> {
    return this.http.delete<BrandImages>(`${environment.apiUrl}/settings/brand-image/${kind}`);
  }

  remove(itemId: string): Observable<MenuItem> {
    return this.http.delete<MenuItem>(`${this.base}/${itemId}/image`);
  }
}
