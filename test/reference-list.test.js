import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReferenceRows } from '../src/reference-list.js';

test('uses the first two columns when there is no header', () => {
  const { references, hasHeader } = parseReferenceRows([
    ['A1', 'Contrato final'],
    ['A2', 'Recibo'],
  ]);
  assert.equal(hasHeader, false);
  assert.deepEqual(references.map((r) => [r.ref, r.newName]), [
    ['A1', 'Contrato final'],
    ['A2', 'Recibo'],
  ]);
});

test('detects accented headers in any column order', () => {
  const { references, hasHeader } = parseReferenceRows([
    ['Novo Nome', 'Referência'],
    ['Contrato final', 'A1'],
  ]);
  assert.equal(hasHeader, true);
  assert.deepEqual(references, [{ line: 2, ref: 'A1', newName: 'Contrato final' }]);
});

test('reports rows without a reference and ignores fully empty rows', () => {
  const { references, issues } = parseReferenceRows([
    ['Referência', 'Novo nome'],
    ['', 'Sem código'],
    ['', ''],
    ['B2', ''],
  ]);
  assert.deepEqual(issues, [{ line: 2, message: 'Referência vazia; linha ignorada.' }]);
  assert.deepEqual(references, [{ line: 4, ref: 'B2', newName: '' }]);
});
