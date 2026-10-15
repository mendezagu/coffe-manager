// Configuración del entorno. Se elige al compilar (ver "fileReplacements" en angular.json):
//   ng serve                       -> environment.ts
//   ng serve --configuration=test  -> environment.test.ts
//   npm run build / deploy         -> environment.prod.ts
export const environment = {
  production: true,
  // Dirección de la API (backend NestJS) en producción (Render)
  apiUrl: 'https://resto-api-ljdn.onrender.com/api',
  // Firebase: solo lo que todavía usa la app (se está retirando)
  firebase: {
    apiKey: "AIzaSyBuYr748J1j9TCFcjUpuznXnk_4Jo8pPiQ",
    authDomain: "nuovo-caffe.firebaseapp.com",
    projectId: "nuovo-caffe",
    storageBucket: "nuovo-caffe.appspot.com",
    messagingSenderId: "1013495355496",
    appId: "1:1013495355496:web:fdaaf0fb143f3f2c0303dd",
    measurementId: "G-L1Q71BEWLK"
  }
};
