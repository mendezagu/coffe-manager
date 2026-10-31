// Texto con formato simple para las novedades (lo escribe la Consola, lo muestra la app).
// Se guarda como texto común con marcas, nunca como HTML: así no hay forma de colar código en la pantalla.
//   **negrita**   _cursiva_   líneas que empiezan con "- " son una lista   (los íconos son emojis comunes)
// La Consola tiene una copia de esta misma función (tavolapp-admin/public/announcements.js): si se cambia una, cambiar la otra.

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

// Negrita y cursiva dentro de una línea (ya escapada)
const inline = (line: string): string =>
  line
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^A-Za-z0-9_áéíóúñÁÉÍÓÚÑ])_(?=\S)(.+?)(?<=\S)_(?![A-Za-z0-9_áéíóúñÁÉÍÓÚÑ])/g, '$1<em>$2</em>');

export function richText(text: string | null | undefined): string {
  const lines = escapeHtml(String(text ?? '').replace(/\r\n/g, '\n')).split('\n');
  const out: string[] = [];
  let list: string[] | null = null;
  const closeList = () => {
    if (list) {
      out.push(`<ul>${list.map((i) => `<li>${i}</li>`).join('')}</ul>`);
      list = null;
    }
  };
  for (const raw of lines) {
    const item = raw.match(/^\s*[-•]\s+(.*)$/);
    if (item) {
      (list ??= []).push(inline(item[1]));
      continue;
    }
    closeList();
    out.push(raw.trim() ? `<p>${inline(raw)}</p>` : '<br>');
  }
  closeList();
  // varias líneas vacías seguidas no abren huecos enormes
  return out.join('').replace(/(<br>){2,}/g, '<br>');
}

// El mismo texto sin las marcas (para un resumen de una línea)
export const plainText = (text: string | null | undefined): string =>
  String(text ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^A-Za-z0-9_áéíóúñÁÉÍÓÚÑ])_(.+?)_(?![A-Za-z0-9_áéíóúñÁÉÍÓÚÑ])/g, '$1$2')
    .replace(/^\s*[-•]\s+/gm, '• ');
