import { Component, ElementRef, HostListener } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Announcement, AnnouncementsService } from 'src/app/services/announcements.service';
import { plainText } from 'src/app/utils/rich-text';
import { AnnouncementsDialogComponent } from '../announcements-dialog/announcements-dialog.component';

// Campanita de novedades de Tavolapp: al tocarla se despliega un menú con las novedades (como las notificaciones
// de una red social). Al tocar una, se abre el detalle en una ventana y queda leída.
@Component({
  selector: 'app-news-menu',
  templateUrl: './news-menu.component.html',
})
export class NewsMenuComponent {
  open = false;
  tab: 'all' | 'unread' = 'all';
  items: Announcement[] = [];
  loading = false;
  error = false;

  constructor(
    public news: AnnouncementsService,
    private dialog: MatDialog,
    private host: ElementRef<HTMLElement>,
  ) {}

  get shown(): Announcement[] {
    return this.tab === 'unread' ? this.items.filter((a) => !a.read) : this.items;
  }

  get unreadInList(): number {
    return this.items.filter((a) => !a.read).length;
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) this.load();
  }

  close(): void {
    this.open = false;
  }

  load(): void {
    this.loading = !this.items.length; // si ya hay lista, se actualiza sin tapar lo que se ve
    this.error = false;
    this.news.list().subscribe({
      next: (list) => {
        this.items = list;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = true;
      },
    });
  }

  openItem(item: Announcement): void {
    this.close();
    this.dialog.open(AnnouncementsDialogComponent, { data: { mode: 'detail', item }, width: '560px', maxWidth: '96vw', autoFocus: false });
    if (!item.read) {
      item.read = true;
      this.news.markRead(item.id).subscribe({ error: () => {} });
    }
  }

  markAllRead(): void {
    this.news.markAllRead().subscribe({
      next: () => this.items.forEach((a) => (a.read = true)),
      error: () => {},
    });
  }

  snippet(item: Announcement): string {
    const text = plainText(item.body).replace(/\s+/g, ' ').trim();
    return text.length > 120 ? text.slice(0, 120) + '…' : text;
  }

  // "Hoy", "Ayer" o la fecha
  when(item: Announcement): string {
    if (!item.publishedAt) return '';
    const d = new Date(item.publishedAt);
    const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    if (days <= 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    return d.toLocaleDateString('es-AR');
  }

  trackItem = (_: number, a: Announcement) => a.id;

  // Se cierra al tocar afuera o con Esc
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.open && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
