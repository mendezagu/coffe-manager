---
name: Tavolapp
description: Panel de gestión gastronómica en verde botella casi negro, sobre superficies salvia, para operar con apuro desde tablet y celular.
colors:
  primary: "#1b2822"
  primary-hover: "#131d18"
  primary-deep: "#0c1511"
  sidebar: "#07241a"
  sidebar-active: "#1e3a2f"
  sidebar-accent: "#aff1ce"
  page-bg: "#edf1ea"
  surface: "#ffffff"
  border-soft: "#e0e7dc"
  border: "#cfd8cb"
  ink: "#1e2b24"
  ink-muted: "#55655b"
  ink-faint: "#86958b"
  table-free: "#5fae86"
  table-free-bg: "#eef8f2"
  table-busy: "#8a2a1c"
  table-busy-bg: "#fbedea"
  table-pending: "#e6834a"
  promo-bg: "#4d2d07"
  promo-text: "#ffdcbd"
  dark-page: "#313338"
  dark-card: "#2b2d31"
  dark-text: "#dbdee1"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Roboto, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Roboto, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Roboto, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.06em"
rounded:
  sm: "8px"
  md: "12px"
  card: "20px"
  dialog: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
---

# Design System: Tavolapp

## Overview

**Creative North Star: "La mise en place"**

Como en una cocina bien armada, cada cosa está en su lugar y lista para usarse con apuro. La interfaz es calma, ordenada y sin adornos: superficies blancas sobre un fondo salvia suave, una sola acción principal en verde botella casi negro, y color solo donde significa algo (mesa libre, mesa ocupada, pedido pendiente). Nada compite con la tarea: tocar un producto, cobrar, mirar el estado del salón.

La densidad es media y pensada para toque: botones grandes, tarjetas con aire y textos legibles de pie, desde una tablet. La personalidad es cálida y directa, no corporativa ni de moda: pocos radios (grandes y redondeados), sombras suaves y tipografía clara.

**Key Characteristics:**
- Superficies blancas sobre salvia, con sombras difusas apenas perceptibles.
- Un único color de acción: verde botella casi negro.
- Estados siempre con texto o ícono además del color.
- Radios generosos (20px en tarjetas, 24px en diálogos).
- Títulos en Plus Jakarta Sans, texto de lectura en Roboto.

## Colors

Paleta contenida de verdes y neutros fríos, con tres colores de estado cálidos (menta, ladrillo y ámbar). Toda la interfaz de operación sale de estos tokens; no se usan rojos ni azules sueltos de Tailwind.

### Primary
- **Verde botella casi negro** (#1b2822): botones principales, chips seleccionados, íconos de encabezado, total a cobrar. Hover en #131d18; profundo en #0c1511.
- **Verde del menú lateral** (#07241a): fondo del menú lateral en claro y en oscuro, con el ítem activo en #1e3a2f y acento menta #aff1ce.

### Secondary
- **Menta de mesa libre** (#5fae86, fondo #eef8f2): mesas libres y estados correctos.

### Tertiary
- **Ladrillo** (#8a2a1c, fondo #fbedea): mesas ocupadas y acciones destructivas (vaciar, cerrar caja).
- **Ámbar** (#e6834a): mesa con un pedido por QR esperando confirmación.
- **Marrón y crema de promo** (#4d2d07 sobre #ffdcbd): insignias de "Promo".

### Neutral
- **Salvia de fondo** (#edf1ea): fondo de página.
- **Blanco** (#ffffff): tarjetas, diálogos, encabezado de página.
- **Borde salvia** (#e0e7dc, #cfd8cb): líneas finas y contornos.
- **Tinta** (#1e2b24), **tinta suave** (#55655b), **tinta tenue** (#86958b): texto principal, secundario y de apoyo.
- **Modo oscuro (panel)**: fondo #313338, tarjetas #2b2d31, texto #dbdee1.

### Named Rules
**La regla de la voz única.** El verde botella es la única acción primaria de una pantalla; el color de estado (menta, ladrillo, ámbar) aparece solo para estados.
**La regla del estado doble.** Libre, ocupada, pendiente, agotada, abierta y cerrada llevan siempre texto o ícono además del color.

## Typography

**Display Font:** Plus Jakarta Sans (con system-ui)
**Body Font:** Roboto (con Segoe UI y sans-serif)
**Pantalla del cliente:** Inter para la carta pública y la tienda.

**Character:** Títulos con carácter y números contundentes en Jakarta; lectura neutra y compacta en Roboto.

### Hierarchy
- **Display** (700, 22–24px, 1.2): título de cada página, tipo "Mostrador".
- **Headline** (700, 17px): títulos de sección con contador ("Todos los productos").
- **Title** (700, 15px): nombre del producto, título de tarjeta.
- **Body** (400, 14px): texto general.
- **Label** (700, 11px, 0.06em, mayúsculas): categorías, etiquetas, "Precio".
- **Total** (800, 30px, Jakarta): el total a cobrar es lo primero que se lee.

### Named Rules
**La regla del número grande.** Los importes que se cobran o se miran seguido (total a cobrar, ventas del día) van en Jakarta, grandes y en negrita.
**La regla del título protegido.** Los estilos de Material pisan el peso de los `h1`: los títulos de página llevan peso y tamaño con `!important`.

## Layout

Fondo salvia a pantalla completa. Cada pantalla tiene un encabezado blanco de unos 72px (ícono verde, título, subtítulo, acciones a la derecha) y debajo un contenedor centrado de ancho máximo 1280px, con 16px de aire a los costados en celular y 32px en pantalla grande. El menú lateral fijo tiene 250px.

El Mostrador usa una vista dividida: productos a la izquierda (hasta 4 columnas, nunca tarjetas menores a 160px) y el ticket fijo a la derecha (400px), alineados bajo una barra fija de búsqueda y categorías. En celular y tablet el ticket se abre desde un botón flotante.

**Gotcha de Bootstrap:** Bootstrap está cargado globalmente y pisa los espacios de Tailwind (p-3/4/5, gap-3/4/5, mb-3/4, `border`); en las plantillas se usan valores explícitos, como `p-[14px]`.

## Elevation & Depth

Capas tonales con sombras suaves: tarjetas blancas sobre el fondo salvia, separadas por sombras muy difusas y de bajo contraste. La profundidad es de apoyo, no de efecto.

### Shadow Vocabulary
- **Soft** (`0 1px 2px rgba(30,43,36,.05), 0 14px 30px -18px rgba(30,43,36,.28)`): tarjetas.
- **Soft-lg** (`0 1px 2px rgba(30,43,36,.06), 0 30px 60px -30px rgba(30,43,36,.35)`): tarjetas elevadas.
- **Dialog** (`0 30px 60px -20px rgba(30,43,36,.45)`): diálogos.
- **Green** (`0 18px 30px -20px rgba(29,91,62,.8)`): botones principales y chips seleccionados.
- **Brick / Amber** (`0 18px 30px -18px rgba(138,42,28,.65)` / `rgba(196,96,43,.7)`): tarjetas de mesa ocupada y pendiente.

### Named Rules
**La regla de la sombra tonal.** Las sombras son del mismo matiz verde que la tinta, nunca negras puras.

## Shapes

Formas redondeadas y amables: tarjetas de 20px, diálogos de 24px, botones y campos de 12px, chips y píldoras totalmente redondos. Los íconos de encabezado y de acción son cuadrados con esquinas de 12px.

## Components

### Buttons
- **Shape:** 12px de radio.
- **Primary:** verde botella casi negro, texto blanco, relleno de 10px × 20px; en el cobro, 56px de alto y 16px de radio, con sombra verde.
- **Hover / Focus:** pasa a #131d18; al presionar se achica apenas (`scale-[0.98]`).
- **Secondary / Ghost:** blanco con borde fino salvia; el destructivo en rosado suave (#fbedea), nunca rojo sólido.

### Chips
- **Style:** blancos con borde fino y texto tenue; el seleccionado va en verde botella con texto blanco y un contador.
- **Forma:** píldora completa con ícono a la izquierda.

### Cards / Containers
- **Corner Style:** 20px.
- **Background:** blanco.
- **Shadow Strategy:** sombra *soft*.
- **Internal Padding:** 16px.

### Product Card (Mostrador)
Tarjeta de 16px de radio, blanca, separada solo por la sombra *soft* (sin borde). Foto de 144px arriba solo si el plato la tiene; si no, es una tarjeta de texto: nombre en hasta dos renglones y abajo el precio en Jakarta con números tabulares. El botón "+" es un cuadrado suave (#edf1ea) que se vuelve verde al pasar el mouse. Sin etiqueta de categoría ni "Precio" arriba del monto. La cantidad en el pedido va como círculo verde y la tarjeta se marca con un anillo verde de 2px. En modo compacto: una fila con el nombre, el precio y la foto chica solo si existe.

### Tarjeta de mesa
Tarjeta de 16px, teñida del color del estado (menta libre, ladrillo ocupada, ámbar con pedido por QR pendiente), separada solo por la sombra. Nombre en negrita; debajo el estado como texto con un punto ("Libre", "Ocupada", "Ocupada · Pendiente"); el mozo en una línea de texto; el botón Ordenar a todo el ancho y, si hay órdenes, Órdenes, Total e imprimir en una fila. Sin logo repetido, sin píldoras de estado y sin cajitas para mesas vinculadas.

### Resumen del salón
Una sola línea de cifras en negrita con su nombre al lado ("3/8 ocupadas · 5 libres"), sin tarjetas con ícono y sin etiquetas arriba de los números.

### Diálogos de órdenes y cobro (Mesas)
Título en Jakarta con una línea de apoyo, sin ícono ni recuadro. Los productos van como filas separadas por una línea fina (cantidad, nombre y precio), no como tarjetas. Los totales son filas simples con la cifra grande a la derecha. El descuento general son porcentajes a la vista como chips (sin desplegable ni íconos distintos por cada valor). El pago es el mismo selector de cuatro métodos que el Mostrador, con billetes rápidos y vuelto en efectivo. Al pie: Cerrar e Imprimir como botones con borde y el cobro como único botón verde. Los diálogos de asignar mozo y de elegir productos siguen lo mismo: los mozos son botones de texto a la vista (sin desplegable); los productos elegidos son filas con línea fina y los del menú son filas separadas por la sombra, con un botón "+" suave, el precio con formato de moneda y avisos (Opciones, Agotado, Quedan N) como etiquetas chicas de texto.

### Caja
Sin tarjeta de encabezado repetida: el título de la página y su estado (ABIERTA / CERRADA) ya están arriba. Una línea con quién abrió la caja y el fondo, y el botón de cierre en rosado suave. Las cifras del turno van en una línea ("$ 10.000 de efectivo esperado en caja"), sin tarjetas con ícono. Los movimientos y el cobrado por método son filas con línea fina; el reparto por método usa barras finas y no un anillo. El resultado de un cierre usa el fondo teñido y no una franja de color al costado. En la tabla del historial la diferencia es texto coloreado ("Faltan $ X", "Sobran $ X", "✓ Justa").

### Inputs / Fields
- **Style:** blancos, borde fino salvia, 12px de radio.
- **Focus:** anillo suave en verde con 25% de opacidad.

### Navigation
Menú lateral en #07241a con ítems de 44px; el activo en #1e3a2f con texto blanco en negrita; las secciones en mayúsculas pequeñas y grisáceas.

### Pedido y cobro (Mostrador)
Se abre desde un carrito flotante en un diálogo de 16px de radio (hoja desde abajo en celular). Un encabezado con el título y la cantidad de productos, el selector Para llevar / Lo como acá, los productos como filas separadas por una línea fina (sin cajas), una sola cifra grande de total, el pago como un selector de cuatro métodos con el elegido en verde, y un botón Cobrar fijo abajo que nombra el método ("Cobrar $ 35.000 · Efectivo").

## Do's and Don'ts

### Do:
- **Do** usar los tokens `sage`, `cafe-green`, `cafe-mint`, `cafe-red` y `cafe-amber` para todo color de la interfaz.
- **Do** marcar siempre el estado con texto o ícono, además del color.
- **Do** usar números tabulares (`tabular-nums`) en precios, cantidades y totales para que alineen.
- **Do** dejar un anillo de foco visible en todo lo que se toca.
- **Do** dejar áreas de toque cómodas (mínimo 40px) para uso en tablet y celular.
- **Do** usar valores explícitos (`p-[14px]`) cuando Bootstrap pisa la escala de Tailwind.
- **Do** correr `npm run gen:dark` después de agregar clases de color nuevas.

### Don't:
- **Don't** poner una etiqueta o texto chico arriba de un título o de un nombre (ni categoría ni "Precio" sobre el monto).
- **Don't** anidar tarjetas dentro de tarjetas: dentro de un diálogo o una tarjeta, las filas se separan con una línea fina.
- **Don't** combinar borde y sombra en un mismo elemento: se elige uno.
- **Don't** usar sombras de color en botones ni un bloque oscuro sólido por cada acción repetida (el "+" de las tarjetas va suave).
- **Don't** poner íconos de adorno en chips y títulos de sección, ni un ícono grande de relleno donde falta la foto.
- **Don't** usar degradados decorativos ni círculos de adorno.
- **Don't** usar los rojos, azules o morados de Tailwind directamente: el rojo es siempre `cafe-red`.
- **Don't** usar rojo sólido para acciones destructivas: van en rosado suave.
- **Don't** depender solo del color para comunicar un estado.
- **Don't** sumar una segunda tipografía de texto de lectura: Jakarta es solo para títulos y números.

### Reportes

Cifras en una sola línea (total grande en verde, resto `font-jakarta tabular-nums` + etiqueta al lado), sin tarjetas de KPI. Rango y origen como chips; sin selector Barras/Torta (rankings siempre en barras). Paneles `rounded-2xl bg-white shadow-soft`, títulos `div role="heading"`, "Mostrador y mesas" como dos filas de texto, tablas con números tabulares.

### Mi negocio (Ajustes)

Pestañas como chips de texto (sin íconos). Paneles `rounded-2xl bg-white shadow-soft`, títulos `div role="heading"`, campos `rounded-xl border-sage-300` con etiqueta `text-sm font-medium`. Sin cajas dentro de las tarjetas (portada/fondo, "Dónde activo mi carta" en texto plano). Barra de guardar sin vidrio.

### Resto de la app

Mismo criterio aplicado en bloque a Balance, Inventario (todas las pestañas), Cocina, Modificadores, Categorías, Usuarios, Reservas, Delivery, QR, Plan, Administración, Portal del hotel y los diálogos internos: títulos `div role="heading"`, `rounded-2xl` con una sola elevación, etiquetas `text-sm font-medium`, botones primarios `rounded-xl` con foco visible, cifras en línea en vez de tarjetas, sin íconos decorativos ni bordes de color (estado con fondo tenue). Pantallas públicas (ingreso, onboarding, reserva pública, landing de hotel) con el mismo criterio: sin círculos de ícono sobre los títulos, sin rótulos en mayúsculas, títulos Jakarta. Falta la carta QR del cliente (`qr-order`).

### Mesas y sus diálogos (pasada UI UX Pro Max)

Objetivos táctiles de 44px (48px en la acción principal de la tarjeta y en los botones de pie de diálogo), nada de texto bajo 12px, texto secundario sobre blanco en `sage-600` (no `sage-400`, que da ~2:1), foco visible en toda acción. Aplicado en `app-card`, `order-info`, `total`, `waiter`, `menu`, `link-table`, `qr-inbox` y `modifier-picker`. Skill instalado en `.agents/skills/ui-ux-pro-max` (enlazado a `.claude/skills`); su buscador pide Python 3, que no está instalado: se usó leyendo sus CSV y `SKILL.md` directo.

### Mesas v3 (estado del salón y tarjetas)

Panel de estado con barra de ocupación (rojo/verde) cuyos rótulos filtran la lista; turno y cocina a la derecha. Barra de trabajo en filas separadas: búsqueda, Sectores/Conjunta y sectores desplazables. Ocupada y pendiente por QR son tarjetas llenas (ladrillo / ámbar), libre queda en menta. Cada sector muestra su propia barra de ocupación. Los blancos fijos sobre tarjetas llenas van con valor arbitrario (`bg-[#ffffff]`) para que el modo oscuro no los invierta. IMPORTANTE: todo `*ngFor` de mesas/botones lleva `trackBy`; sin él, cada refresco recrea el DOM y un clic real de mouse (mousedown + mouseup) se pierde. "Primeros pasos" va debajo del encabezado de Mesas.

### Mesas v4: salón compacto (paleta propia, derivada de UI UX Pro Max)

Sistema de diseño del salón (clase `.floor`, variables `--floor-*` en `styles.scss`, con versión oscura): Inter en todo el salón; **Libre** = ficha blanca con aro verde, **Ocupada** = rojo ladrillo tenue (`#8a2a1c` sobre `#fbe9e5`); las acciones principales usan el verde de la marca (`--floor-action`), **Atención** (pedido por QR, cuenta pedida o platos listos) = naranja quemado `#c2410c`, el único color urgente. El rojo vuelve a ser el color de ocupada (decisión del dueño); el naranja sigue siendo lo único urgente y se distingue por ir lleno, con rombo y texto. Cada estado se distingue también por forma (aro / punto / rombo) y texto, no solo por color. Fichas de 148px mínimo (8 por fila a 1440px) con nombre sin el prefijo del sector, estado y mozo; tocar una ficha abre un panel lateral (hoja desde abajo en celular) con Ordenar / Órdenes / Cobrar / Imprimir. Esc o tocar fuera lo cierra. Las acciones cierran el panel y abren sus diálogos. Falta (necesita API): tiempo ocupada y consumo en la ficha.

**Ficha en atención:** el motivo va primero ("Pedido por QR"), debajo el tiempo de espera ("hace 4 min", sale de la hora del pedido, sin tocar la API) y a partir de 5 minutos la ficha late con un halo (se apaga con reducir movimiento). Un pedido por confirmar se resuelve tocando la ficha: abre directo la bandeja, sin pasar por el panel.

### Mesas v5: sistema "Salón en servicio"

Jerarquía en tres niveles: (1) **Esperando atención**, lista fija arriba con las mesas que esperan, la que espera hace más primero, con su tiempo y la acción ("Atender", "Cobrar", "Ver mesa", "Servir"); muestra 5 y el resto se despliega; (2) estado del salón (barra de ocupación y filtros); (3) mesas por sector. Las fichas no se reordenan por estado (memoria muscular): la urgencia vive en la lista. En celular las cifras del turno empiezan plegadas. La barra flotante de avisos solo aparece cuando la lista quedó fuera de pantalla (IntersectionObserver). `--floor-action-text` aclara el texto de acción en oscuro para cumplir contraste. "Primeros pasos" va después de lo urgente. El scroll de la app NO es el de `window`: para pruebas usar `scrollIntoView`.

**Modo oscuro de Mesas:** grises neutros de la app (`#313338` / `#2b2d31`), sin azules ni verdes saturados. Los únicos colores son el rojo ladrillo tenue (ocupada), el naranja (atención) y el verde de marca (acciones). Libre es gris con aro verde.

**Platos listos (cocina):** no pintan la ficha de naranja; una mesa ocupada sigue roja y muestra "✓ N platos listos" en verde. En la lista "Esperando atención" esas mesas entran con una píldora verde "Listo" y la acción "Servir"; el naranja queda solo para clientes que esperan (pedido por QR, cuenta, mozo). El nombre de la mesa baja de 20 a 18 o 16 px según su largo y la cantidad de órdenes va junto al estado, así no se corta ("reservado1"). El prefijo del sector se quita sin importar tildes o mayúsculas.

La lista "Esperando atención" muestra SOLO clientes esperando (pedido por QR, cuenta, mozo). Los platos listos de cocina quedan en la ficha de cada mesa y en el contador de cocina del panel de estado: en un salón con cocina se acumulaban decenas de filas y tapaban lo urgente.

Panel de estado compacto: en escritorio las cifras del turno van en dos columnas (ventas | permanencia) y cocina debajo, el bloque mide 480px de ancho y el panel unos 170px de alto (antes ~320, con un hueco blanco bajo los filtros).

Panel de estado por rol: el bloque oscuro del turno es solo del administrador. Mozos y cajeros ven la ocupación y los filtros en una fila (número + barra a la izquierda, filtros a la derecha) y las cifras de cocina ("N platos listos para servir · N en preparación") como una línea bajo los filtros. Panel de ~116px de alto para esos roles.

**Filtro por estado:** ya no son chips dentro del panel; es el botón "Filtrar" de la barra de trabajo (junto al buscador) que despliega Todas / Libres / Ocupadas / Por QR con su cantidad; si hay un filtro activo el botón muestra cuál y se pinta oscuro. El panel de estado quedó con solo el número y la barra. Para el administrador, el bloque oscuro del turno es una franja a todo el ancho debajo (ventas | permanencia | cocina) y recién desde 1700px de ancho pasa a ser una columna a la derecha (`min-[1700px]`), porque el ancho de la pantalla no incluye el menú lateral.

### Mostrador v3: venta rápida

Barra de cobro inferior ("Cobrar · N productos · total") en lugar del carrito flotante. Tarjetas con pie fijo de dos líneas (precio + acción de 44px): el "+" se vuelve un selector "− 2 +" cuando el producto ya está en el pedido, y como la altura no cambia, agregar un producto nunca mueve la grilla (evita toques errados en plena venta). Hasta 6 columnas en pantalla ancha y 2 en celular; fotos más bajas. Venta registrada: total grande, "Vuelto a entregar" destacado, foco en "Nueva venta" (Enter) e "Imprimir ticket" debajo. Importes rápidos sin centavos (`money:true`). Objetivos táctiles de 44px.

### Caja v3

La cifra principal es el **efectivo esperado en caja** (40px) con el cierre a un toque en la misma tarjeta; vendidos, cobros digitales y propinas van debajo. Movimientos: tipo con botones (Retiro o gasto / Ingreso) y campos de 48px. Cobrado por método: una sola barra verde (el rojo y el naranja parecían alertas). "Efectivo de la caja" termina con **Esperado en caja** y los ceros van sin color. Historial: la diferencia es una etiqueta (Justa = verde, Faltan = rojo, **Sobran = ámbar**, Abierta = gris), filas de 14px de alto, importes alineados a la derecha, y en celular cada cierre es una tarjeta (no una tabla con scroll). Importes redondos sin centavos (`money:true`).

## Paleta actual: verde agua y pizarra (reemplaza a "verde botella" y "salvia")

Tomada de una imagen de referencia: menta `#2ED0AB`, verde azulado oscuro `#084440`, pizarra `#363F4E` y grises fríos. Lo que dicen más arriba sobre "verde botella casi negro" y "salvia" está superado por esto.

- `cafe-green`: verde agua de marca. **700 = `#0b7d66` es la acción principal** (texto blanco, contraste 5,1:1), 800 el hover, 900 `#084440` para texto oscuro, 50-200 tintes.
- `cafe-mint`: menta brillante `#2ED0AB` (500) para acentos; sobre ella va texto oscuro (900), nunca blanco.
- `sage`: ahora son grises fríos de pizarra: 100 `#eef0f3` fondo de página, 200 bordes, 600 `#4f5a6b` y 500 `#5d6879` texto secundario (4,9:1 sobre el fondo), 700 `#363f4e` pizarra, 900 `#181d26` tinta.
- Menú lateral en pizarra `#2f3643` con acento menta `#6fe3c6`. Modo oscuro: pizarra (`#2b323e` fondo, `#252b36` tarjetas, `#3a4252` bordes).
- Se mantienen el rojo ladrillo (ocupada, destructivo) y el ámbar/naranja (atención).
- El color por defecto de la marca del local (carta y reservas) pasó a `#0b7d66`; los locales que ya eligieron otro color lo conservan.
- Contrastes verificados: blanco sobre verde agua 5,1, verde agua sobre blanco 5,1, menta sobre pizarra 7,8, texto 600 sobre tarjeta oscura 7,4.
- Regla: ningún color nuevo suelto; para cambiar la paleta se tocan `tailwind.config.js`, las variables `--floor-*` de `styles.scss` y `tools/gen-dark-theme.js` (luego `npm run gen:dark`).

### Acción principal en menta

Los botones y las acciones principales (`bg-cafe-green-700/600/800`), el ícono del encabezado (`.page-header__icon`), el selector "− 2 +" y los botones del panel de Mesas (`--floor-action`) van en menta `#2ED0AB` con texto verde azulado oscuro `#084440` (5,6:1), en claro y en oscuro. Se resuelve con una regla global al final de `styles.scss` (el color lleva `!important` porque Bootstrap `.text-white` también). Los textos verdes sobre blanco (enlaces, importes) siguen en `#0b7d66`. Las pantallas del cliente (carta, reservas) usan el color de marca del local (`forest`) y siguen con texto blanco.

**Cuidado con Bootstrap:** `p-3/4/5`, `px-*`, `py-*`, `m*-3/4/5` y `gap-3/4/5` de Bootstrap pisan a Tailwind (p-5 = 48px). En plantillas nuevas usar valores explícitos (`p-[20px]`, `px-[20px]`).

### Panel de estado de Mesas v5 (bloques iguales)

Una sola tarjeta blanca con bloques de la misma forma (etiqueta chica, cifra de 28px y una línea de contexto), separados por líneas finas: **Ocupación** (con la barra y su leyenda "N ocupadas · N libres"), **Ventas del turno**, **Ticket promedio** y **Permanencia promedio**. Sin el bloque oscuro. Mozos y cajeros ven solo Ocupación; la línea de cocina (platos listos / en preparación) va al pie para todos. En celular: Ocupación a todo el ancho y las cifras del turno plegadas ("Ver cifras del turno"), después en grilla de 2.

## Carta online y pedido por QR (pantalla del cliente)

Rediseño de `qr-order` (`/mesa/:token`, `/carta/:slug`, `/delivery/:slug`). Solo plantilla; la lógica no cambió.

- **Portada de marca**: banda a todo el ancho con esquinas inferiores de 36px en el color del local (o su foto de portada con degradé), logo en ficha blanca de 68px, nombre en 28px extrabold y dos píldoras de vidrio (mesa/carta/tienda y estado). Sin portada, anillos concéntricos como motivo. En carta oscura la banda usa la superficie oscura (el color de marca aclarado no da contraste con texto blanco).
- **Buscador y categorías fijos** (`sticky`) con píldoras de 40px de alto.
- **Destacados** ("Imperdibles"): afiches de 264×320 con la foto a sangre, nombre encima y precio en píldora blanca.
- **Tarjetas**: radio 24px, foto de 112px (lista) o 128px (grilla), precio en extrabold, botón de agregar de 36–44px en el color de marca; el verde queda solo para "ya agregado".
- **Dock flotante** abajo (Carta / Pedidos / Bolsa, pestaña activa en color de marca) y, encima, la barra "Tu bolsa" como píldora con total y "Ver pedido".
- Esquinas más amplias en toda la pantalla (`rounded-xl` → 20px, `rounded-lg` → 14px, hojas 32px).
- Pendiente: el modo oscuro aclara el color de marca y el texto blanco sobre botones queda con contraste justo; la pestaña Pedidos conserva la banda completa arriba (ocupa ~170px).

## Cifras en bloques (Reportes, Balance, Caja, Inventario, Mesas)

Las cifras de resumen ya no van "en una línea" con cifra + texto al lado. Todas usan el mismo bloque: etiqueta (14px, `text-sage-600`), cifra (26–28px bold, Inter, `tabular-nums`, `whitespace-nowrap`) y contexto debajo (14px). Los bloques se separan con líneas finas de 1px (`gap-px` sobre `bg-sage-200`), dentro de una sola tarjeta de 20px de radio: en pantallas grandes van todos en una fila de columnas iguales (`lg:grid-flow-col lg:auto-cols-fr`), en celular de a dos, con el último ocupando todo el ancho si queda impar. Importes con `money:true` (sin ",00"). Si se agrega un resumen nuevo, copiar este bloque.
