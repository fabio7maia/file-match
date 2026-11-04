import { decodeText, parseCsv } from '/src/csv.js';
import { parseReferenceRows } from '/src/reference-list.js';
import { autoLink, planRenames } from '/src/rename.js';
import { readXlsxRows } from '/src/xlsx.js';
import { writeZip } from '/src/zip.js';

const STATUS_LABELS = { ok: 'Pronto', error: 'Erro', conflict: 'Conflito', skipped: 'Sem referência' };

const state = {
  files: [],
  references: [],
  issues: [],
  links: {},
  plan: null,
};

const $ = (id) => document.getElementById(id);

async function readList(file) {
  if (/\.(xlsx|xlsm)$/i.test(file.name)) return readXlsxRows(new Uint8Array(await file.arrayBuffer()));
  if (/\.xls$/i.test(file.name)) throw new Error('Formato .xls não suportado: guarde o ficheiro como .xlsx ou CSV.');
  return parseCsv(decodeText(new Uint8Array(await file.arrayBuffer())));
}

function linkOptions(select, selectedIndex) {
  const empty = new Option('— sem referência —', '');
  select.append(empty);
  state.references.forEach((r, i) => {
    select.append(new Option(r.newName ? `${r.ref} → ${r.newName}` : `${r.ref} (sem novo nome)`, String(i)));
  });
  select.value = selectedIndex === null || selectedIndex === undefined ? '' : String(selectedIndex);
}

function renderPlan() {
  state.plan = planRenames({ files: state.files, references: state.references, links: state.links });
  const { items, summary } = state.plan;

  $('summary').textContent =
    `${summary.ok} pronto(s), ${summary.error} com erro, ${summary.conflict} em conflito, ${summary.skipped} sem referência.`;

  const linkedIndexes = new Set(Object.values(state.links).filter((i) => i !== null));
  const unused = state.references.length - linkedIndexes.size;
  const issueItems = [
    ...state.issues.map((i) => `Linha ${i.line}: ${i.message}`),
    ...(unused > 0 ? [`${unused} referência(s) da lista sem ficheiro correspondente.`] : []),
  ];
  $('issues').replaceChildren(...issueItems.map((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  }));

  const hasFiles = state.files.length > 0;
  $('empty').hidden = hasFiles;
  $('preview').hidden = !hasFiles;
  const tbody = $('preview').tBodies[0];
  tbody.replaceChildren();
  for (const item of items) {
    const row = tbody.insertRow();
    row.insertCell().textContent = item.originalName;

    const select = document.createElement('select');
    select.setAttribute('aria-label', `Referência de ${item.originalName}`);
    linkOptions(select, state.links[item.fileId]);
    select.addEventListener('change', () => {
      state.links[item.fileId] = select.value === '' ? null : Number(select.value);
      renderPlan();
    });
    row.insertCell().append(select);

    row.insertCell().textContent = item.targetName;
    const statusCell = row.insertCell();
    statusCell.textContent = STATUS_LABELS[item.status];
    statusCell.className = `status-${item.status}`;
    row.insertCell().textContent = item.message;
  }

  const exportable = summary.ok;
  $('download').disabled = exportable === 0;
  $('download').textContent = `Descarregar ZIP (${exportable} ficheiro(s))`;
}

async function downloadZip() {
  const { items, summary } = state.plan;
  const excluded = items.length - summary.ok;
  if (excluded > 0 && !confirm(`${excluded} ficheiro(s) com erro, conflito ou sem referência ficam de fora do ZIP. Continuar?`)) {
    return;
  }

  $('download').disabled = true;
  $('status').textContent = 'A preparar o ZIP…';
  try {
    const fileById = new Map(state.files.map((f) => [f.id, f.file]));
    const entries = await Promise.all(
      items
        .filter((item) => item.status === 'ok')
        .map(async (item) => ({
          name: item.targetName,
          data: new Uint8Array(await fileById.get(item.fileId).arrayBuffer()),
        })),
    );
    const blob = new Blob([writeZip(entries)], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'renomeados.zip';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('status').textContent = `ZIP criado com ${entries.length} ficheiro(s).`;
  } catch (error) {
    $('status').textContent = `Erro ao criar o ZIP: ${error.message}`;
  } finally {
    renderPlan();
  }
}

$('files').addEventListener('change', (event) => {
  state.files = [...event.target.files].map((file, i) => ({ id: `f${i}`, file, name: file.name }));
  state.links = autoLink(state.files, state.references);
  $('status').textContent = '';
  renderPlan();
});

$('list').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  $('status').textContent = '';
  try {
    const parsed = parseReferenceRows(await readList(file));
    state.references = parsed.references;
    state.issues = parsed.issues;
    state.links = autoLink(state.files, state.references);
    $('listInfo').textContent =
      `${parsed.references.length} referência(s) lidas de ${file.name}` +
      (parsed.hasHeader ? ' (com cabeçalhos).' : '.');
  } catch (error) {
    state.references = [];
    state.issues = [];
    state.links = {};
    $('listInfo').textContent = `Não foi possível ler a lista: ${error.message}`;
  }
  renderPlan();
});

$('download').addEventListener('click', downloadZip);
renderPlan();
