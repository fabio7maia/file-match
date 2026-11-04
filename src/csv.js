/** Descodifica UTF-8; se não for UTF-8 válido, usa Windows-1252 (comum em Excel em português). */
export function decodeText(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Escolhe o separador mais frequente na primeira linha não vazia (';', ',' ou tabulação). */
export function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  let best = ';';
  let bestCount = -1;
  for (const candidate of [';', ',', '\t']) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/** Analisa CSV (RFC 4180: campos entre aspas, "" como aspas literais, CRLF ou LF). */
export function parseCsv(text, delimiter = detectDelimiter(text)) {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch !== '"') field += ch;
      else if (src[i + 1] === '"') {
        field += '"';
        i++;
      } else inQuotes = false;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
