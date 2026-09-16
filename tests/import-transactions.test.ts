import assert from 'node:assert/strict';
import test from 'node:test';
import { strToU8, zipSync } from 'fflate';

import {
  buildImportPreview,
  readTransactionImportFile,
} from '../lib/import-transactions.ts';
import type { FinanceData } from '../lib/finance.ts';

const emptyFinanceData: FinanceData = {
  currency: 'EUR',
  transactions: [],
  categories: [],
  accounts: [],
  paymentMethods: [],
  budgets: [],
  goals: [],
  recurrenceRules: [],
  cardStatements: [],
  attachments: [],
};

test('finds a valid transaction header below introductory rows', () => {
  const preview = buildImportPreview(
    {
      sourceName: 'teste.xlsx',
      format: 'xlsx',
      sheets: [
        {
          name: 'Janeiro',
          rows: [
            ['Relatório financeiro'],
            [],
            ['Data', 'Tipo', 'Descrição', 'Valor', 'Status', 'Categoria'],
            ['10/09/2026', 'Despesa', 'Mercado', '25,90', 'Pago', 'Mercado'],
          ],
        },
      ],
    },
    0,
    emptyFinanceData,
  );

  assert.deepEqual(preview.missingColumns, []);
  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].date, '2026-09-10');
  assert.equal(preview.rows[0].amountCents, 2590);
  assert.equal(preview.invalidCount, 0);
});

test('ignores empty rows instead of reporting them as invalid', () => {
  const preview = buildImportPreview(
    {
      sourceName: 'teste.csv',
      format: 'csv',
      sheets: [
        {
          name: 'CSV',
          rows: [
            ['data', 'grupo', 'descricao', 'valor'],
            [null, null, null, null],
            ['2026-09-11', 'Receita', 'Salário', 100],
          ],
        },
      ],
    },
    0,
    emptyFinanceData,
  );

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.invalidCount, 0);
});

test('blocks workbooks with distant formatted cells before dense parsing', async () => {
  const archive = zipSync({
    'xl/worksheets/sheet1.xml': strToU8(
      '<worksheet><sheetData><row r="1"><c r="XFD1" s="1"/></row></sheetData></worksheet>',
    ),
  });
  const file = new File([archive], 'formatacao-distante.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  await assert.rejects(
    () => readTransactionImportFile(file),
    /linhas ou colunas vazias formatadas muito distantes/,
  );
});
