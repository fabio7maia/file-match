import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeText, detectDelimiter, parseCsv } from '../src/csv.js';

test('parses comma and semicolon separated values', () => {
  assert.deepEqual(parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
  assert.equal(detectDelimiter('x\ty\tz'), '\t');
});

test('handles quoted fields, escaped quotes, embedded newlines and CRLF', () => {
  const text = '"ref, 1";"diz ""olá"""\r\n2;"linha\nseguinte"\r\n';
  assert.deepEqual(parseCsv(text), [
    ['ref, 1', 'diz "olá"'],
    ['2', 'linha\nseguinte'],
  ]);
});

test('strips a UTF-8 byte order mark', () => {
  assert.deepEqual(parseCsv('﻿ref;novo\n1;x'), [['ref', 'novo'], ['1', 'x']]);
});

test('decodeText falls back to windows-1252 when bytes are not valid UTF-8', () => {
  assert.equal(decodeText(new TextEncoder().encode('ação')), 'ação');
  assert.equal(decodeText(Uint8Array.from([0x61, 0xe7, 0xe3, 0x6f])), 'ação');
});
