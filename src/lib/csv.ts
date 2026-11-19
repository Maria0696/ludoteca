/**
 * Parte un CSV en filas y campos. Admite campos entre comillas con el
 * separador, saltos de línea y comillas dobladas (`""`) dentro, y finales
 * de línea `\r\n` o `\n`. Las líneas vacías no producen fila.
 */
export function parseCsv(text: string, separator = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
    field = "";
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (src[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) {
      row.push(field);
      field = "";
    } else if (ch === "\n") endRow();
    else if (ch !== "\r") field += ch;
  }
  if (field !== "" || row.length) endRow();
  return rows;
}
