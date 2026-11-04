import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readXlsxRows } from '../src/xlsx.js';
import { makeZip } from './support/make-zip.js';

const workbookEntries = [
  {
    name: 'xl/workbook.xml',
    text: '<workbook><sheets><sheet name="Lista" sheetId="1" r:id="rId1"/></sheets></workbook>',
  },
  {
    name: 'xl/_rels/workbook.xml.rels',
    text: '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  },
  {
    name: 'xl/sharedStrings.xml',
    text:
      '<sst><si><t>Referência</t></si><si><t>Novo &amp; nome</t></si>' +
      '<si><r><t>Ana</t></r><r><t xml:space="preserve"> Silva</t></r></si></sst>',
  },
  {
    name: 'xl/worksheets/sheet1.xml',
    text:
      '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2"><v>1001</v></c><c r="B2" t="inlineStr"><is><t>Fatura janeiro</t></is></c></row>' +
      '<row r="3"><c r="C3" t="s"><v>2</v></c></row>' +
      '</sheetData></worksheet>',
  },
];

const expectedRows = [
  ['Referência', 'Novo & nome'],
  ['1001', 'Fatura janeiro'],
  ['', '', 'Ana Silva'],
];

test('reads the first sheet of a stored xlsx workbook', async () => {
  assert.deepEqual(await readXlsxRows(makeZip(workbookEntries)), expectedRows);
});

test('reads the first sheet of a deflate-compressed xlsx workbook', async () => {
  assert.deepEqual(await readXlsxRows(makeZip(workbookEntries, { deflate: true })), expectedRows);
});

test('rejects a workbook without worksheets', async () => {
  await assert.rejects(
    readXlsxRows(makeZip([{ name: 'xl/workbook.xml', text: '<workbook/>' }])),
    /não contém nenhuma folha/,
  );
});
