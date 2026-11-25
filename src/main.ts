import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

// En el ambiente de pruebas: una etiqueta fija para no confundirlo con producción y pedido de no indexar
if ((environment as { envName?: string }).envName === 'dev') {
  const robots = document.createElement('meta');
  robots.name = 'robots';
  robots.content = 'noindex, nofollow';
  document.head.appendChild(robots);
  const badge = document.createElement('div');
  badge.textContent = 'PRUEBAS';
  badge.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none;background:#e6834a;color:#1f2430;font:800 11px/1 system-ui,sans-serif;letter-spacing:.12em;padding:4px 12px;border-radius:0 0 8px 8px';
  document.body.appendChild(badge);
  document.title = '[PRUEBAS] ' + document.title;
}


platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
