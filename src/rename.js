export const MAX_NAME_BYTES = 200;

const INVALID_CHARS = /[\\/:*?"<>|\x00-\x1f]/;
const RESERVED_NAME = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
const encoder = new TextEncoder();

export function normalizeKey(value) {
  return String(value ?? '').normalize('NFC').trim().toLowerCase();
}

/** Separa "nome.ext" em stem e extensão (ext inclui o ponto; vazia se não houver). */
export function splitExtension(fileName) {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? { stem: fileName.slice(0, dot), ext: fileName.slice(dot) } : { stem: fileName, ext: '' };
}

/** Associa cada ficheiro à primeira referência cujo código é igual ao nome do ficheiro (sem extensão). */
export function autoLink(files, references) {
  const indexByKey = new Map();
  references.forEach((r, i) => {
    const key = normalizeKey(r.ref);
    if (!indexByKey.has(key)) indexByKey.set(key, i);
  });
  const links = {};
  for (const file of files) {
    links[file.id] = indexByKey.get(normalizeKey(splitExtension(file.name).stem)) ?? null;
  }
  return links;
}

/** Mantém a extensão original, a não ser que o novo nome já a inclua. */
export function buildTargetName(newName, originalName) {
  const { ext } = splitExtension(originalName);
  const base = newName.trim();
  return ext && !base.toLowerCase().endsWith(ext.toLowerCase()) ? base + ext : base;
}

/** Devolve a descrição do problema, ou null se o nome for válido. */
export function validateTargetName(name) {
  if (INVALID_CHARS.test(name)) return 'Contém caracteres não permitidos (\\ / : * ? " < > |).';
  if (/[. ]$/.test(name)) return 'Não pode terminar em ponto ou espaço.';
  if (name.startsWith('.')) return 'Não pode começar por ponto.';
  if (RESERVED_NAME.test(splitExtension(name).stem)) return 'Nome reservado pelo sistema.';
  if (encoder.encode(name).length > MAX_NAME_BYTES) return `Nome demasiado longo (máximo ${MAX_NAME_BYTES} bytes).`;
  return null;
}

/**
 * Calcula o resultado de cada renomeação.
 * `links` é um objeto { fileId: índice em references | null }.
 * Estados: ok | error | conflict | skipped.
 */
export function planRenames({ files, references, links }) {
  const referenceCount = new Map();
  for (const r of references) {
    const key = normalizeKey(r.ref);
    referenceCount.set(key, (referenceCount.get(key) ?? 0) + 1);
  }

  const items = files.map((file) => {
    const item = {
      fileId: file.id,
      originalName: file.name,
      ref: '',
      newName: '',
      targetName: '',
      status: 'skipped',
      message: 'Sem referência associada.',
    };
    const index = links[file.id];
    if (index === null || index === undefined) return item;

    const reference = references[index];
    Object.assign(item, { ref: reference.ref, newName: reference.newName, status: 'ok', message: '' });

    if (!reference.newName.trim()) {
      item.status = 'error';
      item.message = 'Novo nome vazio na lista.';
      return item;
    }
    item.targetName = buildTargetName(reference.newName, file.name);
    const problem = validateTargetName(item.targetName);
    if (problem) {
      item.status = 'error';
      item.message = problem;
    } else if (referenceCount.get(normalizeKey(reference.ref)) > 1) {
      item.status = 'conflict';
      item.message = 'Referência repetida na lista.';
    }
    return item;
  });

  const byTarget = new Map();
  for (const item of items) {
    if (item.status !== 'ok') continue;
    const key = item.targetName.toLowerCase();
    byTarget.set(key, [...(byTarget.get(key) ?? []), item]);
  }
  for (const group of byTarget.values()) {
    if (group.length < 2) continue;
    for (const item of group) {
      item.status = 'conflict';
      item.message = 'Mais do que um ficheiro com este novo nome.';
    }
  }

  const summary = { ok: 0, error: 0, conflict: 0, skipped: 0 };
  for (const item of items) summary[item.status]++;
  return { items, summary };
}
