# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Tres públicos, confirmados:

- **Mozos y cajeros en plena atención.** Usan una tablet o el celular, de pie, con apuro y las manos ocupadas, mientras atienden: toman pedidos en las mesas, cobran en el Mostrador, miran la cocina. Su trabajo es resolver una venta en pocos toques.
- **Dueños y encargados.** Miran la caja, el balance, los reportes y el inventario, y configuran el negocio (menú, mesas, mozos, plan), desde la computadora o el celular, a distintas horas.
- **Clientes del local.** Entran sin cuenta desde su celular: a la carta online o al pedido por QR de la mesa, a la tienda online (retiro o delivery) o a reservar.

## Product Purpose

Tavolapp es un sistema de gestión para restaurantes, bares, cafés y comercios gastronómicos con venta al paso (take away y delivery). Reúne en un solo lugar las mesas y las comandas, el Mostrador, la cocina y la barra, los cobros y la caja, la carta con QR, la tienda online, las reservas, el inventario y los reportes. Éxito: un local que vende más rápido y con menos errores, y un dueño que sabe qué pasa en su negocio sin estar presente.

## Positioning

Todo en uno, desde el navegador: salón con mesas, Mostrador, pedido por QR, tienda online, cocina, caja y reportes juntos, sin instalar nada ni comprar equipos especiales. Y se aprende en una tarde: un local chico puede empezar rápido, con ayuda para cargar el menú.

## Operating Context

- Se usa desde el navegador de una tablet, un celular o una computadora; no requiere instalar nada.
- Un mismo local mezcla roles (administrador, cajero, mozo, cocina, barra), cada uno con lo suyo.
- El negocio puede vender solo con mesas, solo al paso (Mostrador, take away, delivery) o ambas cosas; la interfaz cambia según eso.
- Hay hora pico: el personal usa la pantalla con apuro y sin tiempo para leer.
- Ventas, caja y stock se comparten en tiempo real entre dispositivos.

## Capabilities and Constraints

- Frontend en Angular 16 con Tailwind y Angular Material; API en NestJS con Postgres. Todo en español rioplatense.
- Planes que activan o no funciones (hoy: Takeaway, Básico, Pro y superiores); algunas se suman como extras.
- Funciona en tablets y celulares: el diseño no puede depender de un monitor grande ni de interacciones que requieran mouse.
- Modo claro y oscuro en el panel interno; la carta pública, las reservas y la tienda se muestran claras (la carta tiene un estilo claro u oscuro que elige el local).
- Pendiente de decidir: impresión directa en impresoras térmicas desde tablets Android, facturación fiscal, plano de mesas.

## Brand Commitments

- Nombre: Tavolapp.
- Existe un logo donde la "o" de la marca es un plato con tenedor y cuchillo. Es un activo existente; no se confirmó como restricción visual para nuevos diseños.

## Evidence on Hand

- Un cliente real en uso: el local "Nuovo caffe".
- La landing de Tavolapp (`tavolapp-landing`) y las pantallas actuales del panel, la carta online, la tienda online y el Mostrador sirven como evidencia del producto.
- No hay testimonios, casos de éxito, precios publicados ni cifras de clientes confirmados: no inventarlos.

## Product Principles

1. **Velocidad antes que adorno.** En el Mostrador, las mesas y la cocina manda cuántos toques lleva una tarea; cada pantalla de operación debe poder resolverse con apuro.
2. **Pensado para tablet y celular.** Toques grandes, textos legibles de pie y sin depender de pantallas grandes.
3. **El estado nunca depende solo del color.** Libre, ocupada, pendiente, agotada, abierta o cerrada llevan siempre texto o ícono además del color.
4. **Todo a mano, sin saltar entre herramientas.** Un solo lugar para vender, cobrar, controlar y mostrarle la carta al cliente.
5. **Se aprende en una tarde.** Lo simple por defecto; lo avanzado, escondido hasta que hace falta.

## Accessibility & Inclusion

- Los estados no pueden comunicarse solo con color (confirmado).
- Uso principal con toque en tablets y celulares: tamaños de toque cómodos y legibilidad con poca luz o desde lejos.
- Modo claro y oscuro en el panel interno.
