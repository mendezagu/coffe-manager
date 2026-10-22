// La app se mudó a https://app.tavolapp.app. Este service worker reemplaza al anterior: se desinstala solo,
// borra lo que había guardado y recarga las pestañas abiertas (que ya van a ver la redirección).
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    await self.registration.unregister();
    var clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(function (c) { c.navigate(c.url); });
  })());
});
