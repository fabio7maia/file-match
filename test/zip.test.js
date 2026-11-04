import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, readZip, writeZip } from '../src/zip.js';
import { makeZip } from './support/make-zip.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(encoder.encode('123456789')), 0xcbf43926);
});

test('writeZip output can be read back with readZip', async () => {
  const zip = writeZip([
    { name: 'Relatório ação.pdf', data: encoder.encode('conteúdo 1') },
    { name: 'nota.txt', data: encoder.encode('') },
  ]);
  const files = await readZip(zip);

  assert.deepEqual([...files.keys()], ['Relatório ação.pdf', 'nota.txt']);
  assert.equal(decoder.decode(files.get('Relatório ação.pdf')), 'conteúdo 1');
  assert.equal(files.get('nota.txt').length, 0);
});

test('readZip inflates deflate-compressed entries', async () => {
  const zip = makeZip([{ name: 'a.txt', text: 'olá '.repeat(200) }], { deflate: true });
  const files = await readZip(zip);
  assert.equal(decoder.decode(files.get('a.txt')), 'olá '.repeat(200));
});

test('readZip only extracts entries accepted by the filter', async () => {
  const zip = makeZip([
    { name: 'keep.txt', text: 'sim' },
    { name: 'skip.txt', text: 'não' },
  ]);
  const files = await readZip(zip, (name) => name === 'keep.txt');
  assert.deepEqual([...files.keys()], ['keep.txt']);
});

test('readZip rejects data that is not a zip file', async () => {
  await assert.rejects(readZip(encoder.encode('isto não é um zip')), /ZIP\/XLSX inválido/);
});
