'use client';

import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  CalendarClock,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorCog,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  WalletCards,
  X,
} from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { chatGPTSignOutPath } from '@/app/chatgpt-auth';
import { AttachmentComposer } from '@/components/attachment-composer';
import { PlanningView } from '@/components/planning-view';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  emptyFinanceData,
  makeDemoFinanceData,
  type Account,
  type Attachment,
  type Budget,
  type CardStatement,
  type Category,
  type CurrencyCode,
  type FinanceData,
  type Goal,
  type RecurrenceRule,
  type Transaction,
  type TransactionKind,
  type TransactionStatus,
} from '@/lib/finance';
import {
  advanceRecurrenceDate,
  cardCycleForPurchase,
  type RecurrenceFrequency,
} from '@/lib/finance-rules';
import {
  buildImportPreview,
  readTransactionImportFile,
  type ImportPreview,
  type ImportSource,
} from '@/lib/import-transactions';
import {
  deleteLocalAttachment,
  getLocalAttachment,
  loadLocalFinanceData,
  saveLocalAttachment,
  saveLocalFinanceData,
} from '@/lib/local-preview';

export type WorkspaceView =
  | 'dashboard'
  | 'transactions'
  | 'planning'
  | 'budgets'
  | 'goals'
  | 'reports'
  | 'settings';

type FinanceWorkspaceProps = {
  activeView: WorkspaceView;
  displayName: string;
  isLocalPreview: boolean;
};

type TransactionDraft = {
  id?: string;
  kind: TransactionKind;
  title: string;
  amount: string;
  date: string;
  status: TransactionStatus;
  categoryId: string;
  accountId: string;
  destinationAccountId: string;
  paymentMethodId: string;
  responsible: string;
  notes: string;
  recurrenceFrequency: '' | RecurrenceFrequency;
  recurrenceEndDate: string;
};

const navItems: Array<{
  view: WorkspaceView;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}> = [
  {
    view: 'dashboard',
    label: 'Visão geral',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    view: 'transactions',
    label: 'Lançamentos',
    href: '/transactions',
    icon: ReceiptText,
  },
  {
    view: 'planning',
    label: 'Planejamento',
    href: '/planning',
    icon: CalendarClock,
  },
  { view: 'budgets', label: 'Orçamentos', href: '/budgets', icon: WalletCards },
  { view: 'goals', label: 'Metas', href: '/goals', icon: Target },
  {
    view: 'reports',
    label: 'Relatórios',
    href: '/reports',
    icon: ChartNoAxesCombined,
  },
  {
    view: 'settings',
    label: 'Configurações',
    href: '/settings',
    icon: Settings2,
  },
];

const mobileNavLabels: Partial<Record<WorkspaceView, string>> = {
  dashboard: 'Visão',
  transactions: 'Lançamentos',
  planning: 'Planejar',
  budgets: 'Limites',
};

const viewCopy: Record<
  WorkspaceView,
  { eyebrow: string; title: string; description: string }
> = {
  dashboard: {
    eyebrow: 'Visão geral',
    title: 'Seu dinheiro, em contexto.',
    description:
      'Realizado, previsto e prioridades do mês sem misturar conceitos.',
  },
  transactions: {
    eyebrow: 'Livro-caixa',
    title: 'Todos os lançamentos',
    description:
      'Encontre, ajuste e confirme movimentações em poucos segundos.',
  },
  planning: {
    eyebrow: 'Próximos ciclos',
    title: 'Cartões e recorrências',
    description:
      'Planeje faturas e gere lançamentos recorrentes somente quando decidir.',
  },
  budgets: {
    eyebrow: 'Limites conscientes',
    title: 'Orçamentos do mês',
    description: 'Veja onde ainda há espaço e onde é hora de recalibrar.',
  },
  goals: {
    eyebrow: 'Planos que avançam',
    title: 'Metas financeiras',
    description: 'Transforme intenção em progresso visível e mensurável.',
  },
  reports: {
    eyebrow: 'Leitura estratégica',
    title: 'Relatórios e tendências',
    description:
      'Compare meses e entenda as categorias que movem o seu resultado.',
  },
  settings: {
    eyebrow: 'Seu sistema',
    title: 'Configurações',
    description:
      'Categorias, contas, meios de pagamento e portabilidade dos dados.',
  },
};

const kindLabels: Record<TransactionKind, string> = {
  income: 'Entrada',
  expense: 'Despesa',
  investment: 'Investimento',
  transfer: 'Transferência',
};

const kindColors: Record<TransactionKind, string> = {
  income: '#2dd4bf',
  expense: '#fb7185',
  investment: '#fbbf24',
  transfer: '#a78bfa',
};

function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const value = new Date(year, monthNumber - 1 + offset, 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${month}-01T12:00:00`));
}

function shortMonth(month: string) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(
    new Date(`${month}-01T12:00:00`),
  );
}

const CurrencyContext = createContext<CurrencyCode>('EUR');

function useMoneyFormatter() {
  const currency = useContext(CurrencyContext);
  return (cents: number, compact = false) =>
    new Intl.NumberFormat(currency === 'EUR' ? 'pt-PT' : 'pt-BR', {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 2,
    }).format(cents / 100);
}

function parseMoney(value: string) {
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value;
  const number = Number(normalized.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? Math.round(Math.abs(number) * 100) : 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`));
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function blankTransaction(month: string, data: FinanceData): TransactionDraft {
  return {
    kind: 'expense',
    title: '',
    amount: '',
    date: `${month}-${String(Math.min(new Date().getDate(), 28)).padStart(2, '0')}`,
    status: 'paid',
    categoryId:
      data.categories.find((item) => item.kind === 'expense')?.id ?? '',
    accountId: data.accounts[0]?.id ?? '',
    destinationAccountId: data.accounts[1]?.id ?? '',
    paymentMethodId: data.paymentMethods[0]?.id ?? '',
    responsible: '',
    notes: '',
    recurrenceFrequency: '',
    recurrenceEndDate: '',
  };
}

function transactionToDraft(transaction: Transaction): TransactionDraft {
  return {
    id: transaction.id,
    kind: transaction.kind,
    title: transaction.title,
    amount: (transaction.amountCents / 100).toFixed(2).replace('.', ','),
    date: transaction.date,
    status: transaction.status,
    categoryId: transaction.categoryId ?? '',
    accountId: transaction.accountId ?? '',
    destinationAccountId: transaction.destinationAccountId ?? '',
    paymentMethodId: transaction.paymentMethodId ?? '',
    responsible: transaction.responsible ?? '',
    notes: transaction.notes ?? '',
    recurrenceFrequency: '',
    recurrenceEndDate: '',
  };
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function exportCsv(data: FinanceData) {
  const header = [
    'data',
    'grupo',
    'descricao',
    'valor',
    'moeda',
    'status',
    'categoria',
  ];
  const safeCsvCell = (value: unknown) => {
    let text = String(value);
    if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = data.transactions.map((item) => {
    const category =
      data.categories.find((entry) => entry.id === item.categoryId)?.name ?? '';
    return [
      item.date,
      kindLabels[item.kind],
      item.title,
      (item.amountCents / 100).toFixed(2).replace('.', ','),
      data.currency,
      item.status === 'paid' ? 'Pago' : 'Pendente',
      category,
    ]
      .map(safeCsvCell)
      .join(';');
  });
  const blob = new Blob([`\ufeff${[header.join(';'), ...lines].join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `nexocasa-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(href);
}

function assignLocalCardStatement(
  data: FinanceData,
  transaction: Transaction,
): { transaction: Transaction; statement: CardStatement | null } {
  const previous = data.transactions.find((item) => item.id === transaction.id);
  const previousStatement = previous?.cardStatementId
    ? data.cardStatements.find((item) => item.id === previous.cardStatementId)
    : null;
  if (previousStatement && previousStatement.status !== 'open') {
    throw new Error('A fatura está fechada e protege este lançamento.');
  }

  if (transaction.kind !== 'expense' || !transaction.accountId) {
    return {
      transaction: { ...transaction, cardStatementId: null },
      statement: null,
    };
  }
  const account = data.accounts.find(
    (item) => item.id === transaction.accountId,
  );
  if (account?.type !== 'credit') {
    return {
      transaction: { ...transaction, cardStatementId: null },
      statement: null,
    };
  }
  if (!account.closingDay || !account.dueDay) {
    throw new Error('Complete o fechamento e o vencimento do cartão.');
  }

  const cycle = cardCycleForPurchase(
    transaction.date,
    account.closingDay,
    account.dueDay,
  );
  const existing = data.cardStatements.find(
    (item) =>
      item.cardAccountId === account.id && item.cycleEnd === cycle.cycleEnd,
  );
  if (existing && existing.status !== 'open') {
    throw new Error('A fatura desse período já está fechada.');
  }
  const statement: CardStatement = existing ?? {
    id: `local-statement-${account.id}-${cycle.cycleEnd}`,
    cardAccountId: account.id,
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    dueDate: cycle.dueDate,
    status: 'open',
    closedTotalCents: null,
  };

  return {
    transaction: { ...transaction, cardStatementId: statement.id },
    statement,
  };
}

function attachmentKind(file: File): Attachment['kind'] {
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/') || file.type === 'application/pdf') {
    return 'receipt';
  }
  return 'other';
}

function downloadBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}

async function loadFinanceData() {
  const response = await fetch('/api/finance', { cache: 'no-store' });
  if (!response.ok) throw new Error('Falha ao carregar');
  return (await response.json()) as FinanceData & { preview?: boolean };
}

export function FinanceWorkspace({
  activeView,
  displayName,
  isLocalPreview,
}: FinanceWorkspaceProps) {
  const [data, setData] = useState<FinanceData>(() =>
    isLocalPreview ? makeDemoFinanceData() : emptyFinanceData,
  );
  const [month, setMonth] = useState(currentMonthKey);
  const [loading, setLoading] = useState(!isLocalPreview);
  const [saving, setSaving] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionDraft, setTransactionDraft] = useState<TransactionDraft>(
    () =>
      blankTransaction(
        currentMonthKey(),
        isLocalPreview ? makeDemoFinanceData() : emptyFinanceData,
      ),
  );
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [importSource, setImportSource] = useState<ImportSource | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [localReady, setLocalReady] = useState(!isLocalPreview);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refreshData() {
    if (isLocalPreview) return;
    try {
      const payload = await loadFinanceData();
      if (!payload.preview) setData(payload);
    } catch {
      setNotice(
        'Não foi possível sincronizar agora. Tente novamente em instantes.',
      );
    }
  }

  useEffect(() => {
    if (!isLocalPreview) return;
    const timer = window.setTimeout(() => {
      const fallback = makeDemoFinanceData();
      setData(loadLocalFinanceData(fallback));
      setLocalReady(true);
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isLocalPreview]);

  useEffect(() => {
    if (!isLocalPreview || !localReady) return;
    saveLocalFinanceData(data);
  }, [data, isLocalPreview, localReady]);

  useEffect(() => {
    if (isLocalPreview) return;
    let cancelled = false;
    void loadFinanceData()
      .then((payload) => {
        if (!cancelled && !payload.preview) setData(payload);
      })
      .catch(() => {
        if (!cancelled) {
          setNotice(
            'Não foi possível sincronizar agora. Tente novamente em instantes.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLocalPreview]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    const reportRegistrationError = (error: unknown) => {
      console.error('WebMCP registration failed', error);
    };

    const register = (tool: WebMcpTool) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(reportRegistrationError);
      } catch (error) {
        reportRegistrationError(error);
      }
    };

    register({
      name: 'get_month_finance_summary',
      title: 'Consultar resumo financeiro mensal',
      description:
        'Consulta os totais realizados e previstos de um mês do NexoCasa sem alterar dados.',
      inputSchema: {
        type: 'object',
        properties: {
          month: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}$',
            description:
              'Mês no formato AAAA-MM. Usa o mês visível quando omitido.',
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        const candidate =
          input && typeof input === 'object'
            ? (input as { month?: unknown })
            : {};
        const selectedMonth =
          typeof candidate.month === 'string' &&
          /^\d{4}-\d{2}$/.test(candidate.month)
            ? candidate.month
            : month;
        const rows = data.transactions.filter((item) =>
          item.date.startsWith(selectedMonth),
        );
        const total = (kind: TransactionKind, status?: TransactionStatus) =>
          rows
            .filter(
              (item) =>
                item.kind === kind && (!status || item.status === status),
            )
            .reduce((sum, item) => sum + item.amountCents, 0);
        const realizedIncome = total('income', 'paid');
        const realizedOut =
          total('expense', 'paid') + total('investment', 'paid');
        const expectedIncome = total('income');
        const expectedOut = total('expense') + total('investment');
        return {
          month: selectedMonth,
          currency: data.currency,
          realized: {
            incomeCents: realizedIncome,
            outflowCents: realizedOut,
            balanceCents: realizedIncome - realizedOut,
          },
          expected: {
            incomeCents: expectedIncome,
            outflowCents: expectedOut,
            balanceCents: expectedIncome - expectedOut,
          },
        };
      },
    });

    register({
      name: 'create_finance_transaction',
      title: 'Criar lançamento financeiro',
      description:
        'Cria uma entrada, despesa ou investimento no NexoCasa e atualiza imediatamente a interface visível.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['income', 'expense', 'investment'] },
          title: { type: 'string', minLength: 1, maxLength: 160 },
          amountCents: { type: 'integer', minimum: 1 },
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          status: { type: 'string', enum: ['paid', 'pending'] },
          categoryName: { type: 'string', maxLength: 80 },
        },
        required: ['kind', 'title', 'amountCents', 'date', 'status'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (!input || typeof input !== 'object')
          throw new Error('Entrada inválida.');
        const candidate = input as Record<string, unknown>;
        const kind = candidate.kind;
        const title = candidate.title;
        const amountCents = candidate.amountCents;
        const date = candidate.date;
        const status = candidate.status;
        if (
          !['income', 'expense', 'investment'].includes(String(kind)) ||
          typeof title !== 'string' ||
          !title.trim() ||
          !Number.isSafeInteger(amountCents) ||
          Number(amountCents) <= 0 ||
          typeof date !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !['paid', 'pending'].includes(String(status))
        ) {
          throw new Error('Grupo, descrição, valor, data ou status inválido.');
        }
        const categoryName =
          typeof candidate.categoryName === 'string'
            ? normalizeText(candidate.categoryName)
            : '';
        const category = data.categories.find(
          (item) =>
            item.kind === kind &&
            (!categoryName || normalizeText(item.name) === categoryName),
        );
        const transaction: Transaction = {
          id: newId('tx'),
          kind: kind as Exclude<TransactionKind, 'transfer'>,
          title: title.trim(),
          amountCents: Number(amountCents),
          date,
          status: status as TransactionStatus,
          categoryId: category?.id ?? null,
          accountId: data.accounts[0]?.id ?? null,
          paymentMethodId: data.paymentMethods[0]?.id ?? null,
        };
        if (!isLocalPreview) {
          const response = await fetch('/api/finance', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              action: 'save-transaction',
              ...transaction,
            }),
          });
          const payload = (await response.json()) as { error?: string };
          if (!response.ok)
            throw new Error(payload.error ?? 'Não foi possível salvar.');
        }
        setData((current) => ({
          ...current,
          transactions: [transaction, ...current.transactions],
        }));
        setNotice('Lançamento criado por uma ação assistida.');
        return {
          id: transaction.id,
          status: 'created',
          date: transaction.date,
          amountCents: transaction.amountCents,
          currency: data.currency,
        };
      },
    });

    return () => lifecycle.abort();
  }, [data, isLocalPreview, month]);

  async function postAction(body: Record<string, unknown>) {
    if (isLocalPreview) return { preview: true };
    setSaving(true);
    try {
      const response = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error ?? 'Não foi possível salvar.');
      return payload;
    } finally {
      setSaving(false);
    }
  }

  function openNewTransaction(kind: TransactionKind = 'expense') {
    const draft = blankTransaction(month, data);
    draft.kind = kind;
    draft.categoryId =
      data.categories.find(
        (item) => item.kind === (kind === 'transfer' ? 'expense' : kind),
      )?.id ?? '';
    setTransactionDraft(draft);
    setPendingFiles([]);
    setTransactionOpen(true);
  }

  function openEditTransaction(transaction: Transaction) {
    setTransactionDraft(transactionToDraft(transaction));
    setPendingFiles([]);
    setTransactionOpen(true);
  }

  async function saveTransaction(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseMoney(transactionDraft.amount);
    if (!transactionDraft.title.trim() || amountCents <= 0) {
      setNotice('Preencha uma descrição e um valor maior que zero.');
      return;
    }
    if (
      transactionDraft.kind === 'transfer' &&
      (!transactionDraft.accountId ||
        !transactionDraft.destinationAccountId ||
        transactionDraft.accountId === transactionDraft.destinationAccountId)
    ) {
      setNotice('Escolha contas de origem e destino diferentes.');
      return;
    }
    if (
      transactionDraft.recurrenceFrequency &&
      transactionDraft.recurrenceEndDate &&
      transactionDraft.recurrenceEndDate <= transactionDraft.date
    ) {
      setNotice('O término da recorrência deve ser posterior à primeira data.');
      return;
    }

    const selectedAccount = data.accounts.find(
      (item) => item.id === transactionDraft.accountId,
    );
    if (
      selectedAccount?.type === 'credit' &&
      transactionDraft.kind !== 'expense'
    ) {
      setNotice('Use o cartão somente em lançamentos do tipo despesa.');
      return;
    }

    const isNew = !transactionDraft.id;
    let transaction: Transaction = {
      id: transactionDraft.id ?? newId('tx'),
      kind: transactionDraft.kind,
      title: transactionDraft.title.trim(),
      amountCents,
      date: transactionDraft.date,
      status: transactionDraft.status,
      categoryId:
        transactionDraft.kind === 'transfer'
          ? null
          : transactionDraft.categoryId || null,
      accountId: transactionDraft.accountId || null,
      destinationAccountId:
        transactionDraft.kind === 'transfer'
          ? transactionDraft.destinationAccountId || null
          : null,
      paymentMethodId: transactionDraft.paymentMethodId || null,
      responsible: transactionDraft.responsible.trim() || null,
      notes: transactionDraft.notes.trim() || null,
    };

    let statement: CardStatement | null = null;
    let recurrence: RecurrenceRule | null = null;
    const uploadedAttachments: Attachment[] = [];
    try {
      if (isLocalPreview) {
        setSaving(true);
        const assignment = assignLocalCardStatement(data, transaction);
        transaction = assignment.transaction;
        statement = assignment.statement;
      } else {
        const result = (await postAction({
          action: 'save-transaction',
          ...transaction,
        })) as { cardStatementId?: string | null };
        transaction = {
          ...transaction,
          cardStatementId: result.cardStatementId ?? null,
        };
      }

      if (isNew && transactionDraft.recurrenceFrequency) {
        const frequency = transactionDraft.recurrenceFrequency;
        const nextDate = advanceRecurrenceDate(
          transaction.date,
          frequency,
          1,
          transaction.date,
        );
        if (isLocalPreview) {
          recurrence = {
            id: newId('recurrence'),
            sourceTransactionId: transaction.id,
            frequency,
            interval: 1,
            anchorDate: transaction.date,
            nextDate,
            endDate: transactionDraft.recurrenceEndDate || null,
            occurrenceStatus: 'pending',
            active: true,
          };
          transaction = {
            ...transaction,
            recurrenceId: recurrence.id,
            recurrenceOccurrenceDate: transaction.date,
          };
        } else {
          const result = (await postAction({
            action: 'save-recurrence',
            sourceTransactionId: transaction.id,
            frequency,
            interval: 1,
            endDate: transactionDraft.recurrenceEndDate || null,
          })) as { id: string; nextDate: string; anchorDate: string };
          transaction = {
            ...transaction,
            recurrenceId: result.id,
            recurrenceOccurrenceDate: transaction.date,
          };
        }
      }

      if (pendingFiles.length) setSaving(true);
      for (const file of pendingFiles) {
        if (isLocalPreview) {
          const id = newId('attachment');
          await saveLocalAttachment(id, file);
          uploadedAttachments.push({
            id,
            transactionId: transaction.id,
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            kind: attachmentKind(file),
            status: 'ready',
            createdAt: new Date().toISOString(),
          });
        } else {
          const form = new FormData();
          form.set('transactionId', transaction.id);
          form.set('file', file);
          const response = await fetch('/api/attachments', {
            method: 'POST',
            body: form,
          });
          const payload = (await response.json()) as Attachment & {
            error?: string;
          };
          if (!response.ok) {
            throw new Error(
              payload.error ?? 'Não foi possível guardar um comprovante.',
            );
          }
          uploadedAttachments.push(payload);
        }
      }

      if (isLocalPreview) {
        setData((current) => ({
          ...current,
          transactions: current.transactions.some(
            (item) => item.id === transaction.id,
          )
            ? current.transactions.map((item) =>
                item.id === transaction.id ? transaction : item,
              )
            : [transaction, ...current.transactions],
          recurrenceRules: recurrence
            ? [...current.recurrenceRules, recurrence]
            : current.recurrenceRules,
          cardStatements:
            statement &&
            !current.cardStatements.some((item) => item.id === statement?.id)
              ? [statement, ...current.cardStatements]
              : current.cardStatements,
          attachments: [...uploadedAttachments, ...current.attachments],
        }));
      } else {
        await refreshData();
      }
      setTransactionOpen(false);
      setPendingFiles([]);
      setNotice(
        !isNew
          ? 'Lançamento atualizado.'
          : transactionDraft.recurrenceFrequency
            ? 'Lançamento e recorrência adicionados.'
            : 'Lançamento adicionado.',
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Não foi possível salvar.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(transaction: Transaction) {
    const status: TransactionStatus =
      transaction.status === 'paid' ? 'pending' : 'paid';
    try {
      const statement = transaction.cardStatementId
        ? data.cardStatements.find(
            (item) => item.id === transaction.cardStatementId,
          )
        : null;
      if (isLocalPreview && statement && statement.status !== 'open') {
        throw new Error('A fatura está fechada e protege este lançamento.');
      }
      await postAction({ action: 'toggle-status', id: transaction.id, status });
      setData((current) => ({
        ...current,
        transactions: current.transactions.map((item) =>
          item.id === transaction.id ? { ...item, status } : item,
        ),
      }));
      setNotice(
        status === 'paid' ? 'Marcado como realizado.' : 'Movido para pendente.',
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Não foi possível atualizar.',
      );
    }
  }

  async function deleteTransaction() {
    if (!deleteTarget) return;
    try {
      const relatedAttachments = data.attachments.filter(
        (item) => item.transactionId === deleteTarget.id,
      );
      if (isLocalPreview) {
        const statement = deleteTarget.cardStatementId
          ? data.cardStatements.find(
              (item) => item.id === deleteTarget.cardStatementId,
            )
          : null;
        if (statement && statement.status !== 'open') {
          throw new Error('A fatura está fechada e protege este lançamento.');
        }
        await Promise.all(
          relatedAttachments.map((item) => deleteLocalAttachment(item.id)),
        );
      }
      await postAction({ action: 'delete-transaction', id: deleteTarget.id });
      setData((current) => ({
        ...current,
        transactions: current.transactions.filter(
          (item) => item.id !== deleteTarget.id,
        ),
        recurrenceRules: current.recurrenceRules.filter(
          (item) => item.sourceTransactionId !== deleteTarget.id,
        ),
        attachments: current.attachments.filter(
          (item) => item.transactionId !== deleteTarget.id,
        ),
      }));
      setDeleteTarget(null);
      setNotice('Lançamento excluído.');
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Não foi possível excluir.',
      );
    }
  }

  async function saveBudget(categoryId: string, value: string) {
    const limitCents = parseMoney(value);
    if (!categoryId || limitCents <= 0) {
      setNotice('Escolha uma categoria e informe um limite válido.');
      return;
    }
    const existing = data.budgets.find(
      (item) => item.categoryId === categoryId && item.month === month,
    );
    const budget: Budget = {
      id: existing?.id ?? newId('budget'),
      month,
      categoryId,
      limitCents,
    };
    try {
      await postAction({ action: 'save-budget', ...budget });
      setData((current) => ({
        ...current,
        budgets: existing
          ? current.budgets.map((item) =>
              item.id === existing.id ? budget : item,
            )
          : [...current.budgets, budget],
      }));
      setBudgetOpen(false);
      setNotice(existing ? 'Orçamento atualizado.' : 'Orçamento criado.');
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Não foi possível salvar.',
      );
    }
  }

  async function saveGoal(goal: Goal) {
    try {
      await postAction({ action: 'save-goal', ...goal });
      setData((current) => ({
        ...current,
        goals: current.goals.some((item) => item.id === goal.id)
          ? current.goals.map((item) => (item.id === goal.id ? goal : item))
          : [...current.goals, goal],
      }));
      setGoalOpen(false);
      setNotice('Meta salva.');
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Não foi possível salvar.',
      );
    }
  }

  async function saveCategory(
    kind: Category['kind'],
    name: string,
    color: string,
  ) {
    if (!name.trim()) return;
    const category: Category = {
      id: newId('cat'),
      kind,
      name: name.trim(),
      color,
    };
    try {
      const result = (await postAction({
        action: 'save-category',
        ...category,
      })) as { id?: string };
      category.id = result?.id ?? category.id;
      setData((current) => ({
        ...current,
        categories: [...current.categories, category],
      }));
      setCategoryOpen(false);
      setNotice('Categoria criada.');
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar a categoria.',
      );
    }
  }

  async function readImport(file: File) {
    try {
      const source = await readTransactionImportFile(file);
      const preview = buildImportPreview(source, 0, data);
      setImportSource(source);
      setImportPreview(preview);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível ler o arquivo.',
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function selectImportSheet(sheetIndex: number) {
    if (!importSource) return;
    setImportPreview(buildImportPreview(importSource, sheetIndex, data));
  }

  async function confirmImport() {
    if (!importPreview?.rows.length) return;
    try {
      if (isLocalPreview) {
        setData((current) => ({
          ...current,
          transactions: [...importPreview.rows, ...current.transactions],
        }));
      } else {
        await postAction({
          action: 'import-transactions',
          sourceName: importPreview.sourceName,
          rows: importPreview.rows,
        });
        await refreshData();
      }
      setNotice(`${importPreview.rows.length} lançamento(s) importado(s).`);
      setImportPreview(null);
      setImportSource(null);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Não foi possível importar.',
      );
    }
  }

  async function changeCurrency(currency: CurrencyCode) {
    if (currency === data.currency) return;
    try {
      if (isLocalPreview) setSaving(true);
      await postAction({ action: 'set-currency', currency });
      if (isLocalPreview) {
        setData((current) => ({
          ...current,
          currency,
          accounts: current.accounts.map((account) => ({
            ...account,
            currency,
          })),
        }));
      } else {
        await refreshData();
      }
      setNotice(
        `Moeda-base alterada para ${currency}. Os valores não foram convertidos.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível alterar a moeda.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveCreditCard(card: Account) {
    try {
      if (isLocalPreview) {
        setSaving(true);
        setData((current) => ({
          ...current,
          accounts: current.accounts.some((item) => item.id === card.id)
            ? current.accounts.map((item) =>
                item.id === card.id ? card : item,
              )
            : [...current.accounts, card],
        }));
      } else {
        await postAction({ action: 'save-credit-card', ...card });
        await refreshData();
      }
      setNotice('Cartão salvo.');
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o cartão.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function closeCardStatement(statement: CardStatement) {
    try {
      if (isLocalPreview) {
        setSaving(true);
        if (statement.status !== 'open') {
          throw new Error('Somente faturas abertas podem ser fechadas.');
        }
        const closedTotalCents = data.transactions
          .filter(
            (item) =>
              item.cardStatementId === statement.id && item.kind !== 'transfer',
          )
          .reduce((sum, item) => sum + item.amountCents, 0);
        if (closedTotalCents <= 0) {
          throw new Error('Não há compras para fechar nesta fatura.');
        }
        setData((current) => ({
          ...current,
          cardStatements: current.cardStatements.map((item) =>
            item.id === statement.id
              ? { ...item, status: 'closed', closedTotalCents }
              : item,
          ),
        }));
      } else {
        await postAction({ action: 'close-card-statement', id: statement.id });
        await refreshData();
      }
      setNotice('Fatura fechada com o total calculado pelas compras.');
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível fechar a fatura.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function payCardStatement(
    statement: CardStatement,
    sourceAccountId: string,
  ) {
    try {
      if (isLocalPreview) {
        setSaving(true);
        const source = data.accounts.find(
          (item) => item.id === sourceAccountId,
        );
        const card = data.accounts.find(
          (item) => item.id === statement.cardAccountId,
        );
        const total = statement.closedTotalCents ?? 0;
        if (!source || source.type === 'credit') {
          throw new Error('Escolha uma conta bancária para pagar a fatura.');
        }
        if (statement.status !== 'closed' || total <= 0) {
          throw new Error('Feche a fatura antes de pagar.');
        }
        const payment: Transaction = {
          id: `statement-payment-${statement.id}`,
          kind: 'transfer',
          title: `Pagamento · ${card?.name ?? 'cartão'}`,
          amountCents: total,
          date: statement.dueDate,
          status: 'paid',
          categoryId: null,
          accountId: sourceAccountId,
          destinationAccountId: statement.cardAccountId,
          paymentMethodId: null,
          cardStatementId: statement.id,
        };
        setData((current) => ({
          ...current,
          transactions: current.transactions.some(
            (item) => item.id === payment.id,
          )
            ? current.transactions
            : [payment, ...current.transactions],
          cardStatements: current.cardStatements.map((item) =>
            item.id === statement.id ? { ...item, status: 'paid' } : item,
          ),
        }));
      } else {
        await postAction({
          action: 'pay-card-statement',
          id: statement.id,
          sourceAccountId,
        });
        await refreshData();
      }
      setNotice('Fatura paga como transferência, sem duplicar despesas.');
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível pagar a fatura.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleRecurrence(rule: RecurrenceRule) {
    const active = !rule.active;
    try {
      if (isLocalPreview) setSaving(true);
      await postAction({
        action: 'set-recurrence-active',
        id: rule.id,
        active,
      });
      if (isLocalPreview) {
        setData((current) => ({
          ...current,
          recurrenceRules: current.recurrenceRules.map((item) =>
            item.id === rule.id ? { ...item, active } : item,
          ),
        }));
      } else {
        await refreshData();
      }
      setNotice(active ? 'Recorrência reativada.' : 'Recorrência pausada.');
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar a recorrência.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function generateRecurrences(
    ruleId: string | null,
    throughDate: string,
  ) {
    try {
      if (!isLocalPreview) {
        const result = (await postAction({
          action: 'materialize-recurrences',
          ruleId,
          throughDate,
        })) as { generated?: number };
        await refreshData();
        setNotice(
          `${result.generated ?? 0} lançamento(s) recorrente(s) gerado(s).`,
        );
        return;
      }

      setSaving(true);
      let transactions = [...data.transactions];
      let cardStatements = [...data.cardStatements];
      let generated = 0;
      const nextRules = data.recurrenceRules.map((rule) => {
        if (!rule.active || (ruleId && rule.id !== ruleId)) return rule;
        const source = transactions.find(
          (item) => item.id === rule.sourceTransactionId,
        );
        if (!source) return { ...rule, active: false };

        let occurrenceDate = rule.nextDate;
        let iterations = 0;
        while (
          occurrenceDate <= throughDate &&
          (!rule.endDate || occurrenceDate <= rule.endDate) &&
          generated < 36 &&
          iterations < 36
        ) {
          const exists = transactions.some(
            (item) =>
              item.recurrenceId === rule.id &&
              item.recurrenceOccurrenceDate === occurrenceDate,
          );
          if (!exists) {
            let occurrence: Transaction = {
              ...source,
              id: newId('tx'),
              date: occurrenceDate,
              status: rule.occurrenceStatus,
              recurrenceId: rule.id,
              recurrenceOccurrenceDate: occurrenceDate,
              cardStatementId: null,
            };
            const assignment = assignLocalCardStatement(
              { ...data, transactions, cardStatements },
              occurrence,
            );
            occurrence = assignment.transaction;
            if (
              assignment.statement &&
              !cardStatements.some(
                (item) => item.id === assignment.statement?.id,
              )
            ) {
              cardStatements = [assignment.statement, ...cardStatements];
            }
            transactions = [occurrence, ...transactions];
            generated += 1;
          }
          occurrenceDate = advanceRecurrenceDate(
            occurrenceDate,
            rule.frequency,
            rule.interval,
            rule.anchorDate,
          );
          iterations += 1;
        }
        return {
          ...rule,
          nextDate: occurrenceDate,
          active:
            rule.endDate && occurrenceDate > rule.endDate ? false : rule.active,
        };
      });
      setData((current) => ({
        ...current,
        transactions,
        cardStatements,
        recurrenceRules: nextRules,
      }));
      setNotice(`${generated} lançamento(s) recorrente(s) gerado(s).`);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível gerar as recorrências.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function downloadAttachment(attachment: Attachment) {
    try {
      if (isLocalPreview) {
        const record = await getLocalAttachment(attachment.id);
        if (!record) throw new Error('O arquivo local não foi encontrado.');
        downloadBlob(record.blob, record.fileName);
        return;
      }
      const response = await fetch(
        `/api/attachments?id=${encodeURIComponent(attachment.id)}`,
        { cache: 'no-store' },
      );
      if (!response.ok)
        throw new Error('Não foi possível baixar o comprovante.');
      downloadBlob(await response.blob(), attachment.fileName);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível baixar o comprovante.',
      );
    }
  }

  async function removeAttachment(attachment: Attachment) {
    const confirmed = window.confirm(
      `Excluir o comprovante “${attachment.fileName}”?`,
    );
    if (!confirmed) return;
    try {
      if (isLocalPreview) {
        await deleteLocalAttachment(attachment.id);
      } else {
        const response = await fetch(
          `/api/attachments?id=${encodeURIComponent(attachment.id)}`,
          { method: 'DELETE' },
        );
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? 'Não foi possível excluir.');
        }
      }
      setData((current) => ({
        ...current,
        attachments: current.attachments.filter(
          (item) => item.id !== attachment.id,
        ),
      }));
      setNotice('Comprovante excluído.');
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível excluir o comprovante.',
      );
    }
  }

  const copy = viewCopy[activeView];
  const firstName = displayName.split(' ')[0] || 'Olá';

  return (
    <CurrencyContext.Provider value={data.currency}>
      <div className="min-h-screen overflow-x-hidden bg-[#f3f7f5] text-[#102c2a]">
        <a
          href="#conteudo-principal"
          className="sr-only z-[100] rounded-md bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Pular para o conteúdo
        </a>

        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col bg-[#071817] px-4 py-5 text-white lg:flex">
          <Brand />
          <nav className="mt-10 space-y-1" aria-label="Navegação principal">
            {navItems.map((item) => (
              <NavLink
                key={item.view}
                item={item}
                active={activeView === item.view}
              />
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.055] p-4">
            <div className="mb-3 flex items-center gap-2 text-teal-200">
              <ShieldCheck className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.12em]">
                Privado por padrão
              </span>
            </div>
            <p className="text-xs leading-5 text-white/55">
              Seus registros ficam associados à sua identidade e nunca são
              misturados com os de outro usuário.
            </p>
          </div>
          <a
            href={chatGPTSignOutPath('/')}
            className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/55 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
            Sair
          </a>
        </aside>

        <div className="lg:pl-[252px]">
          <header className="sticky top-0 z-30 border-b border-[#dfe9e5] bg-[#f3f7f5]/92 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
              <div className="flex items-center gap-3 lg:hidden">
                <Button
                  variant="outline"
                  size="icon"
                  className="border-[#d5e3de] bg-white"
                  aria-label="Abrir menu"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu />
                </Button>
                <Brand compact />
              </div>
              <div className="hidden min-w-0 lg:block">
                <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#548078]">
                  {copy.eyebrow}
                </p>
              </div>
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {isLocalPreview && (
                  <Badge className="hidden gap-1 border border-teal-200 bg-teal-50 text-[#087667] sm:inline-flex">
                    <MonitorCog className="size-3.5" />
                    Ambiente local
                  </Badge>
                )}
                {activeView !== 'settings' && (
                  <MonthPicker month={month} onChange={setMonth} />
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden border-[#d5e3de] bg-white sm:inline-flex"
                  aria-label="Notificações"
                >
                  <Bell />
                </Button>
                <div
                  className="hidden size-10 items-center justify-center rounded-full bg-[#d8f7ed] text-sm font-bold text-[#0c6d61] sm:flex"
                  title={displayName}
                >
                  {firstName.slice(0, 2).toUpperCase()}
                </div>
              </div>
            </div>
          </header>

          <main
            id="conteudo-principal"
            className="mx-auto max-w-[1500px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-12 lg:pt-9"
          >
            <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#0c8b7a]">
                    Olá, {firstName}
                  </p>
                  {isLocalPreview && (
                    <Badge className="gap-1 border border-teal-200 bg-teal-50 text-[#087667] sm:hidden">
                      <MonitorCog className="size-3.5" /> Ambiente local
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl font-semibold tracking-[-0.045em] text-[#0a2523] sm:text-4xl">
                  {copy.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#607772] sm:text-base">
                  {copy.description}
                </p>
              </div>
              {(activeView === 'dashboard' ||
                activeView === 'transactions') && (
                <Button
                  onClick={() => openNewTransaction()}
                  className="h-11 rounded-xl bg-[#0b7f71] px-5 font-semibold text-white shadow-[0_10px_30px_rgba(11,127,113,.2)] hover:bg-[#096b60]"
                >
                  <Plus />
                  Novo lançamento
                </Button>
              )}
            </div>

            {loading ? (
              <LoadingState />
            ) : (
              <>
                {activeView === 'dashboard' && (
                  <DashboardView
                    data={data}
                    month={month}
                    onNew={openNewTransaction}
                  />
                )}
                {activeView === 'transactions' && (
                  <TransactionsView
                    data={data}
                    month={month}
                    onEdit={openEditTransaction}
                    onDelete={setDeleteTarget}
                    onToggle={toggleStatus}
                    onExport={() => exportCsv(data)}
                    onImport={() => fileInputRef.current?.click()}
                  />
                )}
                {activeView === 'planning' && (
                  <PlanningView
                    data={data}
                    month={month}
                    saving={saving}
                    onSaveCard={saveCreditCard}
                    onCloseStatement={closeCardStatement}
                    onPayStatement={payCardStatement}
                    onToggleRecurrence={toggleRecurrence}
                    onGenerateRecurrences={generateRecurrences}
                  />
                )}
                {activeView === 'budgets' && (
                  <BudgetsView
                    data={data}
                    month={month}
                    onNew={() => setBudgetOpen(true)}
                  />
                )}
                {activeView === 'goals' && (
                  <GoalsView
                    data={data}
                    onNew={() => setGoalOpen(true)}
                    onSave={saveGoal}
                  />
                )}
                {activeView === 'reports' && (
                  <ReportsView data={data} month={month} />
                )}
                {activeView === 'settings' && (
                  <SettingsView
                    data={data}
                    saving={saving}
                    onNewCategory={() => setCategoryOpen(true)}
                    onExport={() => exportCsv(data)}
                    onImport={() => fileInputRef.current?.click()}
                    onCurrencyChange={changeCurrency}
                  />
                )}
              </>
            )}
          </main>
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="absolute inset-0 bg-[#071817]/50 backdrop-blur-sm"
              aria-label="Fechar menu"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative flex h-full w-[min(86vw,330px)] flex-col bg-[#071817] p-5 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <Brand />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Fechar menu"
                  onClick={() => setMobileOpen(false)}
                >
                  <X />
                </Button>
              </div>
              <nav className="mt-9 space-y-1" aria-label="Navegação móvel">
                {navItems.map((item) => (
                  <NavLink
                    key={item.view}
                    item={item}
                    active={activeView === item.view}
                  />
                ))}
              </nav>
            </aside>
          </div>
        )}

        <nav
          className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-white/70 bg-[#071817]/95 p-1.5 text-white shadow-2xl backdrop-blur-xl lg:hidden"
          aria-label="Atalhos"
        >
          {navItems
            .filter((item) =>
              ['dashboard', 'transactions', 'planning', 'budgets'].includes(
                item.view,
              ),
            )
            .map((item) => {
              const Icon = item.icon;
              const active = activeView === item.view;
              return (
                <Link
                  key={item.view}
                  href={item.href}
                  className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] transition ${active ? 'bg-teal-300 text-[#071817]' : 'text-white/55 hover:text-white'}`}
                >
                  <Icon className="size-4" />
                  {mobileNavLabels[item.view] ?? item.label.split(' ')[0]}
                </Link>
              );
            })}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] transition ${['goals', 'reports', 'settings'].includes(activeView) ? 'bg-teal-300 text-[#071817]' : 'text-white/55 hover:text-white'}`}
          >
            <MoreHorizontal className="size-4" />
            Mais
          </button>
        </nav>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          aria-label="Selecionar arquivo CSV ou XLSX"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readImport(file);
          }}
        />

        <TransactionDialog
          open={transactionOpen}
          onOpenChange={setTransactionOpen}
          draft={transactionDraft}
          setDraft={setTransactionDraft}
          data={data}
          saving={saving}
          onSubmit={saveTransaction}
          pendingFiles={pendingFiles}
          onPendingFilesChange={setPendingFiles}
          existingAttachments={data.attachments.filter(
            (item) => item.transactionId === transactionDraft.id,
          )}
          onDownloadAttachment={downloadAttachment}
          onDeleteAttachment={removeAttachment}
          onAttachmentError={setNotice}
        />
        <BudgetDialog
          open={budgetOpen}
          onOpenChange={setBudgetOpen}
          data={data}
          month={month}
          saving={saving}
          onSave={saveBudget}
        />
        <GoalDialog
          open={goalOpen}
          onOpenChange={setGoalOpen}
          saving={saving}
          onSave={saveGoal}
        />
        <CategoryDialog
          open={categoryOpen}
          onOpenChange={setCategoryOpen}
          saving={saving}
          onSave={saveCategory}
        />
        <ImportDialog
          preview={importPreview}
          onClose={() => {
            setImportPreview(null);
            setImportSource(null);
          }}
          onConfirm={confirmImport}
          onSelectSheet={selectImportSheet}
          saving={saving}
        />

        <AlertDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir este lançamento?</AlertDialogTitle>
              <AlertDialogDescription>
                “{deleteTarget?.title}” será removido do histórico e dos
                relatórios. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => void deleteTransaction()}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {notice && (
          <output
            className="fixed bottom-24 right-4 z-[70] max-w-sm rounded-xl bg-[#0a2523] px-4 py-3 text-sm font-medium text-white shadow-2xl lg:bottom-6"
            aria-live="polite"
          >
            {notice}
          </output>
        )}
      </div>
    </CurrencyContext.Provider>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {!compact && (
        <div>
          <p className="text-lg font-semibold tracking-[-0.04em]">NexoCasa</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-200/60">
            Finanças em sintonia
          </p>
        </div>
      )}
    </div>
  );
}

function NavLink({
  item,
  active,
}: {
  item: (typeof navItems)[number];
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
        active
          ? 'bg-teal-300 text-[#071817]'
          : 'text-white/55 hover:bg-white/8 hover:text-white'
      }`}
    >
      <Icon className="size-[18px]" />
      {item.label}
    </Link>
  );
}

function MonthPicker({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <div className="flex items-center rounded-xl border border-[#d5e3de] bg-white p-1 shadow-sm">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Mês anterior"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft />
      </Button>
      <div className="flex min-w-[126px] items-center justify-center gap-2 px-1 text-sm font-semibold capitalize sm:min-w-[158px]">
        <CalendarDays className="hidden size-4 text-[#0c8b7a] sm:block" />
        {monthLabel(month)}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Próximo mês"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Carregando dados"
    >
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-36 animate-pulse rounded-2xl bg-white" />
      ))}
    </div>
  );
}

function DashboardView({
  data,
  month,
  onNew,
}: {
  data: FinanceData;
  month: string;
  onNew: (kind?: TransactionKind) => void;
}) {
  const formatMoney = useMoneyFormatter();
  const monthRows = data.transactions.filter((item) =>
    item.date.startsWith(month),
  );
  const realized = monthRows.filter((item) => item.status === 'paid');
  const sum = (rows: Transaction[], kind: TransactionKind) =>
    rows
      .filter((item) => item.kind === kind)
      .reduce((total, item) => total + item.amountCents, 0);
  const income = sum(realized, 'income');
  const expenses = sum(realized, 'expense');
  const invested = sum(realized, 'investment');
  const actualBalance = income - expenses - invested;
  const expectedIncome = sum(monthRows, 'income');
  const expectedOut = sum(monthRows, 'expense') + sum(monthRows, 'investment');
  const expectedBalance = expectedIncome - expectedOut;
  const receivable = sum(
    monthRows.filter((item) => item.status === 'pending'),
    'income',
  );
  const payable =
    sum(
      monthRows.filter((item) => item.status === 'pending'),
      'expense',
    ) +
    sum(
      monthRows.filter((item) => item.status === 'pending'),
      'investment',
    );
  const savingsRate = income ? Math.round((invested / income) * 100) : 0;
  const previousBalance = (() => {
    const previousRows = data.transactions.filter(
      (item) =>
        item.date.startsWith(shiftMonth(month, -1)) && item.status === 'paid',
    );
    return (
      sum(previousRows, 'income') -
      sum(previousRows, 'expense') -
      sum(previousRows, 'investment')
    );
  })();
  const balanceDelta = previousBalance
    ? Math.round(
        ((actualBalance - previousBalance) / Math.abs(previousBalance)) * 100,
      )
    : 0;

  const trend = Array.from({ length: 6 }, (_, index) => {
    const key = shiftMonth(month, index - 5);
    const rows = data.transactions.filter(
      (item) => item.date.startsWith(key) && item.status === 'paid',
    );
    return {
      month: shortMonth(key).slice(0, 3),
      entradas: sum(rows, 'income') / 100,
      saidas: (sum(rows, 'expense') + sum(rows, 'investment')) / 100,
    };
  });

  const categoryBreakdown = data.categories
    .map((category) => ({
      name: category.name,
      value: realized
        .filter(
          (item) => item.categoryId === category.id && item.kind !== 'income',
        )
        .reduce((total, item) => total + item.amountCents, 0),
      color: category.color,
      fill: category.color,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const pending = monthRows
    .filter((item) => item.status === 'pending')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const budgets = data.budgets.filter((item) => item.month === month);
  const budgetHealth = budgets.map((budget) => {
    const spent = realized
      .filter(
        (item) =>
          item.categoryId === budget.categoryId && item.kind === 'expense',
      )
      .reduce((total, item) => total + item.amountCents, 0);
    return {
      ...budget,
      spent,
      percent: Math.round((spent / budget.limitCents) * 100),
    };
  });
  const alertBudget = [...budgetHealth].sort(
    (a, b) => b.percent - a.percent,
  )[0];

  return (
    <div className="space-y-5">
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Resumo financeiro"
      >
        <MetricCard
          label="Saldo realizado"
          value={formatMoney(actualBalance)}
          hint={`${balanceDelta >= 0 ? '+' : ''}${balanceDelta}% vs. mês anterior`}
          icon={TrendingUp}
          tone="teal"
        />
        <MetricCard
          label="Entradas realizadas"
          value={formatMoney(income)}
          hint={`${formatMoney(receivable)} a receber`}
          icon={ArrowDownLeft}
          tone="green"
        />
        <MetricCard
          label="Saídas realizadas"
          value={formatMoney(expenses)}
          hint={`${formatMoney(payable)} a pagar`}
          icon={ArrowUpRight}
          tone="rose"
        />
        <MetricCard
          label="Investido"
          value={formatMoney(invested)}
          hint={`${savingsRate}% da renda realizada`}
          icon={PiggyBank}
          tone="amber"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,.75fr)]">
        <Card className="rounded-[1.6rem] border-0 bg-[#0a2523] py-0 text-white shadow-[0_24px_60px_rgba(7,24,23,.13)] ring-0">
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-white">
              <Sparkles className="size-4 text-teal-300" />
              Pulso dos últimos 6 meses
            </CardTitle>
            <CardDescription className="text-white/50">
              Entradas e saídas realizadas, sem contar transferências.
            </CardDescription>
            <CardAction>
              <Badge className="border-0 bg-white/10 text-teal-100">
                Previsto {formatMoney(expectedBalance)}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="px-1 pb-2 sm:px-3">
            <div className="h-[290px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart
                  data={trend}
                  margin={{ top: 22, right: 20, left: 4, bottom: 4 }}
                >
                  <defs>
                    <linearGradient
                      id="incomeGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#2dd4bf"
                        stopOpacity={0.45}
                      />
                      <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="expenseGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#fb7185" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="rgba(255,255,255,.08)"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,.45)', fontSize: 12 }}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      border: 0,
                      borderRadius: 14,
                      background: '#f7fffc',
                      color: '#0a2523',
                    }}
                    formatter={(value) => formatMoney(Number(value) * 100)}
                  />
                  <Area
                    type="monotone"
                    dataKey="entradas"
                    name="Entradas"
                    stroke="#2dd4bf"
                    strokeWidth={2.5}
                    fill="url(#incomeGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="saidas"
                    name="Saídas"
                    stroke="#fb7185"
                    strokeWidth={2.5}
                    fill="url(#expenseGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.6rem] border-0 bg-white shadow-sm ring-1 ring-[#dfe9e5]">
          <CardHeader>
            <CardTitle>Destino das saídas</CardTitle>
            <CardDescription>Distribuição realizada no mês</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length ? (
              <>
                <div className="h-[190px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={82}
                        paddingAngle={3}
                        stroke="none"
                      />
                      <Tooltip
                        formatter={(value) => formatMoney(Number(value))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {categoryBreakdown.slice(0, 4).map((entry) => (
                    <div
                      key={entry.name}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-[#627a75]">
                        <i
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: entry.color }}
                        />{' '}
                        <span className="truncate">{entry.name}</span>
                      </span>
                      <strong className="font-semibold">
                        {formatMoney(entry.value)}
                      </strong>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyMini text="Adicione uma despesa realizada para ver a distribuição." />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="rounded-[1.5rem] border-0 bg-white shadow-sm ring-1 ring-[#dfe9e5] lg:col-span-2">
          <CardHeader>
            <CardTitle>Próximos compromissos</CardTitle>
            <CardDescription>
              Contas a pagar e valores a receber neste mês
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/transactions" />}
              >
                Ver todos
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {pending.length ? (
              <div className="divide-y divide-[#e7efec]">
                {pending.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: `${kindColors[item.kind]}20`,
                        color: kindColors[item.kind],
                      }}
                    >
                      {item.kind === 'income' ? (
                        <ArrowDownLeft className="size-4" />
                      ) : (
                        <ArrowUpRight className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{item.title}</p>
                      <p className="text-xs text-[#718681]">
                        {formatDate(item.date)} · {kindLabels[item.kind]}
                      </p>
                    </div>
                    <strong
                      className={
                        item.kind === 'income'
                          ? 'text-[#087f70]'
                          : 'text-[#b54b60]'
                      }
                    >
                      {item.kind === 'income' ? '+' : '-'}
                      {formatMoney(item.amountCents)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyMini text="Nenhum compromisso pendente neste mês." />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border-0 bg-[#fff7df] shadow-sm ring-1 ring-[#f0dfaa]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletCards className="size-4 text-amber-600" /> Orçamento em
              foco
            </CardTitle>
            <CardDescription>
              {alertBudget
                ? 'Categoria mais próxima do limite'
                : 'Crie limites para orientar decisões'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alertBudget ? (
              <div>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {
                        data.categories.find(
                          (item) => item.id === alertBudget.categoryId,
                        )?.name
                      }
                    </p>
                    <p className="text-xs text-[#7c7357]">
                      {formatMoney(alertBudget.spent)} de{' '}
                      {formatMoney(alertBudget.limitCents)}
                    </p>
                  </div>
                  <span
                    className={`text-2xl font-semibold ${alertBudget.percent > 100 ? 'text-rose-600' : 'text-amber-700'}`}
                  >
                    {alertBudget.percent}%
                  </span>
                </div>
                <Progress
                  value={Math.min(alertBudget.percent, 100)}
                  className="[&_[data-slot=progress-indicator]]:bg-amber-500 [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-amber-100"
                />
                <Link
                  href="/budgets"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-800 hover:underline"
                >
                  Revisar orçamentos <ChevronRight className="size-4" />
                </Link>
              </div>
            ) : (
              <Link
                href="/budgets"
                className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 hover:underline"
              >
                Criar primeiro orçamento <ChevronRight className="size-4" />
              </Link>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ['Entrada', 'income', ArrowDownLeft],
            ['Despesa', 'expense', ArrowUpRight],
            ['Investimento', 'investment', PiggyBank],
            ['Transferência', 'transfer', ArrowLeftRight],
          ] as const
        ).map(([label, kind, Icon]) => (
          <button
            key={kind}
            onClick={() => onNew(kind)}
            className="flex items-center gap-3 rounded-2xl border border-[#dfe9e5] bg-white p-3 text-left text-sm font-semibold transition hover:-translate-y-0.5 hover:border-[#9bcfc6] hover:shadow-md"
          >
            <span
              className="flex size-9 items-center justify-center rounded-xl"
              style={{
                background: `${kindColors[kind]}1f`,
                color: kindColors[kind],
              }}
            >
              <Icon className="size-4" />
            </span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof TrendingUp;
  tone: 'teal' | 'green' | 'rose' | 'amber';
}) {
  const tones = {
    teal: 'bg-[#d9f5ee] text-[#087f70]',
    green: 'bg-[#e4f7df] text-[#4a8b34]',
    rose: 'bg-[#ffeaee] text-[#bd5266]',
    amber: 'bg-[#fff1cc] text-[#ae7210]',
  };
  return (
    <Card className="rounded-[1.4rem] border-0 bg-white shadow-sm ring-1 ring-[#dfe9e5]">
      <CardHeader>
        <div
          className={`mb-3 flex size-10 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon className="size-[18px]" />
        </div>
        <CardDescription className="font-medium">{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tracking-[-0.04em]">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-[#718681]">{hint}</p>
      </CardContent>
    </Card>
  );
}

function TransactionsView({
  data,
  month,
  onEdit,
  onDelete,
  onToggle,
  onExport,
  onImport,
}: {
  data: FinanceData;
  month: string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onToggle: (transaction: Transaction) => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'all' | TransactionKind>('all');
  const [status, setStatus] = useState<'all' | TransactionStatus>('all');
  const rows = data.transactions
    .filter((item) => item.date.startsWith(month))
    .filter((item) => kind === 'all' || item.kind === kind)
    .filter((item) => status === 'all' || item.status === status)
    .filter((item) => normalizeText(item.title).includes(normalizeText(search)))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Card className="rounded-[1.6rem] border-0 bg-white shadow-sm ring-1 ring-[#dfe9e5]">
      <CardHeader className="gap-4 border-b border-[#e6eeeb] pb-5">
        <div>
          <CardTitle>Movimentações de {monthLabel(month)}</CardTitle>
          <CardDescription>
            {rows.length} resultado(s) com os filtros atuais
          </CardDescription>
        </div>
        <CardAction className="col-span-full col-start-1 row-start-3 grid w-full grid-cols-2 gap-2 justify-self-stretch sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:flex sm:w-auto sm:justify-self-end">
          <Button variant="outline" size="sm" onClick={onImport}>
            <Upload /> Importar CSV/XLSX
          </Button>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download /> Exportar
          </Button>
        </CardAction>
        <div className="col-span-full grid gap-2 sm:grid-cols-[minmax(220px,1fr)_170px_160px]">
          <label className="relative" htmlFor="transaction-search">
            <span className="sr-only">Buscar lançamentos</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#718681]" />
            <Input
              id="transaction-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por descrição"
              className="h-10 rounded-xl border-[#d5e3de] pl-9"
            />
          </label>
          <label>
            <span className="sr-only">Filtrar por grupo</span>
            <select
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as 'all' | TransactionKind)
              }
              className="h-10 w-full rounded-xl border border-[#d5e3de] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2dd4bf]"
            >
              <option value="all">Todos os grupos</option>
              {Object.entries(kindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrar por status</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as 'all' | TransactionStatus)
              }
              className="h-10 w-full rounded-xl border border-[#d5e3de] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2dd4bf]"
            >
              <option value="all">Todos os status</option>
              <option value="paid">Realizado</option>
              <option value="pending">Pendente</option>
            </select>
          </label>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f8fbfa] text-xs uppercase tracking-[0.1em] text-[#718681]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Descrição</th>
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 font-semibold">Categoria</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Valor
                    </th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8efed]">
                  {rows.map((item) => (
                    <TransactionRow
                      key={item.id}
                      item={item}
                      data={data}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onToggle={onToggle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-[#e8efed] md:hidden">
              {rows.map((item) => (
                <TransactionMobileRow
                  key={item.id}
                  item={item}
                  data={data}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="px-5 py-16 text-center">
            <ReceiptText className="mx-auto mb-3 size-8 text-[#9ab0ab]" />
            <p className="font-semibold">Nenhum lançamento encontrado</p>
            <p className="mt-1 text-sm text-[#718681]">
              Ajuste os filtros ou adicione uma nova movimentação.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TransactionRow({
  item,
  data,
  onEdit,
  onDelete,
  onToggle,
}: {
  item: Transaction;
  data: FinanceData;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onToggle: (transaction: Transaction) => void;
}) {
  const formatMoney = useMoneyFormatter();
  const category = data.categories.find(
    (entry) => entry.id === item.categoryId,
  );
  return (
    <tr className="group transition hover:bg-[#f8fbfa]">
      <td className="px-5 py-4" aria-label={`Descrição: ${item.title}`}>
        <div className="flex items-center gap-3">
          <span
            className="flex size-9 items-center justify-center rounded-xl"
            style={{
              background: `${kindColors[item.kind]}1f`,
              color: kindColors[item.kind],
            }}
          >
            {item.kind === 'income' ? (
              <ArrowDownLeft className="size-4" />
            ) : item.kind === 'transfer' ? (
              <ArrowLeftRight className="size-4" />
            ) : item.kind === 'investment' ? (
              <PiggyBank className="size-4" />
            ) : (
              <ArrowUpRight className="size-4" />
            )}
          </span>
          <div>
            <p className="font-semibold text-[#183b38]">{item.title}</p>
            <p className="text-xs text-[#7c918d]">{kindLabels[item.kind]}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-[#59736e]">{formatDate(item.date)}</td>
      <td className="px-4 py-4">
        <span className="inline-flex items-center gap-2 text-[#59736e]">
          <i
            className="size-2 rounded-full"
            style={{ background: category?.color ?? '#a3b3af' }}
          />
          {category?.name ??
            (item.kind === 'transfer' ? 'Entre contas' : 'Sem categoria')}
        </span>
      </td>
      <td className="px-4 py-4">
        <button
          onClick={() => onToggle(item)}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'paid' ? 'bg-[#dcf7ef] text-[#087f70]' : 'bg-[#fff2cc] text-[#946612]'}`}
          aria-label={`Alterar status de ${item.title}`}
        >
          {item.status === 'paid' ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <CircleDashed className="size-3.5" />
          )}
          {item.status === 'paid' ? 'Realizado' : 'Pendente'}
        </button>
      </td>
      <td
        className={`px-4 py-4 text-right font-semibold ${item.kind === 'income' ? 'text-[#087f70]' : item.kind === 'transfer' ? 'text-[#6d5fc4]' : 'text-[#a94659]'}`}
      >
        {item.kind === 'income' ? '+' : item.kind === 'transfer' ? '' : '-'}
        {formatMoney(item.amountCents)}
      </td>
      <td className="px-4 py-4">
        <div className="flex justify-end gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${item.title}`}
            onClick={() => onEdit(item)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Excluir ${item.title}`}
            className="text-rose-600"
            onClick={() => onDelete(item)}
          >
            <Trash2 />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function TransactionMobileRow({
  item,
  data,
  onEdit,
  onDelete,
  onToggle,
}: {
  item: Transaction;
  data: FinanceData;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onToggle: (transaction: Transaction) => void;
}) {
  const formatMoney = useMoneyFormatter();
  const category = data.categories.find(
    (entry) => entry.id === item.categoryId,
  );
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: `${kindColors[item.kind]}1f`,
            color: kindColors[item.kind],
          }}
        >
          {item.kind === 'income' ? (
            <ArrowDownLeft className="size-4" />
          ) : item.kind === 'transfer' ? (
            <ArrowLeftRight className="size-4" />
          ) : (
            <ArrowUpRight className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="mt-0.5 text-xs text-[#718681]">
                {formatDate(item.date)} ·{' '}
                {category?.name ?? kindLabels[item.kind]}
              </p>
            </div>
            <strong
              className={
                item.kind === 'income'
                  ? 'text-[#087f70]'
                  : item.kind === 'transfer'
                    ? 'text-[#6d5fc4]'
                    : 'text-[#a94659]'
              }
            >
              {item.kind === 'income'
                ? '+'
                : item.kind === 'transfer'
                  ? ''
                  : '-'}
              {formatMoney(item.amountCents)}
            </strong>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => onToggle(item)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'paid' ? 'bg-[#dcf7ef] text-[#087f70]' : 'bg-[#fff2cc] text-[#946612]'}`}
            >
              {item.status === 'paid' ? 'Realizado' : 'Pendente'}
            </button>
            <div className="flex">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Editar ${item.title}`}
                onClick={() => onEdit(item)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Excluir ${item.title}`}
                className="text-rose-600"
                onClick={() => onDelete(item)}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BudgetsView({
  data,
  month,
  onNew,
}: {
  data: FinanceData;
  month: string;
  onNew: () => void;
}) {
  const formatMoney = useMoneyFormatter();
  const budgets = data.budgets.filter((item) => item.month === month);
  const spentFor = (categoryId: string) =>
    data.transactions
      .filter(
        (item) =>
          item.date.startsWith(month) &&
          item.status === 'paid' &&
          item.kind === 'expense' &&
          item.categoryId === categoryId,
      )
      .reduce((sum, item) => sum + item.amountCents, 0);
  const totalLimit = budgets.reduce((sum, item) => sum + item.limitCents, 0);
  const totalSpent = budgets.reduce(
    (sum, item) => sum + spentFor(item.categoryId),
    0,
  );
  return (
    <div className="space-y-5">
      <Card className="rounded-[1.6rem] border-0 bg-[#0a2523] text-white shadow-xl ring-0">
        <CardContent className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-300">
              Visão consolidada
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
              {formatMoney(Math.max(totalLimit - totalSpent, 0))}
            </p>
            <p className="mt-1 text-sm text-white/50">
              ainda disponíveis nos limites de {monthLabel(month)}
            </p>
          </div>
          <div className="flex gap-7">
            <div>
              <p className="text-xs text-white/45">Planejado</p>
              <p className="mt-1 font-semibold">{formatMoney(totalLimit)}</p>
            </div>
            <div>
              <p className="text-xs text-white/45">Consumido</p>
              <p className="mt-1 font-semibold">{formatMoney(totalSpent)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Limites por categoria</h2>
          <p className="text-sm text-[#718681]">
            O alerta muda de cor antes de estourar.
          </p>
        </div>
        <Button
          onClick={onNew}
          className="rounded-xl bg-[#0b7f71] text-white hover:bg-[#096b60]"
        >
          <Plus /> Novo limite
        </Button>
      </div>
      {budgets.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {budgets.map((budget) => {
            const spent = spentFor(budget.categoryId);
            const percent = Math.round((spent / budget.limitCents) * 100);
            const category = data.categories.find(
              (item) => item.id === budget.categoryId,
            );
            return (
              <Card
                key={budget.id}
                className="rounded-[1.4rem] border-0 bg-white shadow-sm ring-1 ring-[#dfe9e5]"
              >
                <CardHeader>
                  <div
                    className="mb-3 flex size-10 items-center justify-center rounded-xl"
                    style={{
                      background: `${category?.color ?? '#14b8a6'}1f`,
                      color: category?.color,
                    }}
                  >
                    <WalletCards className="size-4" />
                  </div>
                  <CardTitle>{category?.name ?? 'Categoria'}</CardTitle>
                  <CardDescription>
                    {formatMoney(spent)} de {formatMoney(budget.limitCents)}
                  </CardDescription>
                  <CardAction>
                    <Badge
                      className={`border-0 ${percent > 100 ? 'bg-rose-100 text-rose-700' : percent >= 80 ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}
                    >
                      {percent}%
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <Progress
                    value={Math.min(percent, 100)}
                    className={`[&_[data-slot=progress-track]]:h-2 ${percent > 100 ? '[&_[data-slot=progress-indicator]]:bg-rose-500' : percent >= 80 ? '[&_[data-slot=progress-indicator]]:bg-amber-500' : '[&_[data-slot=progress-indicator]]:bg-teal-500'}`}
                  />
                  <div className="mt-3 flex justify-between text-xs text-[#718681]">
                    <span>
                      {percent > 100
                        ? `${formatMoney(spent - budget.limitCents)} acima`
                        : `${formatMoney(budget.limitCents - spent)} restantes`}
                    </span>
                    <span>{Math.max(0, 100 - percent)}% livre</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyPanel
          icon={WalletCards}
          title="Nenhum orçamento neste mês"
          description="Defina limites por categoria para transformar o planejamento em alertas úteis."
          action="Criar orçamento"
          onAction={onNew}
        />
      )}
    </div>
  );
}

function GoalsView({
  data,
  onNew,
  onSave,
}: {
  data: FinanceData;
  onNew: () => void;
  onSave: (goal: Goal) => Promise<void>;
}) {
  const formatMoney = useMoneyFormatter();
  const totalTarget = data.goals.reduce(
    (sum, item) => sum + item.targetCents,
    0,
  );
  const totalCurrent = data.goals.reduce(
    (sum, item) => sum + item.currentCents,
    0,
  );
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Objetivos em andamento</h2>
          <p className="text-sm text-[#718681]">
            {formatMoney(totalCurrent)} de {formatMoney(totalTarget)} acumulados
          </p>
        </div>
        <Button
          onClick={onNew}
          className="rounded-xl bg-[#0b7f71] text-white hover:bg-[#096b60]"
        >
          <Plus /> Nova meta
        </Button>
      </div>
      {data.goals.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.goals.map((goal) => {
            const percent = goal.targetCents
              ? Math.min(
                  100,
                  Math.round((goal.currentCents / goal.targetCents) * 100),
                )
              : 0;
            return (
              <Card
                key={goal.id}
                className="rounded-[1.5rem] border-0 bg-white shadow-sm ring-1 ring-[#dfe9e5]"
              >
                <CardHeader>
                  <div
                    className="mb-4 flex size-12 items-center justify-center rounded-2xl"
                    style={{ background: `${goal.color}20`, color: goal.color }}
                  >
                    <Target className="size-5" />
                  </div>
                  <CardTitle className="text-lg">{goal.name}</CardTitle>
                  <CardDescription>
                    {goal.dueDate
                      ? `Até ${new Intl.DateTimeFormat('pt-BR').format(new Date(`${goal.dueDate}T12:00:00`))}`
                      : 'Sem prazo definido'}
                  </CardDescription>
                  <CardAction>
                    <span
                      className="text-2xl font-semibold"
                      style={{ color: goal.color }}
                    >
                      {percent}%
                    </span>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <Progress
                    value={percent}
                    className="[&_[data-slot=progress-track]]:h-2.5"
                    style={{ '--primary': goal.color } as React.CSSProperties}
                  />
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-[#718681]">Acumulado</p>
                      <p className="mt-1 font-semibold">
                        {formatMoney(goal.currentCents)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#718681]">Faltam</p>
                      <p className="mt-1 font-semibold">
                        {formatMoney(
                          Math.max(0, goal.targetCents - goal.currentCents),
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-5 w-full"
                    onClick={() =>
                      void onSave({
                        ...goal,
                        currentCents: Math.min(
                          goal.targetCents,
                          goal.currentCents +
                            Math.max(1000, Math.round(goal.targetCents * 0.05)),
                        ),
                      })
                    }
                  >
                    <Plus /> Registrar avanço
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyPanel
          icon={Target}
          title="Transforme planos em metas"
          description="Defina o valor, o prazo e acompanhe cada avanço sem perder a motivação."
          action="Criar primeira meta"
          onAction={onNew}
        />
      )}
    </div>
  );
}

function ReportsView({ data, month }: { data: FinanceData; month: string }) {
  const formatMoney = useMoneyFormatter();
  const year = Number(month.slice(0, 4));
  const months = Array.from(
    { length: 12 },
    (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`,
  );
  const sum = (rows: Transaction[], kind: TransactionKind) =>
    rows
      .filter((item) => item.kind === kind && item.status === 'paid')
      .reduce((total, item) => total + item.amountCents, 0);
  const annual = months.map((key) => {
    const rows = data.transactions.filter((item) => item.date.startsWith(key));
    const income = sum(rows, 'income');
    const expense = sum(rows, 'expense');
    const investment = sum(rows, 'investment');
    return {
      key,
      month: shortMonth(key).slice(0, 3),
      entradas: income / 100,
      despesas: expense / 100,
      investimentos: investment / 100,
      saldo: (income - expense - investment) / 100,
    };
  });
  const yearRows = data.transactions.filter(
    (item) => item.date.startsWith(String(year)) && item.status === 'paid',
  );
  const totalIncome = sum(yearRows, 'income');
  const totalExpense = sum(yearRows, 'expense');
  const totalInvestment = sum(yearRows, 'investment');
  const reportCategories = data.categories.filter((category) =>
    yearRows.some((item) => item.categoryId === category.id),
  );
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={`Entradas em ${year}`}
          value={formatMoney(totalIncome)}
          hint="Valores realizados"
          icon={ArrowDownLeft}
          tone="green"
        />
        <MetricCard
          label={`Despesas em ${year}`}
          value={formatMoney(totalExpense)}
          hint="Sem transferências"
          icon={ArrowUpRight}
          tone="rose"
        />
        <MetricCard
          label={`Investido em ${year}`}
          value={formatMoney(totalInvestment)}
          hint="Aportes realizados"
          icon={PiggyBank}
          tone="amber"
        />
        <MetricCard
          label={`Saldo em ${year}`}
          value={formatMoney(totalIncome - totalExpense - totalInvestment)}
          hint="Após despesas e aportes"
          icon={TrendingUp}
          tone="teal"
        />
      </section>
      <Card className="rounded-[1.6rem] border-0 bg-white shadow-sm ring-1 ring-[#dfe9e5]">
        <CardHeader>
          <CardTitle>Evolução anual</CardTitle>
          <CardDescription>
            Comparativo mensal dos valores realizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={annual}
                margin={{ top: 15, right: 10, bottom: 5, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#e5eeeb" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#718681', fontSize: 12 }}
                />
                <YAxis hide />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value) * 100)}
                  contentStyle={{
                    border: '1px solid #dfe9e5',
                    borderRadius: 14,
                  }}
                />
                <Legend iconType="circle" />
                <Bar
                  dataKey="entradas"
                  name="Entradas"
                  fill="#2dd4bf"
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  dataKey="despesas"
                  name="Despesas"
                  fill="#fb7185"
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  dataKey="investimentos"
                  name="Investimentos"
                  fill="#fbbf24"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-[1.6rem] border-0 bg-white shadow-sm ring-1 ring-[#dfe9e5]">
        <CardHeader>
          <CardTitle>DRE — categorias × meses</CardTitle>
          <CardDescription>
            Entradas positivas; despesas e investimentos negativos
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="min-w-[960px] w-full text-sm">
            <thead className="bg-[#f8fbfa] text-xs uppercase tracking-[0.08em] text-[#718681]">
              <tr>
                <th className="sticky left-0 bg-[#f8fbfa] px-5 py-3 text-left">
                  Categoria
                </th>
                {months.map((key) => (
                  <th key={key} className="px-3 py-3 text-right">
                    {shortMonth(key).slice(0, 3)}
                  </th>
                ))}
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8efed]">
              {reportCategories.map((category) => {
                const values = months.map((key) =>
                  yearRows
                    .filter(
                      (item) =>
                        item.date.startsWith(key) &&
                        item.categoryId === category.id,
                    )
                    .reduce(
                      (sumValue, item) =>
                        sumValue +
                        item.amountCents * (item.kind === 'income' ? 1 : -1),
                      0,
                    ),
                );
                return (
                  <tr key={category.id}>
                    <td className="sticky left-0 bg-white px-5 py-3 font-semibold">
                      <span className="flex items-center gap-2">
                        <i
                          className="size-2.5 rounded-full"
                          style={{ background: category.color }}
                        />
                        {category.name}
                      </span>
                    </td>
                    {values.map((value, index) => (
                      <td
                        key={months[index]}
                        className={`px-3 py-3 text-right tabular-nums ${value < 0 ? 'text-[#a94659]' : value > 0 ? 'text-[#087f70]' : 'text-[#9aaba7]'}`}
                      >
                        {value ? formatMoney(value, true) : '—'}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-right font-semibold">
                      {formatMoney(
                        values.reduce((sumValue, value) => sumValue + value, 0),
                        true,
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsView({
  data,
  saving,
  onNewCategory,
  onExport,
  onImport,
  onCurrencyChange,
}: {
  data: FinanceData;
  saving: boolean;
  onNewCategory: () => void;
  onExport: () => void;
  onImport: () => void;
  onCurrencyChange: (currency: CurrencyCode) => Promise<void>;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="rounded-[1.5rem] border-0 bg-white shadow-sm ring-1 ring-[#dfe9e5]">
        <CardHeader>
          <CardTitle>Categorias</CardTitle>
          <CardDescription>
            Organize seus relatórios com nomes que façam sentido para você.
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={onNewCategory}>
              <Plus /> Nova
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.categories.map((category) => (
              <span
                key={category.id}
                className="inline-flex items-center gap-2 rounded-full border border-[#e0e9e6] px-3 py-1.5 text-sm"
              >
                <i
                  className="size-2.5 rounded-full"
                  style={{ background: category.color }}
                />
                {category.name}
                <small className="text-[#8a9c98]">
                  {kindLabels[category.kind]}
                </small>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-[1.5rem] border-0 bg-white shadow-sm ring-1 ring-[#dfe9e5]">
        <CardHeader>
          <CardTitle>Contas e meios de pagamento</CardTitle>
          <CardDescription>
            A base para conciliar saldos e entender de onde o dinheiro saiu.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="base-currency">Moeda-base</Label>
            <select
              id="base-currency"
              value={data.currency}
              disabled={saving}
              onChange={(event) =>
                void onCurrencyChange(event.target.value as CurrencyCode)
              }
              className="h-11 rounded-xl border border-[#d5e3de] bg-white px-3 text-sm"
            >
              <option value="EUR">Euro (EUR)</option>
              <option value="BRL">Real brasileiro (BRL)</option>
            </select>
            <p className="text-xs leading-5 text-[#718681]">
              A troca altera a exibição e os novos cadastros. Valores existentes
              não recebem conversão cambial automática.
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#718681]">
              Contas
            </p>
            <div className="space-y-2">
              {data.accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-xl bg-[#f5f9f7] px-3 py-2.5"
                >
                  <span className="font-medium">{account.name}</span>
                  <Badge variant="outline">{account.currency}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#718681]">
              Formas de pagamento
            </p>
            <p className="text-sm text-[#59736e]">
              {data.paymentMethods.map((item) => item.name).join(' · ') ||
                'Nenhuma cadastrada'}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-[1.5rem] border-0 bg-[#0a2523] text-white shadow-xl ring-0">
        <CardHeader>
          <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-teal-300/15 text-teal-200">
            <ShieldCheck className="size-5" />
          </div>
          <CardTitle className="text-white">
            Privacidade desde a arquitetura
          </CardTitle>
          <CardDescription className="text-white/50">
            Cada consulta e alteração valida sua identidade no servidor. A
            estrutura para futuros comprovantes já prevê armazenamento privado
            separado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white/6 p-3">
              <p className="text-xs text-white/45">Autenticação</p>
              <p className="mt-1 font-semibold">ChatGPT</p>
            </div>
            <div className="rounded-xl bg-white/6 p-3">
              <p className="text-xs text-white/45">Moeda-base</p>
              <p className="mt-1 font-semibold">
                {data.currency === 'EUR' ? 'Euro' : 'Real brasileiro'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-[1.5rem] border-0 bg-white shadow-sm ring-1 ring-[#dfe9e5]">
        <CardHeader>
          <CardTitle>Portabilidade</CardTitle>
          <CardDescription>
            Entre e saia com seus dados. A importação sempre mostra uma prévia e
            ignora duplicatas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" className="h-12" onClick={onImport}>
            <FileSpreadsheet /> Importar CSV/XLSX
          </Button>
          <Button variant="outline" className="h-12" onClick={onExport}>
            <Download /> Exportar CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  data,
  saving,
  onSubmit,
  pendingFiles,
  onPendingFilesChange,
  existingAttachments,
  onDownloadAttachment,
  onDeleteAttachment,
  onAttachmentError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: TransactionDraft;
  setDraft: React.Dispatch<React.SetStateAction<TransactionDraft>>;
  data: FinanceData;
  saving: boolean;
  onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void;
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
  existingAttachments: Attachment[];
  onDownloadAttachment: (attachment: Attachment) => Promise<void>;
  onDeleteAttachment: (attachment: Attachment) => Promise<void>;
  onAttachmentError: (message: string) => void;
}) {
  const categories = data.categories.filter(
    (item) =>
      item.kind === (draft.kind === 'transfer' ? 'expense' : draft.kind),
  );
  const selectedAccount = data.accounts.find(
    (item) => item.id === draft.accountId,
  );
  function update<K extends keyof TransactionDraft>(
    key: K,
    value: TransactionDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {draft.id ? 'Editar lançamento' : 'Novo lançamento'}
          </DialogTitle>
          <DialogDescription>
            O saldo realizado considera somente itens marcados como realizados.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(kindLabels) as TransactionKind[]).map((kind) => (
              <button
                type="button"
                key={kind}
                onClick={() => update('kind', kind)}
                className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${draft.kind === kind ? 'border-[#0b7f71] bg-[#dbf5ef] text-[#086c60]' : 'border-[#dfe9e5] text-[#627a75] hover:bg-[#f4f8f7]'}`}
              >
                {kindLabels[kind]}
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transaction-title">Descrição</Label>
            <Input
              id="transaction-title"
              value={draft.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="Ex.: conta de energia"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="transaction-amount">Valor</Label>
              <Input
                id="transaction-amount"
                inputMode="decimal"
                value={draft.amount}
                onChange={(event) => update('amount', event.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transaction-date">Data</Label>
              <Input
                id="transaction-date"
                type="date"
                value={draft.date}
                onChange={(event) => update('date', event.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {draft.kind !== 'transfer' && (
              <div className="grid gap-2">
                <Label htmlFor="transaction-category">Categoria</Label>
                <select
                  id="transaction-category"
                  value={draft.categoryId}
                  onChange={(event) => update('categoryId', event.target.value)}
                  className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="transaction-status">Status</Label>
              <select
                id="transaction-status"
                value={draft.status}
                onChange={(event) =>
                  update('status', event.target.value as TransactionStatus)
                }
                className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="paid">Realizado</option>
                <option value="pending">Pendente</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="transaction-account">
                {draft.kind === 'transfer' ? 'Conta de origem' : 'Conta'}
              </Label>
              <select
                id="transaction-account"
                value={draft.accountId}
                onChange={(event) => update('accountId', event.target.value)}
                className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Não informada</option>
                {data.accounts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            {draft.kind === 'transfer' ? (
              <div className="grid gap-2">
                <Label htmlFor="transaction-destination">
                  Conta de destino
                </Label>
                <select
                  id="transaction-destination"
                  value={draft.destinationAccountId}
                  onChange={(event) =>
                    update('destinationAccountId', event.target.value)
                  }
                  className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="">Selecione</option>
                  {data.accounts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="transaction-payment">Forma de pagamento</Label>
                <select
                  id="transaction-payment"
                  value={draft.paymentMethodId}
                  onChange={(event) =>
                    update('paymentMethodId', event.target.value)
                  }
                  className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="">Não informada</option>
                  {data.paymentMethods.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {draft.kind !== 'transfer' && selectedAccount?.type === 'credit' && (
            <div className="rounded-xl border border-[#bee2d9] bg-[#ecfaf6] px-4 py-3 text-xs leading-5 text-[#376a61]">
              Esta despesa entrará em <strong>{selectedAccount.name}</strong>. O
              ciclo será definido pela data da compra, com fechamento no dia{' '}
              {selectedAccount.closingDay} e vencimento no dia{' '}
              {selectedAccount.dueDay}.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="transaction-responsible">
                Responsável (opcional)
              </Label>
              <Input
                id="transaction-responsible"
                value={draft.responsible}
                onChange={(event) => update('responsible', event.target.value)}
                placeholder="Ex.: Gabriel"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transaction-notes">Observação (opcional)</Label>
              <Input
                id="transaction-notes"
                value={draft.notes}
                onChange={(event) => update('notes', event.target.value)}
                placeholder="Detalhes úteis"
              />
            </div>
          </div>
          {!draft.id && (
            <div className="rounded-2xl border border-[#dfe9e5] bg-[#f7faf9] p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="transaction-recurrence">
                    Repetir lançamento
                  </Label>
                  <select
                    id="transaction-recurrence"
                    value={draft.recurrenceFrequency}
                    onChange={(event) =>
                      update(
                        'recurrenceFrequency',
                        event.target.value as '' | RecurrenceFrequency,
                      )
                    }
                    className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm"
                  >
                    <option value="">Não repetir</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
                {draft.recurrenceFrequency && (
                  <div className="grid gap-2">
                    <Label htmlFor="transaction-recurrence-end">
                      Término (opcional)
                    </Label>
                    <Input
                      id="transaction-recurrence-end"
                      type="date"
                      min={draft.date}
                      value={draft.recurrenceEndDate}
                      onChange={(event) =>
                        update('recurrenceEndDate', event.target.value)
                      }
                    />
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs leading-5 text-[#718681]">
                As próximas ocorrências só serão criadas quando você confirmar
                em Planejamento; navegar entre meses não gera nada.
              </p>
            </div>
          )}
          <AttachmentComposer
            existing={existingAttachments}
            pendingFiles={pendingFiles}
            onPendingFilesChange={onPendingFilesChange}
            onDownload={onDownloadAttachment}
            onDelete={onDeleteAttachment}
            onError={onAttachmentError}
            disabled={saving}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#0b7f71] text-white hover:bg-[#096b60]"
            >
              {saving ? 'Salvando…' : 'Salvar lançamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BudgetDialog({
  open,
  onOpenChange,
  data,
  month,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FinanceData;
  month: string;
  saving: boolean;
  onSave: (categoryId: string, value: string) => Promise<void>;
}) {
  const categories = data.categories.filter((item) => item.kind === 'expense');
  const [categoryId, setCategoryId] = useState('');
  const [value, setValue] = useState('');
  const effectiveCategoryId = categoryId || categories[0]?.id || '';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo orçamento</DialogTitle>
          <DialogDescription>
            Defina um limite para {monthLabel(month)}. Você poderá ajustá-lo
            depois.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="budget-category">Categoria</Label>
            <select
              id="budget-category"
              value={effectiveCategoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="budget-value">Limite mensal</Label>
            <Input
              id="budget-value"
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="0,00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={saving}
            className="bg-[#0b7f71] text-white hover:bg-[#096b60]"
            onClick={() => void onSave(effectiveCategoryId, value)}
          >
            Salvar limite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoalDialog({
  open,
  onOpenChange,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSave: (goal: Goal) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [color, setColor] = useState('#0f9f8d');
  function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetCents = parseMoney(target);
    if (!name.trim() || !targetCents) return;
    void onSave({
      id: newId('goal'),
      name: name.trim(),
      targetCents,
      currentCents: parseMoney(current),
      dueDate: dueDate || null,
      color,
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova meta</DialogTitle>
          <DialogDescription>
            Crie um objetivo claro e acompanhe cada avanço.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="goal-name">Nome</Label>
            <Input
              id="goal-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: reserva de emergência"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="goal-target">Valor desejado</Label>
              <Input
                id="goal-target"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-current">Já acumulado</Label>
              <Input
                id="goal-current"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="goal-date">Prazo (opcional)</Label>
              <Input
                id="goal-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-color">Cor</Label>
              <Input
                id="goal-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#0b7f71] text-white hover:bg-[#096b60]"
            >
              Salvar meta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSave: (
    kind: Category['kind'],
    name: string,
    color: string,
  ) => Promise<void>;
}) {
  const [kind, setKind] = useState<Category['kind']>('expense');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0f9f8d');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
          <DialogDescription>
            Use um nome curto para manter gráficos e filtros legíveis.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="category-kind">Grupo</Label>
            <select
              id="category-kind"
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as Category['kind'])
              }
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="income">Entrada</option>
              <option value="expense">Despesa</option>
              <option value="investment">Investimento</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category-name">Nome</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Educação"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category-color">Cor</Label>
            <Input
              id="category-color"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={saving}
            className="bg-[#0b7f71] text-white hover:bg-[#096b60]"
            onClick={() => void onSave(kind, name, color)}
          >
            Criar categoria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  preview,
  onClose,
  onConfirm,
  onSelectSheet,
  saving,
}: {
  preview: ImportPreview | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onSelectSheet: (sheetIndex: number) => void;
  saving: boolean;
}) {
  return (
    <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prévia da importação</DialogTitle>
          <DialogDescription>
            Nenhum dado é gravado até você confirmar.
          </DialogDescription>
        </DialogHeader>
        {preview && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#f3f8f6] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 truncate font-semibold">
                  {preview.sourceName}
                </p>
                <Badge className="bg-white text-[#526e69]">
                  {preview.format.toUpperCase()}
                </Badge>
              </div>
              {preview.sheetNames.length > 1 && (
                <div className="mt-3 grid gap-2">
                  <Label htmlFor="import-sheet">Aba da planilha</Label>
                  <select
                    id="import-sheet"
                    value={preview.sheetIndex}
                    onChange={(event) =>
                      onSelectSheet(Number(event.target.value))
                    }
                    className="h-10 rounded-lg border border-[#d5e3de] bg-white px-3 text-sm"
                  >
                    {preview.sheetNames.map((name, index) => (
                      <option key={`${name}-${index}`} value={index}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {preview.sheetNames.length === 1 && (
                <p className="mt-2 text-xs text-[#718681]">
                  Aba: {preview.sheetName}
                </p>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white p-2">
                  <p className="text-xl font-semibold text-[#087f70]">
                    {preview.rows.length}
                  </p>
                  <p className="text-[11px] text-[#718681]">válidos</p>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <p className="text-xl font-semibold text-amber-600">
                    {preview.duplicateCount}
                  </p>
                  <p className="text-[11px] text-[#718681]">duplicados</p>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <p className="text-xl font-semibold text-rose-600">
                    {preview.invalidCount}
                  </p>
                  <p className="text-[11px] text-[#718681]">inválidos</p>
                </div>
              </div>
            </div>
            {preview.missingColumns.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Colunas não encontradas: {preview.missingColumns.join(', ')}.
                Escolha outra aba ou ajuste o cabeçalho do arquivo.
              </div>
            )}
            <p className="text-xs leading-5 text-[#718681]">
              Formato esperado: data, grupo, descrição, valor, status e
              categoria. CSV e Excel (.xlsx), datas brasileiras e valores com
              vírgula são reconhecidos. Até 1.000 linhas são avaliadas por vez.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={
              saving ||
              !preview?.rows.length ||
              Boolean(preview?.missingColumns.length)
            }
            className="bg-[#0b7f71] text-white hover:bg-[#096b60]"
            onClick={() => void onConfirm()}
          >
            {saving ? 'Importando…' : `Importar ${preview?.rows.length ?? 0}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-[#f5f9f7] px-4 py-7 text-center text-sm text-[#718681]">
      {text}
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: typeof Target;
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-[1.6rem] border border-dashed border-[#bfd0cb] bg-white px-6 py-16 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#ddf4ee] text-[#0b7f71]">
        <Icon className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718681]">
        {description}
      </p>
      <Button
        onClick={onAction}
        className="mt-5 bg-[#0b7f71] text-white hover:bg-[#096b60]"
      >
        <Plus /> {action}
      </Button>
    </div>
  );
}
