const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function findEndOfCentralDirectory(view) {
  const minOffset = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let i = view.byteLength - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) return i;
  }
  throw new Error('Ficheiro ZIP/XLSX inválido: diretório central não encontrado.');
}

/**
 * Lê um ZIP em memória e devolve um Map nome -> Uint8Array.
 * `filter(name)` permite ignorar entradas que não interessam (poupa descompressão).
 */
export async function readZip(bytes, filter = () => true) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  const count = view.getUint16(eocd + 10, true);
  let pos = view.getUint32(eocd + 16, true);

  const entries = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(pos, true) !== CENTRAL_SIG) throw new Error('Ficheiro ZIP/XLSX inválido: entrada corrompida.');
    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = textDecoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength));
    pos += 46 + nameLength + extraLength + commentLength;
    if (!name.endsWith('/') && filter(name)) entries.push({ name, method, compressedSize, localOffset });
  }

  const files = new Map();
  for (const entry of entries) {
    if (view.getUint32(entry.localOffset, true) !== LOCAL_SIG) throw new Error('Ficheiro ZIP/XLSX inválido: cabeçalho local.');
    const nameLength = view.getUint16(entry.localOffset + 26, true);
    const extraLength = view.getUint16(entry.localOffset + 28, true);
    const start = entry.localOffset + 30 + nameLength + extraLength;
    const raw = bytes.subarray(start, start + entry.compressedSize);
    if (entry.method === 0) files.set(entry.name, raw);
    else if (entry.method === 8) files.set(entry.name, await inflateRaw(raw));
    else throw new Error(`Método de compressão não suportado: ${entry.method}`);
  }
  return files;
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/**
 * Cria um ZIP (sem compressão) a partir de [{ name, data }].
 * Os nomes devem ser únicos; quem chama é responsável por isso.
 */
export function writeZip(entries) {
  const { time, day } = dosDateTime();
  const prepared = entries.map(({ name, data }) => ({
    name: textEncoder.encode(name),
    data,
    crc: crc32(data),
  }));

  let size = 22;
  for (const e of prepared) size += 30 + e.name.length + e.data.length + 46 + e.name.length;
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);

  let pos = 0;
  const offsets = [];
  for (const e of prepared) {
    offsets.push(pos);
    view.setUint32(pos, LOCAL_SIG, true);
    view.setUint16(pos + 4, 20, true);
    view.setUint16(pos + 6, 0x0800, true); // nomes em UTF-8
    view.setUint16(pos + 8, 0, true); // sem compressão
    view.setUint16(pos + 10, time, true);
    view.setUint16(pos + 12, day, true);
    view.setUint32(pos + 14, e.crc, true);
    view.setUint32(pos + 18, e.data.length, true);
    view.setUint32(pos + 22, e.data.length, true);
    view.setUint16(pos + 26, e.name.length, true);
    out.set(e.name, pos + 30);
    out.set(e.data, pos + 30 + e.name.length);
    pos += 30 + e.name.length + e.data.length;
  }

  const centralStart = pos;
  prepared.forEach((e, i) => {
    view.setUint32(pos, CENTRAL_SIG, true);
    view.setUint16(pos + 4, 20, true);
    view.setUint16(pos + 6, 20, true);
    view.setUint16(pos + 8, 0x0800, true);
    view.setUint16(pos + 10, 0, true);
    view.setUint16(pos + 12, time, true);
    view.setUint16(pos + 14, day, true);
    view.setUint32(pos + 16, e.crc, true);
    view.setUint32(pos + 20, e.data.length, true);
    view.setUint32(pos + 24, e.data.length, true);
    view.setUint16(pos + 28, e.name.length, true);
    view.setUint32(pos + 42, offsets[i], true);
    out.set(e.name, pos + 46);
    pos += 46 + e.name.length;
  });

  view.setUint32(pos, EOCD_SIG, true);
  view.setUint16(pos + 8, prepared.length, true);
  view.setUint16(pos + 10, prepared.length, true);
  view.setUint32(pos + 12, pos - centralStart, true);
  view.setUint32(pos + 16, centralStart, true);
  return out;
}
