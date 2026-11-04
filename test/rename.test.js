import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoLink, buildTargetName, planRenames, validateTargetName } from '../src/rename.js';

const files = (...names) => names.map((name, i) => ({ id: `f${i}`, name }));

test('autoLink matches file stems to references, ignoring case and extension', () => {
  const refs = [{ ref: 'A1', newName: 'x' }, { ref: 'b2', newName: 'y' }];
  const links = autoLink(files('a1.pdf', 'B2.docx', 'zzz.txt'), refs);
  assert.deepEqual(links, { f0: 0, f1: 1, f2: null });
});

test('buildTargetName keeps the original extension without doubling it', () => {
  assert.equal(buildTargetName('Contrato', 'A1.PDF'), 'Contrato.PDF');
  assert.equal(buildTargetName('Contrato.pdf', 'A1.pdf'), 'Contrato.pdf');
  assert.equal(buildTargetName('  Nota  ', 'semextensao'), 'Nota');
});

test('validateTargetName rejects names that cannot be used on Windows, macOS or Linux', () => {
  assert.match(validateTargetName('a/b.pdf'), /caracteres não permitidos/);
  assert.match(validateTargetName('final.'), /ponto ou espaço/);
  assert.match(validateTargetName('.oculto'), /começar por ponto/);
  assert.match(validateTargetName('CON.pdf'), /reservado/);
  assert.match(validateTargetName('x'.repeat(201)), /demasiado longo/);
  assert.equal(validateTargetName('Relatório 2024.pdf'), null);
});

test('planRenames marks linked files ok and unlinked files skipped, preserving extensions', () => {
  const references = [{ line: 1, ref: 'A1', newName: 'Contrato' }];
  const { items, summary } = planRenames({
    files: files('A1.pdf', 'outro.pdf'),
    references,
    links: { f0: 0, f1: null },
  });
  assert.equal(items[0].status, 'ok');
  assert.equal(items[0].targetName, 'Contrato.pdf');
  assert.equal(items[1].status, 'skipped');
  assert.deepEqual(summary, { ok: 1, error: 0, conflict: 0, skipped: 1 });
});

test('planRenames flags empty and invalid new names as errors', () => {
  const references = [
    { line: 1, ref: 'A1', newName: '' },
    { line: 2, ref: 'A2', newName: 'mau:nome' },
  ];
  const { items, summary } = planRenames({
    files: files('A1.pdf', 'A2.pdf'),
    references,
    links: { f0: 0, f1: 1 },
  });
  assert.equal(items[0].status, 'error');
  assert.equal(items[1].status, 'error');
  assert.equal(summary.error, 2);
});

test('planRenames flags files that would get the same name, ignoring case, as conflicts', () => {
  const references = [
    { line: 1, ref: 'A1', newName: 'Fatura' },
    { line: 2, ref: 'A2', newName: 'fatura' },
    { line: 3, ref: 'A3', newName: 'Outra' },
  ];
  const { items, summary } = planRenames({
    files: files('A1.pdf', 'A2.pdf', 'A3.pdf'),
    references,
    links: { f0: 0, f1: 1, f2: 2 },
  });
  assert.deepEqual(items.map((i) => i.status), ['conflict', 'conflict', 'ok']);
  assert.deepEqual(summary, { ok: 1, error: 0, conflict: 2, skipped: 0 });
});

test('planRenames flags a reference repeated in the list as a conflict', () => {
  const references = [
    { line: 1, ref: 'A1', newName: 'Um' },
    { line: 2, ref: 'a1', newName: 'Dois' },
  ];
  const { items } = planRenames({
    files: files('A1.pdf'),
    references,
    links: { f0: 0 },
  });
  assert.equal(items[0].status, 'conflict');
  assert.match(items[0].message, /repetida/);
});
