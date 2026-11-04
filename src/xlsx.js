import { readZip } from './zip.js';

const NAMED_ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodeXml(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (match, entity) => {
    if (entity[0] !== '#') return NAMED_ENTITIES[entity];
    const code = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return String.fromCodePoint(code);
  });
}

function readAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? decodeXml(match[1]) : null;
}

function columnIndex(letters) {
  return [...letters.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

function joinText(xml) {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('');
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => joinText(m[1]));
}

function firstSheetPath(workbookXml, relsXml, available) {
  const sheetTag = workbookXml?.match(/<sheet\b[^>]*>/)?.[0];
  const relId = sheetTag && readAttribute(sheetTag, 'r:id');
  if (relId && relsXml) {
    for (const tag of relsXml.match(/<Relationship\b[^>]*>/g) ?? []) {
      if (readAttribute(tag, 'Id') !== relId) continue;
      const target = readAttribute(tag, 'Target');
      return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    }
  }
  return [...available].filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort()[0];
}

function cellValue(attrs, body, sharedStrings) {
  const type = readAttribute(attrs, 't');
  if (type === 'inlineStr') return joinText(body);
  const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (raw === undefined) return '';
  if (type === 's') return sharedStrings[Number(raw)] ?? '';
  return decodeXml(raw);
}

function parseSheetRows(xml, sharedStrings) {
  const rows = [];
  for (const [, rowBody] of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const [, attrs, body = ''] of rowBody.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = readAttribute(attrs, 'r');
      const col = ref ? columnIndex(ref.match(/^[A-Za-z]+/)[0]) : row.length;
      row[col] = cellValue(attrs, body, sharedStrings);
    }
    rows.push(Array.from(row, (value) => value ?? ''));
  }
  return rows;
}

/**
 * Lê a primeira folha de um ficheiro .xlsx e devolve as linhas como arrays de texto.
 */
export async function readXlsxRows(bytes) {
  const files = await readZip(
    bytes,
    (name) => name === 'xl/workbook.xml' || name === 'xl/_rels/workbook.xml.rels' || name === 'xl/sharedStrings.xml' || name.startsWith('xl/worksheets/'),
  );
  const text = (name) => (files.has(name) ? new TextDecoder().decode(files.get(name)) : null);

  const sheetName = firstSheetPath(text('xl/workbook.xml'), text('xl/_rels/workbook.xml.rels'), files.keys());
  const sheetXml = sheetName && text(sheetName);
  if (!sheetXml) throw new Error('O ficheiro Excel não contém nenhuma folha legível.');

  return parseSheetRows(sheetXml, parseSharedStrings(text('xl/sharedStrings.xml')));
}
