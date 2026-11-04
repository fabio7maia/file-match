const REFERENCE_HEADERS = ['referencia', 'ref', 'reference', 'codigo', 'code', 'id'];
const NAME_HEADERS = ['novo nome', 'nome novo', 'new name', 'novo', 'nome', 'name'];

function simplifyHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Converte as linhas de uma lista (CSV/Excel) em referências.
 * Se a primeira linha tiver cabeçalhos reconhecíveis (ex.: "Referência", "Novo nome"),
 * usa-os; caso contrário assume a 1.ª coluna como referência e a 2.ª como novo nome.
 */
export function parseReferenceRows(rows) {
  const first = rows[0] ?? [];
  const refCol = first.findIndex((cell) => REFERENCE_HEADERS.includes(simplifyHeader(cell)));
  const hasHeader = refCol !== -1;
  const ref = hasHeader ? refCol : 0;
  const nameFound = hasHeader ? first.findIndex((cell, i) => i !== ref && NAME_HEADERS.includes(simplifyHeader(cell))) : -1;
  const nameCol = hasHeader ? (nameFound !== -1 ? nameFound : ref + 1) : 1;

  const references = [];
  const issues = [];
  rows.forEach((row, index) => {
    if (hasHeader && index === 0) return;
    const reference = String(row[ref] ?? '').trim();
    const newName = String(row[nameCol] ?? '').trim();
    if (!reference && !newName) return;
    const line = index + 1;
    if (!reference) {
      issues.push({ line, message: 'Referência vazia; linha ignorada.' });
      return;
    }
    references.push({ line, ref: reference, newName });
  });

  return { references, issues, hasHeader };
}
