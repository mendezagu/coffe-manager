// Lee una planilla de platos con precio por tamaño, pegada desde Google Sheets / Excel o descargada como CSV:
//
//   Plato      | Chico | Jarro | Doble | XXL
//   Lagrima    | 3800  | 4000  | 4500  | 5900
//   Flat white | 3800  | 4000  | 5100  | 6500
//
// La primera fila son los tamaños. Una columna "Categoría" (opcional) se reconoce por su nombre.
// Un precio vacío significa que ese plato no se ofrece en ese tamaño.

export interface SizeSheetRow {
  name: string;
  category: string;
  prices: (number | null)[];
}

export interface SizeSheet {
  sizes: string[];
  rows: SizeSheetRow[];
  problems: string[];
}

// "3800", "$ 3.800,00", "3.800", "3,800", "3800.50" → número; vacío o ilegible → null
export function parsePrice(raw: string): number | null {
  let t = (raw ?? '').replace(/[^\d.,-]/g, '');
  if (!t || !/\d/.test(t)) return null;
  const dot = t.lastIndexOf('.');
  const comma = t.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) {
    // el último separador es el decimal: 3.800,50 (es) o 3,800.50 (en)
    t = dot > comma ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.');
  } else if (dot >= 0 || comma >= 0) {
    const sep = dot >= 0 ? '.' : ',';
    const parts = t.split(sep);
    const last = parts[parts.length - 1];
    // "3.800" / "1,500" (tres cifras) son miles; "38,5" / "3800.50" son decimales
    t = parts.length > 2 || last.length === 3 ? parts.join('') : parts.join('.');
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

// Separa una fila respetando las comillas del CSV
function splitRow(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

// Pegar desde Sheets da tabuladores; un CSV argentino suele usar ";" y uno inglés ","
function detectDelimiter(header: string): string {
  const count = (d: string) => header.split(d).length - 1;
  const best = ['\t', ';', ','].map((d) => ({ d, n: count(d) })).sort((a, b) => b.n - a.n)[0];
  return best.n > 0 ? best.d : '\t';
}

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function parseSizeSheet(text: string): SizeSheet {
  const lines = (text ?? '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const problems: string[] = [];
  if (lines.length < 2) return { sizes: [], rows: [], problems: ['Pegá la planilla con la fila de tamaños arriba y los platos abajo.'] };

  const delimiter = detectDelimiter(lines[0]);
  const header = splitRow(lines[0], delimiter);
  const categoryCol = header.findIndex((h, i) => i > 0 && /^categor/.test(norm(h)));
  const sizeCols = header.map((h, i) => ({ h, i })).filter(({ h, i }) => i > 0 && i !== categoryCol && h);
  const sizes = sizeCols.map(({ h }) => h);

  if (sizes.length === 0) return { sizes: [], rows: [], problems: ['No encuentro los tamaños: la primera fila tiene que ser "Plato, Chico, Jarro…".'] };
  if (sizes.length > 12) problems.push('Hay más de 12 tamaños; el máximo es 12.');
  if (new Set(sizes.map(norm)).size !== sizes.length) problems.push('Hay tamaños repetidos en la primera fila.');

  const rows: SizeSheetRow[] = [];
  lines.slice(1).forEach((line, n) => {
    const cells = splitRow(line, delimiter);
    const name = cells[0];
    if (!name) return;
    const prices = sizeCols.map(({ i }) => parsePrice(cells[i] ?? ''));
    if (prices.every((p) => p === null)) {
      problems.push(`Fila ${n + 2} ("${name}"): no tiene ningún precio, se saltea.`);
      return;
    }
    rows.push({ name, category: categoryCol >= 0 ? cells[categoryCol] ?? '' : '', prices });
  });
  if (rows.length === 0) problems.push('No encontré platos con precio.');
  return { sizes, rows, problems };
}
