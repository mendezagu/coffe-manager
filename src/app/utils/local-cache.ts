// Copia local de lo que la app trae del servidor (menú, categorías, estado de la caja), para poder seguir
// trabajando si se cae internet. Se guarda por usuario: otro usuario en el mismo dispositivo no ve lo del anterior.
// Todo va dentro de try/catch: si el navegador no deja guardar (modo privado, sin espacio), la app sigue igual.

const TOKEN_KEY = 'auth_token';
const PREFIX = 'tavolapp_cache_';

// Identificador del usuario con sesión (el campo "sub" del token). Sin token, no hay copia.
export function sessionScope(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.sub === 'string' ? json.sub : null;
  } catch {
    return null;
  }
}

export function cacheSet(key: string, value: unknown): void {
  const scope = sessionScope();
  if (!scope) return;
  try {
    localStorage.setItem(`${PREFIX}${key}_${scope}`, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    /* sin espacio o sin permiso: se sigue sin copia */
  }
}

export function cacheGet<T>(key: string): T | null {
  const scope = sessionScope();
  if (!scope) return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}_${scope}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed?.value as T) ?? null;
  } catch {
    return null;
  }
}
