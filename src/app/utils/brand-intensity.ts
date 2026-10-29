// Cuánto se ve la imagen de portada y de fondo de la carta (0 a 100). Sin valor (null) lo decide el sistema.
// Lo usan la carta y la vista previa de Ajustes, para que se vean igual.

export const AUTO_COVER_INTENSITY = 50;
export const AUTO_BACKGROUND_INTENSITY = 10;

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

export function coverIntensityOf(value: number | null | undefined): number {
  return value === null || value === undefined ? AUTO_COVER_INTENSITY : clamp(value);
}

export function backgroundIntensityOf(value: number | null | undefined): number {
  return value === null || value === undefined ? AUTO_BACKGROUND_INTENSITY : clamp(value);
}

// Portada: un velo oscuro sobre la foto para que se lea el nombre del local (más intensidad = menos velo)
export function coverVeil(value: number | null | undefined): string {
  const top = 0.75 - 0.006 * coverIntensityOf(value);
  const bottom = Math.min(0.95, top + 0.17);
  return `linear-gradient(rgba(0,0,0,${top.toFixed(2)}), rgba(0,0,0,${bottom.toFixed(2)}))`;
}

// Fondo: un velo claro para que las tarjetas y los textos se lean (más intensidad = menos velo)
export function backgroundVeil(value: number | null | undefined): string {
  const alpha = Math.max(0.25, 0.97 - 0.007 * backgroundIntensityOf(value));
  return `linear-gradient(rgba(250,248,245,${alpha.toFixed(2)}), rgba(250,248,245,${alpha.toFixed(2)}))`;
}
