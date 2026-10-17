import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ModifierPickerDialogComponent } from '../modifier-picker-dialog/modifier-picker-dialog.component';
import { OrderModifier, lineKey, modifiersText } from 'src/app/utils/modifiers';
import { TicketService } from 'src/app/services/ticket.service';
import { Category, ModifierGroup } from 'src/app/services/gestionService';
import { GestionService, MenuItem, Table } from 'src/app/services/gestionService';

@Component({
  selector: 'app-menu-dialog',
  templateUrl: './menu-dialog.component.html',
  styleUrls: ['./menu-dialog.component.scss']
})
export class MenuDialogComponent {

  menuItems: MenuItem[] = [];
  selectedItems: MenuItem[] = [];
  canPrint: boolean = false;
  filterText: string = '';
  waiterName: string = '';

  // Objeto auxiliar para rastrear menús agregados temporalmente
  addedItems: { [key: string]: boolean } = {};

  constructor(
    private gestionService: GestionService,
    private tickets: TicketService,
    private dialog: MatDialog,
    public dialogRef: MatDialogRef<MenuDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Table  // Se pasa la información de la mesa si es necesario
  ) {}

  // Modificadores (tamaño, leche, extras…) que ofrece cada plato
  modifierGroups: ModifierGroup[] = [];

  // Los grupos de un plato, en el orden del plato y solo con las opciones disponibles
  groupsFor(menu: MenuItem): ModifierGroup[] {
    return (menu.modifierGroupIds ?? [])
      .map(id => this.modifierGroups.find(g => g._id === id))
      .filter((g): g is ModifierGroup => !!g)
      .map(g => ({ ...g, options: g.options.filter(o => o.active) }))
      .filter(g => g.options.length > 0);
  }

  hasModifiers(menu: MenuItem): boolean {
    return this.groupsFor(menu).length > 0;
  }

  modifiersText = modifiersText;

  // Mensaje del servidor pensado para la persona (ej: "No hay stock suficiente…"); si no hay, uno genérico
  private serverMessage(error: any, fallback: string): string {
    const message = String(error?.message ?? '');
    return message && !message.startsWith('Error ') ? message : fallback;
  }

  ngOnInit(): void {
     console.log('Datos recibidos en MenuDialogComponent:', this.data);
    this.loadMenu();
    this.gestionService.getCategories().subscribe({ next: (c) => (this.categories = c), error: () => {} });
    this.gestionService.getModifiers().subscribe({ next: (g) => (this.modifierGroups = g), error: () => {} });
    // Verificamos si 'this.data.waiter' es un objeto de tipo Waiter y accedemos al nombre del mozo
  if (this.data && this.data.waiter) {
    if (typeof this.data.waiter === 'object' && this.data.waiter.name) {
      this.waiterName = this.data.waiter.name;  // Accedemos al nombre del mozo
    } else {
      this.waiterName = 'Desconocido';  // Si no tiene la propiedad 'name', asignamos un valor por defecto
    }
  } else {
    this.waiterName = 'Desconocido';  // Si no hay 'waiter' en los datos, asignamos un valor por defecto
  }

    // Escuchar el mensaje de cierre desde la ventana de impresión
    window.addEventListener('message', (event) => {
      if (event.data === 'closeDialog') {
        this.dialogRef.close(this.selectedItems); // Cerrar el diálogo
      }
    });
  }

  loadMenu(): void {
    this.gestionService.getMenu().subscribe((menus) => {
      this.menuItems = menus.map(menu => ({ ...menu, quantity: 1 })); // Establecer cantidad en 0
      //this.menuItems = menus;
      console.log(this.menuItems, 'menuItems desde dialog menu');
      
    });
  }
  // Categorías para filtrar: 'all' = todo, 'none' = platos sin categoría, o el id de una categoría
  categories: Category[] = [];
  selectedCategory: string = 'all';

  get hasUncategorized(): boolean {
    return this.categories.length > 0 && this.menuItems.some(m => !m.categoryId);
  }

  get filteredMenuItems(): MenuItem[] {
    return this.menuItems.filter(menu =>
      menu.name.toLowerCase().includes(this.filterText.toLowerCase()) &&
      (this.selectedCategory === 'all' ||
        (this.selectedCategory === 'none' ? !menu.categoryId : menu.categoryId === this.selectedCategory))
    );
  }

  toggleSelection(menu: MenuItem, event: any): void {
    const index = this.selectedItems.findIndex(item => item._id === menu._id);
    if (event.target.checked) {
      if (index === -1) {
        this.selectedItems.push({ ...menu, quantity: 1, note: '' });
      }
    } else {
      if (index > -1) {
        this.selectedItems.splice(index, 1);
      }
    }
  }

  updateNote(item: MenuItem, event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const index = this.selectedItems.findIndex(selected => (selected.lineKey ?? selected._id) === (item.lineKey ?? item._id));
    if (index > -1) {
      this.selectedItems[index].note = inputElement.value;
    }
  }

updateQuantity(menu: MenuItem, event: Event): void {
  const inputElement = event.target as HTMLInputElement;
  const quantity = parseInt(inputElement.value, 10);
  menu.quantity = quantity;

  // Un plato con opciones puede estar varias veces (cada una con las suyas): ahí la cantidad se toca
  // en la línea seleccionada, no desde la lista del menú.
  const index = this.hasModifiers(menu) ? -1 : this.selectedItems.findIndex(item => item._id === menu._id);
  if (index > -1) {
    this.selectedItems[index].quantity = quantity;

    // Obtener nombre del mozo (por si acaso cambia dinámicamente)
    const mozo = this.waiterName || (this.data.waiter?.name ?? 'Desconocido');

    // Registrar en el log la modificación
    this.gestionService.saveLog(
      `Se actualizó la cantidad de <strong>${menu.name}</strong> a <strong>${quantity}</strong> en la mesa <strong>${this.data.name}</strong> por el mozo <strong>${mozo}</strong>.`
    );
  }
}


  

  // Cierra el diálogo y devuelve los items seleccionados
   // Cierra el diálogo después de imprimir el ticket
   printTicket(): void {
    if (!this.selectedItems.length) {
      alert("No hay ítems seleccionados para imprimir.");
      return;
    }
  
    this.gestionService.addItemsToTable(this.data.id, this.selectedItems).subscribe(
      (updatedTable) => {
        this.data.orders = updatedTable.orders;
        this.data.available = false; // Marcamos la mesa como ocupada
        this.canPrint = false; // 🔴 Deshabilitamos el botón de imprimir

 // Construir log detallado con cantidades, nombres y mozo
      const itemsDescription = this.selectedItems
        .map(item => `${item.quantity}x ${item.name}${item.selectedModifiers?.length ? ' [' + modifiersText(item.selectedModifiers) + ']' : ''}${item.note ? ' (' + item.note + ')' : ''}`)
        .join(', ');

      const mozo = this.waiterName || (this.data.waiter?.name ?? 'Desconocido');
      console.log(mozo);
      

      this.gestionService.saveLog(
        `Se agregaron: <strong>${itemsDescription}</strong> a la mesa <strong>${this.data.name}</strong> por el mozo <strong>${mozo}</strong>`
      );
  
        // Comanda impresa con la plantilla única (TicketService)
        const opened = this.tickets.printComanda(
          {
            tableName: this.data.name,
            waiterName: this.data.waiter?.name || this.waiterName || this.data.waiterName,
            lines: this.selectedItems.map(item => ({
              name: item.name,
              quantity: item.quantity ?? 1,
              modifiers: modifiersText(item.selectedModifiers),
              note: item.note,
            })),
          },
          { reloadOpenerAfterPrint: true }
        );
        if (opened) {
          this.dialogRef.close();
          location.reload();
        }
          const logMessage = `Se imprimió <strong>la comanda</strong> de la mesa <strong>${this.data.name}</strong> atendida por <strong>${this.data.waiterName || 'Sin asignar'}</strong>`;
          this.gestionService.saveLog(logMessage);
      },
      (error) => {
        console.error("Error al actualizar la mesa:", error);
        alert(this.serverMessage(error, 'Ocurrió un error al actualizar la mesa antes de imprimir.'));
      }
    );
  }


  // Agregar un plato. Si ofrece opciones (tamaño, leche, extras…) primero se eligen.
  addItem(menu: MenuItem): void {
    // Con inventario: no se pide más de lo que se puede preparar (el servidor también lo comprueba)
    const limit = menu.availableUnits;
    if (limit !== null && limit !== undefined) {
      const already = this.selectedItems.filter((s) => s._id === menu._id).reduce((n, s) => n + (s.quantity ?? 0), 0);
      if (limit === 0 || already + (menu.quantity ?? 1) > limit) {
        alert(limit === 0 ? `${menu.name} está agotado.` : `Solo quedan ${limit} de ${menu.name}.`);
        return;
      }
    }
    const groups = this.groupsFor(menu);
    if (!groups.length) {
      this.commitAdd(menu, []);
      return;
    }
    // Si se piden varias unidades, las opciones se eligen una por una (dos cafés pueden ser distintos)
    const units = Math.max(1, Math.floor(menu.quantity ?? 1));
    this.dialog
      .open<ModifierPickerDialogComponent, any, OrderModifier[][]>(ModifierPickerDialogComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: { item: menu, groups, units },
      })
      .afterClosed()
      .subscribe(perUnit => {
        if (!perUnit) return;
        // Las unidades con las mismas opciones quedan juntas en una sola línea
        const lines = new Map<string, { mods: OrderModifier[]; count: number }>();
        for (const mods of perUnit) {
          const key = lineKey(menu._id, mods);
          const line = lines.get(key);
          if (line) line.count += 1;
          else lines.set(key, { mods, count: 1 });
        }
        for (const { mods, count } of lines.values()) this.commitAdd(menu, mods, count);
        menu.quantity = 1; // la cantidad ya se repartió entre las unidades
      });
  }

  // qty: cuántas unidades tiene esta combinación de opciones; sin indicarla, se comporta como siempre
  private commitAdd(menu: MenuItem, mods: OrderModifier[], qty?: number): void {
    const key = lineKey(menu._id, mods);
    const index = this.selectedItems.findIndex(item => (item.lineKey ?? item._id) === key);

    if (index === -1) {
      // Si esa combinación no está en la lista, la agregamos con cantidad mínima 1
      this.selectedItems.push({ ...menu, quantity: qty ?? menu.quantity ?? 1, note: '', selectedModifiers: mods, lineKey: key });
    } else {
      // Si ya está, incrementamos la cantidad asegurándonos de que no sea undefined
      this.selectedItems[index].quantity = (this.selectedItems[index].quantity ?? 0) + (qty ?? 1);
    }

    // Marcar el botón como "agregado" en el objeto auxiliar
    this.addedItems[menu._id] = true;

    // Restaurar el color después de 2 segundos
    setTimeout(() => {
      this.addedItems[menu._id] = false;
    }, 2000);

    this.canPrint = this.selectedItems.length > 0; // Habilitar botón de imprimir si hay elementos
  }

  // Para marcar con un check los platos que ya están en la orden (con cualquier combinación de opciones)
  isSelected(menu: MenuItem): boolean {
    return this.selectedItems.some(s => s._id === menu._id);
  }

  selectedQty(menu: MenuItem): number {
    return this.selectedItems.filter(s => s._id === menu._id).reduce((n, s) => n + (s.quantity ?? 0), 0);
  }

  removeSelectedItem(item: MenuItem): void {
    const index = this.selectedItems.findIndex(selected => (selected.lineKey ?? selected._id) === (item.lineKey ?? item._id));
    if (index > -1) {
      this.selectedItems.splice(index, 1);
    }

    // Actualizar el estado del botón de imprimir
    this.canPrint = this.selectedItems.length > 0;

    // Resetear el estado "agregado" del botón solo si ya no queda ninguna línea de ese plato
    if (!this.selectedItems.some(s => s._id === item._id)) {
      this.addedItems[item._id] = false;
    }
  }

  // Cancela la operación
  cancel(): void {
    this.dialogRef.close();
  }
}