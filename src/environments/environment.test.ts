// Configuración del entorno. Se elige al compilar (ver "fileReplacements" en angular.json):
//   ng serve                       -> environment.ts
//   ng serve --configuration=test  -> environment.test.ts
//   npm run build / deploy         -> environment.prod.ts
export const environment = {
  production: false,
  // Dirección de la API (backend NestJS) para pruebas
  apiUrl: 'http://localhost:3000/api',
  // WhatsApp de Tavolapp al que llegan los pedidos de cambio de plan (formato internacional, solo números: 5491112345678)
  salesWhatsapp: ''
};
