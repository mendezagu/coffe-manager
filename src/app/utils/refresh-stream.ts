import { Observable, asyncScheduler, merge, timer } from 'rxjs';
import { distinctUntilChanged, filter, map, switchMap, throttleTime } from 'rxjs/operators';

// Cuándo una pantalla tiene que volver a pedir sus datos:
//  - apenas se suscribe y cada vez que la conexión en vivo se (re)establece o se cae (para ponerse al día);
//  - cada vez que el servidor avisa un cambio de ese tema (varios avisos seguidos se juntan en una sola consulta);
//  - de respaldo: con la conexión en vivo, cada `safetyMs`; sin ella, cada `fallbackMs` (como se hacía antes).
export function refreshStream<T>(
  connected$: Observable<boolean>,
  events$: Observable<T>,
  topic: T,
  fallbackMs: number,
  safetyMs = 60_000,
  throttleMs = 300,
): Observable<void> {
  return connected$.pipe(
    distinctUntilChanged(),
    switchMap((connected) =>
      merge(
        timer(0, connected ? safetyMs : fallbackMs),
        events$.pipe(
          filter((t) => t === topic),
          throttleTime(throttleMs, asyncScheduler, { leading: true, trailing: true }),
        ),
      ),
    ),
    map(() => undefined),
  );
}
