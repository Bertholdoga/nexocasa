import type { SheetData } from 'read-excel-file/browser';
import { unzipSync } from 'fflate';

import type { FinanceData, Transaction, TransactionKind } from './finance.ts';
import { isIsoDateStrict } from './finance-rules.ts';

export type ImportSheet = {
  name: string;
  rows: SheetData;
};

export type ImportSource = {
  sourceName: string;
  format: 'csv' | 'xlsx';
  sheets: ImportSheet[];
};

export type ImportPreview = {
  sourceName: string;
  format: 'csv' | 'xlsx';
  sheetIndex: number;
  sheetName: string;
  sheetNames: string[];
  rows: Transaction[];
  invalidCount: number;
  duplicateCount: number;
  missingColumns: string[];
};

const MAX_XLSX_BYTES = 20 * 1024 * 1024;
const MAX_WORKSHEET_XML_BYTES = 30 * 1024 * 1024;
const MAX_IMPORT_ROWS = 1_000;
const MAX_SAFE_SHEET_ROWS = 50_000;
const MAX_SAFE_SHEET_COLUMNS = 256;
const MAX_SAFE_SHEET_CELLS = 200_000;

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function splitCsvLine(line: string, separator: string) {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === separator && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function parseMoney(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(Math.abs(value) * 100);
  }
  if (typeof value !== 'string') return 0;
  const raw = value.trim();
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const number = Number(normalized.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? Math.round(Math.abs(number) * 100) : 0;
}

function cellText(value: SheetData[number][number]) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
}

function csvRows(text: string): SheetData {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const separator = lines[0].includes(';') ? ';' : ',';
  return lines.map((line) => splitCsvLine(line, separator));
}

function columnNumber(reference: string) {
  let number = 0;
  for (const character of reference) {
    number = number * 26 + character.charCodeAt(0) - 64;
  }
  return number;
}

async function assertWorkbookIsBrowserSafe(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let worksheetXmlBytes = 0;
  let sheets: Record<string, Uint8Array>;
  try {
    sheets = unzipSync(bytes, {
      filter(info) {
        if (!/^xl\/worksheets\/sheet\d+\.xml$/i.test(info.name)) return false;
        worksheetXmlBytes += info.originalSize;
        if (worksheetXmlBytes > MAX_WORKSHEET_XML_BYTES) {
          throw new Error(
            'A planilha é complexa demais para importação direta. Exporte somente a aba necessária como CSV.',
          );
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('complexa demais')) {
      throw error;
    }
    throw new Error(
      'O arquivo Excel está danificado ou não é um .xlsx válido.',
    );
  }

  const decoder = new TextDecoder();
  for (const content of Object.values(sheets)) {
    const xml = decoder.decode(content);
    const references = /<c\b[^>]*\br="([A-Z]{1,3})(\d+)"/g;
    let match: RegExpExecArray | null;
    let cellCount = 0;
    let maxRow = 0;
    let maxColumn = 0;
    while ((match = references.exec(xml))) {
      cellCount += 1;
      maxRow = Math.max(maxRow, Number(match[2]));
      maxColumn = Math.max(maxColumn, columnNumber(match[1]));
      if (
        cellCount > MAX_SAFE_SHEET_CELLS ||
        maxRow > MAX_SAFE_SHEET_ROWS ||
        maxColumn > MAX_SAFE_SHEET_COLUMNS
      ) {
        throw new Error(
          'Esta planilha possui linhas ou colunas vazias formatadas muito distantes. Use uma versão otimizada ou exporte a aba necessária como CSV.',
        );
      }
    }
  }
}

export async function readTransactionImportFile(
  file: File,
): Promise<ImportSource> {
  const isXlsx = file.name.toLowerCase().endsWith('.xlsx');
  const maxBytes = isXlsx ? MAX_XLSX_BYTES : 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(
      isXlsx
        ? 'A planilha deve ter no máximo 20 MB.'
        : 'O CSV deve ter no máximo 10 MB.',
    );
  }

  if (isXlsx) {
    await assertWorkbookIsBrowserSafe(file);
    const { default: readWorkbook } = await import('read-excel-file/browser');
    const sheets = await readWorkbook(file);
    return {
      sourceName: file.name,
      format: 'xlsx',
      sheets: sheets.map((sheet) => ({
        name: sheet.sheet,
        rows: sheet.data,
      })),
    };
  }

  if (!file.name.toLowerCase().endsWith('.csv')) {
    throw new Error('Selecione um arquivo .csv ou .xlsx.');
  }
  return {
    sourceName: file.name,
    format: 'csv',
    sheets: [{ name: 'CSV', rows: csvRows(await file.text()) }],
  };
}

function importedDate(value: SheetData[number][number]) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = cellText(value);
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (brazilian) return `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`;
  return raw.slice(0, 10);
}

export function buildImportPreview(
  source: ImportSource,
  sheetIndex: number,
  data: FinanceData,
): ImportPreview {
  const safeIndex = Math.max(0, Math.min(sheetIndex, source.sheets.length - 1));
  const sheet = source.sheets[safeIndex];
  const table = sheet?.rows ?? [];
  const headerAliases = {
    date: ['data', 'date'],
    kind: ['grupo', 'tipo', 'kind'],
    title: ['descricao', 'titulo', 'title'],
    amount: ['valor', 'amount'],
    status: ['status', 'situacao'],
    category: ['categoria', 'category'],
  } as const;
  const indexesForRow = (row: SheetData[number]) => {
    const headers = row.map((cell) => normalizeText(cellText(cell)));
    const findIndex = (names: readonly string[]) =>
      headers.findIndex((item) => names.includes(item));
    return {
      date: findIndex(headerAliases.date),
      kind: findIndex(headerAliases.kind),
      title: findIndex(headerAliases.title),
      amount: findIndex(headerAliases.amount),
      status: findIndex(headerAliases.status),
      category: findIndex(headerAliases.category),
    };
  };
  let headerRowIndex = 0;
  let indexes = indexesForRow(table[0] ?? []);
  let bestRequiredCount = -1;
  for (let rowIndex = 0; rowIndex < Math.min(table.length, 50); rowIndex += 1) {
    const candidate = indexesForRow(table[rowIndex]);
    const requiredCount = [
      candidate.date,
      candidate.kind,
      candidate.title,
      candidate.amount,
    ].filter((index) => index >= 0).length;
    if (requiredCount > bestRequiredCount) {
      bestRequiredCount = requiredCount;
      headerRowIndex = rowIndex;
      indexes = candidate;
    }
    if (requiredCount === 4) break;
  }
  const labels: Record<'date' | 'kind' | 'title' | 'amount', string> = {
    date: 'data',
    kind: 'grupo/tipo',
    title: 'descrição',
    amount: 'valor',
  };
  const missingColumns = (Object.keys(labels) as Array<keyof typeof labels>)
    .filter((key) => indexes[key] < 0)
    .map((key) => labels[key]);

  const rows: Transaction[] = [];
  let invalidCount = 0;
  let duplicateCount = 0;
  const seen = new Set(
    data.transactions.map((item) =>
      normalizeText(
        `${item.date}|${item.kind}|${item.title}|${item.amountCents}`,
      ),
    ),
  );

  if (!missingColumns.length) {
    let evaluatedRows = 0;
    for (const cells of table.slice(headerRowIndex + 1)) {
      const relevantValues = [
        cells[indexes.date],
        cells[indexes.kind],
        cells[indexes.title],
        cells[indexes.amount],
      ];
      if (relevantValues.every((value) => !cellText(value))) continue;
      if (evaluatedRows >= MAX_IMPORT_ROWS) break;
      evaluatedRows += 1;
      const rawKind = normalizeText(cellText(cells[indexes.kind]));
      const kind: TransactionKind =
        rawKind.includes('entrada') || rawKind.includes('receita')
          ? 'income'
          : rawKind.includes('invest')
            ? 'investment'
            : rawKind.includes('transfer')
              ? 'transfer'
              : 'expense';
      const date = importedDate(cells[indexes.date]);
      const title = cellText(cells[indexes.title]);
      const amountCents = parseMoney(cells[indexes.amount]);
      if (!isIsoDateStrict(date) || !title || amountCents <= 0) {
        invalidCount += 1;
        continue;
      }
      const fingerprint = normalizeText(
        `${date}|${kind}|${title}|${amountCents}`,
      );
      if (seen.has(fingerprint)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(fingerprint);
      const categoryName = normalizeText(cellText(cells[indexes.category]));
      const categoryId = data.categories.find(
        (item) =>
          item.kind === kind && normalizeText(item.name) === categoryName,
      )?.id;
      rows.push({
        id: `import-${crypto.randomUUID()}`,
        kind,
        title,
        amountCents,
        date,
        status: normalizeText(cellText(cells[indexes.status])).includes('pend')
          ? 'pending'
          : 'paid',
        categoryId: categoryId ?? null,
        accountId:
          data.accounts.find((item) => item.type !== 'credit')?.id ?? null,
        paymentMethodId: data.paymentMethods[0]?.id ?? null,
      });
    }
  } else {
    invalidCount = table
      .slice(headerRowIndex + 1, headerRowIndex + 1 + MAX_IMPORT_ROWS)
      .filter((row) => row.some((cell) => Boolean(cellText(cell)))).length;
  }

  return {
    sourceName: source.sourceName,
    format: source.format,
    sheetIndex: safeIndex,
    sheetName: sheet?.name ?? 'Planilha',
    sheetNames: source.sheets.map((item) => item.name),
    rows,
    invalidCount,
    duplicateCount,
    missingColumns,
  };
}
