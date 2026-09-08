export type TransactionKind = 'income' | 'expense' | 'investment' | 'transfer';
export type TransactionStatus = 'paid' | 'pending';

export type Category = {
  id: string;
  kind: Exclude<TransactionKind, 'transfer'>;
  name: string;
  color: string;
};

export type Account = {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'cash' | 'investment' | 'credit';
  openingBalanceCents: number;
  currency: string;
};

export type PaymentMethod = {
  id: string;
  name: string;
};

export type Transaction = {
  id: string;
  kind: TransactionKind;
  title: string;
  notes?: string | null;
  amountCents: number;
  date: string;
  status: TransactionStatus;
  categoryId?: string | null;
  accountId?: string | null;
  destinationAccountId?: string | null;
  paymentMethodId?: string | null;
  responsible?: string | null;
};

export type Budget = {
  id: string;
  month: string;
  categoryId: string;
  limitCents: number;
};

export type Goal = {
  id: string;
  name: string;
  targetCents: number;
  currentCents: number;
  dueDate?: string | null;
  color: string;
};

export type FinanceData = {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  paymentMethods: PaymentMethod[];
  budgets: Budget[];
  goals: Goal[];
};

export const emptyFinanceData: FinanceData = {
  transactions: [],
  categories: [],
  accounts: [],
  paymentMethods: [],
  budgets: [],
  goals: [],
};

const categorySeed: Category[] = [
  { id: 'cat-salary', kind: 'income', name: 'Salário', color: '#2dd4bf' },
  { id: 'cat-extra', kind: 'income', name: 'Renda extra', color: '#22c55e' },
  { id: 'cat-home', kind: 'expense', name: 'Moradia', color: '#f97316' },
  { id: 'cat-market', kind: 'expense', name: 'Mercado', color: '#f59e0b' },
  {
    id: 'cat-transport',
    kind: 'expense',
    name: 'Transporte',
    color: '#8b5cf6',
  },
  { id: 'cat-leisure', kind: 'expense', name: 'Lazer', color: '#ec4899' },
  { id: 'cat-health', kind: 'expense', name: 'Saúde', color: '#38bdf8' },
  { id: 'cat-invest', kind: 'investment', name: 'Reserva', color: '#14b8a6' },
];

const demoAccounts: Account[] = [
  {
    id: 'acc-main',
    name: 'Conta principal',
    type: 'checking',
    openingBalanceCents: 185000,
    currency: 'BRL',
  },
  {
    id: 'acc-reserve',
    name: 'Reserva',
    type: 'investment',
    openingBalanceCents: 920000,
    currency: 'BRL',
  },
];

const demoPayments: PaymentMethod[] = [
  { id: 'pay-pix', name: 'Pix' },
  { id: 'pay-card', name: 'Cartão' },
  { id: 'pay-debit', name: 'Débito automático' },
];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isoDate(month: string, day: number) {
  return `${month}-${String(day).padStart(2, '0')}`;
}

export function makeDemoFinanceData(reference = new Date()): FinanceData {
  const currentMonth = monthKey(reference);
  const transactions: Transaction[] = [];

  for (let offset = 7; offset >= 0; offset -= 1) {
    const date = new Date(
      reference.getFullYear(),
      reference.getMonth() - offset,
      1,
    );
    const month = monthKey(date);
    const n = 7 - offset;
    transactions.push(
      {
        id: `demo-income-${month}`,
        kind: 'income',
        title: 'Receita principal',
        amountCents: 510000 + n * 8500,
        date: isoDate(month, 5),
        status: 'paid',
        categoryId: 'cat-salary',
        accountId: 'acc-main',
        paymentMethodId: 'pay-pix',
      },
      {
        id: `demo-home-${month}`,
        kind: 'expense',
        title: 'Moradia',
        amountCents: 142000,
        date: isoDate(month, 8),
        status: 'paid',
        categoryId: 'cat-home',
        accountId: 'acc-main',
        paymentMethodId: 'pay-pix',
      },
      {
        id: `demo-market-${month}`,
        kind: 'expense',
        title: 'Compras do mês',
        amountCents: 67000 + (n % 3) * 4300,
        date: isoDate(month, 14),
        status: 'paid',
        categoryId: 'cat-market',
        accountId: 'acc-main',
        paymentMethodId: 'pay-card',
      },
      {
        id: `demo-invest-${month}`,
        kind: 'investment',
        title: 'Aporte mensal',
        amountCents: 55000 + n * 2500,
        date: isoDate(month, 16),
        status: 'paid',
        categoryId: 'cat-invest',
        accountId: 'acc-main',
        destinationAccountId: 'acc-reserve',
        paymentMethodId: 'pay-debit',
      },
    );
  }

  transactions.push(
    {
      id: 'demo-extra-current',
      kind: 'income',
      title: 'Projeto pontual',
      amountCents: 96000,
      date: isoDate(currentMonth, 24),
      status: 'pending',
      categoryId: 'cat-extra',
      accountId: 'acc-main',
      paymentMethodId: 'pay-pix',
    },
    {
      id: 'demo-transport-current',
      kind: 'expense',
      title: 'Mobilidade',
      amountCents: 28500,
      date: isoDate(currentMonth, 19),
      status: 'paid',
      categoryId: 'cat-transport',
      accountId: 'acc-main',
      paymentMethodId: 'pay-card',
    },
    {
      id: 'demo-leisure-current',
      kind: 'expense',
      title: 'Fim de semana',
      amountCents: 18400,
      date: isoDate(currentMonth, 27),
      status: 'pending',
      categoryId: 'cat-leisure',
      accountId: 'acc-main',
      paymentMethodId: 'pay-card',
    },
    {
      id: 'demo-health-current',
      kind: 'expense',
      title: 'Farmácia',
      amountCents: 11900,
      date: isoDate(currentMonth, 21),
      status: 'paid',
      categoryId: 'cat-health',
      accountId: 'acc-main',
      paymentMethodId: 'pay-card',
    },
  );

  return {
    transactions,
    categories: categorySeed,
    accounts: demoAccounts,
    paymentMethods: demoPayments,
    budgets: [
      {
        id: 'budget-market',
        month: currentMonth,
        categoryId: 'cat-market',
        limitCents: 95000,
      },
      {
        id: 'budget-transport',
        month: currentMonth,
        categoryId: 'cat-transport',
        limitCents: 45000,
      },
      {
        id: 'budget-leisure',
        month: currentMonth,
        categoryId: 'cat-leisure',
        limitCents: 35000,
      },
    ],
    goals: [
      {
        id: 'goal-emergency',
        name: 'Reserva de emergência',
        targetCents: 1800000,
        currentCents: 920000,
        dueDate: `${reference.getFullYear() + 1}-06-30`,
        color: '#14b8a6',
      },
      {
        id: 'goal-trip',
        name: 'Projeto em família',
        targetCents: 600000,
        currentCents: 238000,
        dueDate: `${reference.getFullYear() + 1}-02-28`,
        color: '#f59e0b',
      },
    ],
  };
}

export function formatCurrency(cents: number, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function formatMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthNumber - 1, 1));
}

export function formatShortDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(year, month - 1, day));
}

export function centsFromInput(value: string) {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthKey(new Date(year, monthNumber - 1 + offset, 1));
}
