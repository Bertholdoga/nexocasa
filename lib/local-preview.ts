import type { FinanceData } from '@/lib/finance';

const DATA_KEY = 'nexocasa:local-finance:v2';
const DATABASE_NAME = 'nexocasa-local-files';
const STORE_NAME = 'attachments';

function arraysOrFallback(
  candidate: Partial<FinanceData>,
  fallback: FinanceData,
): FinanceData {
  const accountCurrency = candidate.accounts?.find(
    (account) => account.currency === 'EUR' || account.currency === 'BRL',
  )?.currency;
  const currency =
    candidate.currency === 'EUR' || candidate.currency === 'BRL'
      ? candidate.currency
      : accountCurrency === 'EUR' || accountCurrency === 'BRL'
        ? accountCurrency
        : fallback.currency;
  return {
    currency,
    transactions: Array.isArray(candidate.transactions)
      ? candidate.transactions
      : fallback.transactions,
    categories: Array.isArray(candidate.categories)
      ? candidate.categories
      : fallback.categories,
    accounts: (Array.isArray(candidate.accounts)
      ? candidate.accounts
      : fallback.accounts
    ).map((account) => ({ ...account, currency })),
    paymentMethods: Array.isArray(candidate.paymentMethods)
      ? candidate.paymentMethods
      : fallback.paymentMethods,
    budgets: Array.isArray(candidate.budgets)
      ? candidate.budgets
      : fallback.budgets,
    goals: Array.isArray(candidate.goals) ? candidate.goals : fallback.goals,
    recurrenceRules: Array.isArray(candidate.recurrenceRules)
      ? candidate.recurrenceRules
      : fallback.recurrenceRules,
    cardStatements: Array.isArray(candidate.cardStatements)
      ? candidate.cardStatements
      : fallback.cardStatements,
    attachments: Array.isArray(candidate.attachments)
      ? candidate.attachments
      : fallback.attachments,
  };
}

export function loadLocalFinanceData(fallback: FinanceData) {
  try {
    const raw = window.localStorage.getItem(DATA_KEY);
    if (!raw) return fallback;
    return arraysOrFallback(JSON.parse(raw) as Partial<FinanceData>, fallback);
  } catch {
    return fallback;
  }
}

export function saveLocalFinanceData(data: FinanceData) {
  try {
    window.localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {
    // Local preview persistence is helpful but must never block the interface.
  }
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => reject(transaction.error);
      }),
  );
}

export async function saveLocalAttachment(id: string, file: File) {
  await runStore('readwrite', (store) =>
    store.put({
      id,
      blob: file,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }),
  );
}

export async function getLocalAttachment(id: string) {
  const record = await runStore<{
    id: string;
    blob: Blob;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  } | null>('readonly', (store) => store.get(id));
  return record ?? null;
}

export async function deleteLocalAttachment(id: string) {
  await runStore('readwrite', (store) => store.delete(id));
}
