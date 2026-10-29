import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Category, GestionService, MenuItem, Waiter } from 'src/app/services/gestionService';
import { OnboardingService, OnboardingStatus, OnboardingTemplate, isSetupPending } from 'src/app/services/onboarding.service';
import { SettingsService } from 'src/app/services/settings.service';
import { REGIONS, Region } from 'src/app/pages/settings/settings.component';
import { shrinkImage } from 'src/app/utils/shrink-image';
import { MenuImageService } from 'src/app/services/menu-image.service';

const STEPS = [
  { label: 'Tu negocio', icon: 'storefront' },
  { label: 'Tu menú', icon: 'restaurant_menu' },
  { label: 'Tus mesas', icon: 'table_restaurant' },
  { label: 'Tu equipo', icon: 'person' },
  { label: 'A probar', icon: 'rocket_launch' },
];

const MAX_TABLES = 100;
const PREVIEW_TABLES = 20;

interface MenuGroup {
  name: string;
  items: MenuItem[];
}

// Asistente de primeros pasos: lo mínimo para cobrar la primera venta (negocio, menú, mesas).
// Todo lo demás (mozos, sectores, modificadores…) queda en el checklist del inicio.
@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.scss'],
})
export class OnboardingComponent implements OnInit {
  readonly steps = STEPS;
  step = 0;
  loading = true;
  busy = false;
  error = '';

  status: OnboardingStatus | null = null;

  // Paso 1: negocio
  regions: Region[] = REGIONS;
  name = '';
  logo: string | null = null;
  region = 'ARS|es-AR';

  // Paso 2: menú
  items: MenuItem[] = [];
  categories: Category[] = [];
  manualMode = false;
  newName = '';
  newPrice: number | null = null;
  newCategory = '';
  savedIds = new Set<string>();

  // Paso 4: mozos
  waiters: Waiter[] = [];
  newWaiter = '';

  // Paso 3: mesas
  tableCount = 10;
  readonly quickCounts = [4, 8, 12, 20];

  constructor(
    private gestion: GestionService,
    private onboarding: OnboardingService,
    private settings: SettingsService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private menuImages: MenuImageService,
  ) {}

  ngOnInit() {
    this.settings.refresh().subscribe({
      next: (s) => {
        this.name = s.name;
        this.logo = s.logoUrl;
        this.region = `${s.currencyCode}|${s.locale}`;
        if (!REGIONS.some((r) => `${r.currencyCode}|${r.locale}` === this.region)) {
          this.regions = [...REGIONS, { label: `Personalizada (${s.currencyCode}, ${s.locale})`, currencyCode: s.currencyCode, locale: s.locale }];
        }
      },
      error: () => {},
    });
    this.reload(true);
  }

  // ---- Datos ----

  private reload(first = false) {
    this.onboarding.status().subscribe({
      next: (s) => {
        this.status = s;
        // Si ya está todo hecho, no tiene nada que hacer acá (si salteó el asistente pero falta algo, sigue acá)
        if (first && s.done && !isSetupPending(s.counts, this.counterOnly)) return void this.router.navigate([this.homeUrl]);
        if (first) {
          if (s.counts.tables > 0) this.tableCount = 0;
          // Arranca en lo primero que falta (o en el paso que se tocó en la lista de primeros pasos)
          const wanted = Number(this.route.snapshot.queryParamMap.get('step'));
          const c = s.counts;
          const auto = this.counterOnly ? (c.menuItems === 0 ? 0 : 4) : c.menuItems === 0 ? (c.tables > 0 ? 1 : 0) : c.tables === 0 ? 2 : c.waiters === 0 ? 3 : 4;
          this.step = Number.isInteger(wanted) && wanted >= 0 && wanted < STEPS.length && this.route.snapshot.queryParamMap.has('step') ? wanted : auto;
        }
        this.loading = false;
        this.loadMenu();
      },
      error: () => {
        // Sin el estado no se puede guiar: se deja usar la app normalmente
        this.router.navigate(['/home']);
      },
    });
  }

  private loadMenu() {
    this.gestion.refreshMenu().subscribe({ next: (items) => (this.items = items), error: () => {} });
    this.gestion.getCategories().subscribe({ next: (c) => (this.categories = c), error: () => {} });
    this.gestion.getWaiters().subscribe({ next: (w) => (this.waiters = w), error: () => {} });
  }

  // ---- Navegación ----

  get current() {
    return this.steps[this.step];
  }

  // Un negocio que vende solo en mostrador no pasa por los pasos de mesas y equipo
  get counterOnly(): boolean {
    return this.settings.value.salesMode === 'counter';
  }

  get homeUrl(): string {
    return this.counterOnly ? '/counter' : '/home';
  }

  // Los pasos que se muestran en el progreso, cada uno con su posición real
  get visibleSteps(): { label: string; icon: string; idx: number }[] {
    return this.steps.map((s, idx) => ({ ...s, idx })).filter((s) => !(this.counterOnly && (s.idx === 2 || s.idx === 3)));
  }

  get visiblePosition(): number {
    return this.visibleSteps.findIndex((s) => s.idx === this.step) + 1;
  }

  back() {
    if (this.busy || this.step === 0) return;
    this.error = '';
    this.goTo(this.counterOnly && this.step === 4 ? 1 : this.step - 1);
  }

  private goTo(step: number) {
    this.step = step;
    this.error = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  get canContinue(): boolean {
    switch (this.step) {
      case 0:
        return this.name.trim().length > 0;
      case 1:
        return this.items.length > 0;
      case 2:
        return this.tableCount > 0 || (this.status?.counts.tables ?? 0) > 0;
      case 3:
        return this.waiters.length > 0;
      default:
        return true;
    }
  }

  get continueLabel(): string {
    switch (this.step) {
      case 0:
        return 'Guardar y seguir';
      case 1:
        return this.counterOnly ? 'Seguir' : 'Seguir con las mesas';
      case 2:
        return this.tableCount > 0 ? `Crear ${this.tableCount} ${this.tableCount === 1 ? 'mesa' : 'mesas'}` : 'Seguir';
      case 3:
        return 'Seguir';
      default:
        return this.counterOnly ? 'Ir al Mostrador' : 'Ir a mis mesas';
    }
  }

  next() {
    if (this.busy || !this.canContinue) return;
    this.error = '';
    if (this.step === 0) return this.saveBusiness();
    if (this.step === 1) return this.goTo(this.counterOnly ? 4 : 2);
    if (this.step === 2) return this.saveTables();
    if (this.step === 3) return this.goTo(4);
    this.finish();
  }

  // "Saltar por ahora": entra a la app; lo que falte queda en el checklist del inicio
  skip() {
    if (this.busy) return;
    this.finish();
  }

  private finish() {
    this.busy = true;
    this.settings.update({ onboardingDone: true }).subscribe({
      next: () => {
        this.onboarding.knownDone = true;
        this.router.navigate([this.homeUrl]);
      },
      error: (err) => {
        this.busy = false;
        this.fail(err, 'No se pudo terminar el asistente. Probá de nuevo.');
      },
    });
  }

  // ---- Paso 1: negocio ----

  async onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      this.error = 'Elegí una imagen PNG, JPG o WEBP.';
      return;
    }
    try {
      this.logo = await shrinkImage(file);
      this.error = '';
    } catch {
      this.error = 'No se pudo leer la imagen. Probá con otra.';
    }
  }

  removeLogo() {
    this.logo = null;
  }

  regionKey(r: Region) {
    return `${r.currencyCode}|${r.locale}`;
  }

  private saveBusiness() {
    const [currencyCode, locale] = this.region.split('|');
    this.busy = true;
    this.settings.update({ name: this.name.trim(), logoUrl: this.logo, currencyCode, locale }).subscribe({
      next: () => {
        this.busy = false;
        this.goTo(1);
      },
      error: (err) => {
        this.busy = false;
        this.fail(err, 'No se pudieron guardar los datos del negocio.');
      },
    });
  }

  // ---- Paso 2: menú ----

  get template(): OnboardingTemplate | undefined {
    return this.status?.templates[0];
  }

  get showChoice(): boolean {
    return this.items.length === 0 && !this.manualMode;
  }

  get hasExample(): boolean {
    return (this.status?.counts.exampleItems ?? 0) > 0;
  }

  get currencySymbol(): string {
    const [currency, locale] = this.region.split('|');
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? '$';
    } catch {
      return '$';
    }
  }

  get groups(): MenuGroup[] {
    const byId = new Map(this.categories.map((c) => [c._id, c.name]));
    const groups = new Map<string, MenuItem[]>();
    for (const item of this.items) {
      const name = (item.categoryId && byId.get(item.categoryId)) || 'Sin categoría';
      groups.set(name, [...(groups.get(name) ?? []), item]);
    }
    // el orden de las categorías es el del servidor; "Sin categoría" al final
    const order = [...this.categories.map((c) => c.name), 'Sin categoría'];
    return order.filter((n) => groups.has(n)).map((name) => ({ name, items: groups.get(name)! }));
  }

  applyTemplate() {
    const template = this.template;
    if (!template || this.busy) return;
    this.busy = true;
    this.onboarding.applyTemplate(template.key).subscribe({
      next: () => {
        this.busy = false;
        this.reload();
      },
      error: (err) => {
        this.busy = false;
        this.fail(err, 'No se pudo cargar el menú de ejemplo.');
      },
    });
  }

  startEmpty() {
    this.manualMode = true;
  }

  // Se puede volver a elegir cómo empezar mientras no haya platos propios: solo ejemplo, o nada
  get canSwitch(): boolean {
    const c = this.status?.counts;
    return !this.showChoice && !!c && c.menuItems === c.exampleItems;
  }

  backToChoice() {
    if (this.busy) return;
    if (this.hasExample) return this.removeExample();
    this.manualMode = false;
  }

  removeExample() {
    if (this.busy) return;
    this.busy = true;
    this.onboarding.removeTemplate().subscribe({
      next: () => {
        this.busy = false;
        this.manualMode = false;
        this.reload();
      },
      error: (err) => {
        this.busy = false;
        this.fail(err, 'No se pudo borrar el ejemplo.');
      },
    });
  }

  changePrice(item: MenuItem, value: string) {
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) {
      this.error = 'El precio tiene que ser un número.';
      return;
    }
    if (price === item.price) return;
    this.error = '';
    this.gestion.editMenuItem(item._id, item.name, price, item.isPromo ?? false, item.categoryId ?? null).subscribe({
      next: () => {
        item.price = price;
        this.savedIds.add(item._id);
        setTimeout(() => this.savedIds.delete(item._id), 1800);
        this.reload();
      },
      error: () => (this.error = 'No se pudo guardar el precio.'),
    });
  }

  removeItem(item: MenuItem) {
    this.gestion.deleteMenuItem(item._id).subscribe({
      next: () => this.reload(),
      error: () => (this.error = 'No se pudo borrar el plato.'),
    });
  }

  // ---- Fotos de los platos (opcionales): se pueden poner al agregar un plato o después, en cada fila ----

  get imagesAvailable(): boolean {
    return !!this.settings.value.imagesAvailable;
  }

  newPhoto: File | null = null;
  newPhotoPreview: string | null = null;
  photoBusyId: string | null = null;

  onNewPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.error = 'Elegí una foto (JPG, PNG o WebP).';
      return;
    }
    this.error = '';
    this.clearNewPhoto();
    this.newPhoto = file;
    this.newPhotoPreview = URL.createObjectURL(file);
  }

  clearNewPhoto() {
    if (this.newPhotoPreview) URL.revokeObjectURL(this.newPhotoPreview);
    this.newPhoto = null;
    this.newPhotoPreview = null;
  }

  // Foto de un plato que ya está en la lista
  async onItemPhoto(item: MenuItem, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.photoBusyId = item._id;
    this.error = '';
    try {
      const updated = await this.menuImages.upload(item._id, file);
      item.imageUrl = updated.imageUrl ?? null;
      this.reload();
    } catch (e: any) {
      const msg = e?.error?.message ?? e?.message;
      this.error = (Array.isArray(msg) ? msg.join('. ') : msg) || 'No se pudo guardar la foto. Probá de nuevo.';
    } finally {
      this.photoBusyId = null;
    }
  }

  get canAddItem(): boolean {
    return this.newName.trim().length > 0 && this.newPrice !== null && this.newPrice >= 0;
  }

  addItem() {
    if (!this.canAddItem || this.busy) return;
    this.busy = true;
    this.error = '';
    const wanted = this.newCategory.trim();
    this.resolveCategory(wanted).subscribe({
      next: (categoryId) => {
        this.gestion.addMenuItem(this.newName.trim(), Number(this.newPrice), false, categoryId).subscribe({
          next: async (created) => {
            // la foto es opcional: si falla, el plato queda cargado igual y se avisa
            const photo = this.newPhoto;
            if (photo && this.imagesAvailable) {
              try {
                await this.menuImages.upload(created._id, photo);
              } catch {
                this.error = 'El plato se agregó, pero la foto no se pudo subir. Probá de nuevo desde la lista o más tarde en Administrar → Menú.';
              }
            }
            this.busy = false;
            this.newName = '';
            this.newPrice = null;
            this.clearNewPhoto();
            this.reload();
          },
          error: () => {
            this.busy = false;
            this.error = 'No se pudo agregar el plato.';
          },
        });
      },
      error: (err) => {
        this.busy = false;
        this.fail(err, 'No se pudo crear la categoría.');
      },
    });
  }

  // Usa la categoría si ya existe (sin importar tildes ni mayúsculas) y, si no, la crea
  private resolveCategory(name: string) {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
    return new Observable<string | null>((sub) => {
      if (!name) {
        sub.next(null);
        return sub.complete();
      }
      const found = this.categories.find((c) => norm(c.name) === norm(name));
      if (found) {
        sub.next(found._id);
        return sub.complete();
      }
      this.gestion.addCategory(name).subscribe({
        next: (c) => {
          sub.next(c._id);
          sub.complete();
        },
        error: (e) => sub.error(e),
      });
    });
  }

  // ---- Paso 3: mesas ----

  get existingTables(): number {
    return this.status?.counts.tables ?? 0;
  }

  setTables(n: number) {
    this.tableCount = Math.min(MAX_TABLES, Math.max(0, Math.round(Number(n) || 0)));
  }

  get tablePreview(): number[] {
    const start = this.existingTables;
    return Array.from({ length: Math.min(this.tableCount, PREVIEW_TABLES) }, (_, i) => start + i + 1);
  }

  get tablesHidden(): number {
    return Math.max(0, this.tableCount - PREVIEW_TABLES);
  }

  private saveTables() {
    if (this.tableCount === 0) return this.goTo(3);
    this.busy = true;
    this.onboarding.createTables(this.tableCount).subscribe({
      next: () => {
        this.busy = false;
        this.reload();
        this.goTo(3);
      },
      error: (err) => {
        this.busy = false;
        this.fail(err, 'No se pudieron crear las mesas.');
      },
    });
  }

  // ---- Paso 4: mozos ----

  addWaiter() {
    const name = this.newWaiter.trim();
    if (!name || this.busy) return;
    this.busy = true;
    this.error = '';
    this.gestion.addWaiter(name).subscribe({
      next: () => {
        this.busy = false;
        this.newWaiter = '';
        this.reload();
      },
      error: (err) => {
        this.busy = false;
        this.fail(err, 'No se pudo agregar al mozo.');
      },
    });
  }

  removeWaiter(w: Waiter) {
    this.gestion.deleteWaiter(w._id).subscribe({
      next: () => this.reload(),
      error: () => (this.error = 'No se pudo borrar al mozo.'),
    });
  }

  // ---- Utilidades ----

  private fail(err: any, fallback: string) {
    const msg = err?.error?.message ?? err?.message;
    this.error = Array.isArray(msg) ? msg.join('. ') : msg || fallback;
    this.snackBar.open(this.error, 'Cerrar', { duration: 4000 });
  }

  trackIndex(i: number) {
    return i;
  }
}
