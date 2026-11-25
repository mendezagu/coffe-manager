// Ambiente de pruebas publicado (app-dev.tavolapp.app). Se compila con "npm run build:app:dev".
// Usa su propia API y su propia base de datos: nada de lo que se haga acá toca producción.
export const environment = {
  production: true,
  // marca el ambiente: muestra la franja "PRUEBAS" y pide a los buscadores que no indexen
  envName: 'dev',
  // Dirección de la API de pruebas en Render (si Render le pone otro nombre al servicio, cambiarlo acá)
  apiUrl: 'https://tavolapp-api-dev.onrender.com/api',
  // WhatsApp de Tavolapp al que llegan los pedidos de cambio de plan (formato internacional, solo números)
  salesWhatsapp: '5493546409616'
};
