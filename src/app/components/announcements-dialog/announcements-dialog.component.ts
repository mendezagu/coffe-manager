import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Announcement, AnnouncementsService } from 'src/app/services/announcements.service';
import { richText } from 'src/app/utils/rich-text';

export interface AnnouncementsDialogData {
  // 'popup': una novedad importante al entrar. 'list': todas las novedades (la campanita).
  mode: 'popup' | 'list';
  item?: Announcement;
}

// Novedades de Tavolapp: ventana al entrar (una importante) o lista de todas desde la campanita.
@Component({
  selector: 'app-announcements-dialog',
  templateUrl: './announcements-dialog.component.html',
})
export class AnnouncementsDialogComponent implements OnInit {
  items: Announcement[] = [];
  loading = false;
  error = false;
  // Imagen abierta en grande (al tocarla)
  zoom: string | null = null;

  constructor(
    private news: AnnouncementsService,
    private ref: MatDialogRef<AnnouncementsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AnnouncementsDialogData,
  ) {}

  get isPopup(): boolean {
    return this.data.mode === 'popup' && !!this.data.item;
  }

  ngOnInit(): void {
    if (this.isPopup) {
      this.items = [this.data.item!];
      return;
    }
    this.loading = true;
    this.news.list().subscribe({
      next: (list) => {
        this.items = list;
        this.loading = false;
        // lo que se ve en la lista queda leído: la campanita se apaga, pero acá se siguen distinguiendo las nuevas
        if (list.some((a) => !a.read)) this.news.markAllRead().subscribe({ error: () => {} });
      },
      error: () => {
        this.loading = false;
        this.error = true;
      },
    });
  }

  get unreadCount(): number {
    return this.items.filter((a) => !a.read).length;
  }

  // "Entendido" en la ventana de entrada: queda leída
  understood(): void {
    const item = this.data.item;
    if (item) this.news.markRead(item.id).subscribe({ error: () => {} });
    this.ref.close();
  }

  close(): void {
    this.ref.close();
  }

  // El texto con negrita, cursiva y listas (ya escapado: no hay forma de colar código)
  rich = richText;

  trackItem = (_: number, a: Announcement) => a.id;
}
