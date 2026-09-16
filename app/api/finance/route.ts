import { env } from 'cloudflare:workers';

import {
  advanceRecurrenceDate,
  cardCycleForPurchase,
  isIsoDateStrict,
  type RecurrenceFrequency,
} from '@/lib/finance-rules';
import { getSiteUser } from '@/lib/server-user';

const transactionKinds = new Set([
  'income',
  'expense',
  'investment',
  'transfer',
]);
const transactionStatuses = new Set(['paid', 'pending']);
const categoryKinds = new Set(['income', 'expense', 'investment']);
const recurrenceFrequencies = new Set(['weekly', 'monthly', 'yearly']);
const currencies = new Set(['EUR', 'BRL']);

class HttpError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'private, no-store' },
  });
}

function requiredString(value: unknown, field: string, maxLength = 160) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(`${field} é obrigatório.`);
  }
  return value.trim().slice(0, maxLength);
}

function optionalString(value: unknown, maxLength = 500) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function positiveInteger(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new HttpError(`${field} deve ser maior que zero.`);
  }
  return Number(value);
}

function integerInRange(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new HttpError(`${field} deve ficar entre ${minimum} e ${maximum}.`);
  }
  return number;
}

function validDate(value: unknown, field = 'Data') {
  const date = requiredString(value, field, 10);
  if (!isIsoDateStrict(date)) throw new HttpError(`${field} inválida.`);
  return date;
}

function validMonth(value: unknown) {
  const month = requiredString(value, 'Mês', 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new HttpError('Mês inválido.');
  }
  return month;
}

async function fingerprint(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

type OwnedTable =
  | 'accounts'
  | 'categories'
  | 'payment_methods'
  | 'recurrence_rules';

const ownedQueries: Record<OwnedTable, string> = {
  accounts: 'SELECT id FROM accounts WHERE id = ? AND owner_id = ?',
  categories: 'SELECT id FROM categories WHERE id = ? AND owner_id = ?',
  payment_methods:
    'SELECT id FROM payment_methods WHERE id = ? AND owner_id = ?',
  recurrence_rules:
    'SELECT id FROM recurrence_rules WHERE id = ? AND owner_id = ?',
};

async function requireOwned(
  db: D1Database,
  table: OwnedTable,
  id: string | null,
  ownerId: string,
  label: string,
) {
  if (!id) return;
  const row = await db.prepare(ownedQueries[table]).bind(id, ownerId).first();
  if (!row) throw new HttpError(`${label} não encontrado.`, 404);
}

async function seedDefaults(ownerId: string) {
  const db = env.DB;
  const [categoryCount, accountCount, paymentCount] = await db.batch([
    db
      .prepare('SELECT COUNT(*) AS count FROM categories WHERE owner_id = ?')
      .bind(ownerId),
    db
      .prepare('SELECT COUNT(*) AS count FROM accounts WHERE owner_id = ?')
      .bind(ownerId),
    db
      .prepare(
        'SELECT COUNT(*) AS count FROM payment_methods WHERE owner_id = ?',
      )
      .bind(ownerId),
  ]);

  const statements: D1PreparedStatement[] = [];
  if (
    Number((categoryCount.results[0] as { count?: number })?.count ?? 0) === 0
  ) {
    const defaults = [
      ['income', 'Salário', '#2dd4bf'],
      ['income', 'Renda extra', '#22c55e'],
      ['expense', 'Moradia', '#f97316'],
      ['expense', 'Mercado', '#f59e0b'],
      ['expense', 'Transporte', '#8b5cf6'],
      ['expense', 'Saúde', '#38bdf8'],
      ['expense', 'Lazer', '#ec4899'],
      ['investment', 'Reserva', '#14b8a6'],
    ];
    statements.push(
      ...defaults.map(([kind, name, color]) =>
        db
          .prepare(
            'INSERT OR IGNORE INTO categories (id, owner_id, kind, name, color) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(crypto.randomUUID(), ownerId, kind, name, color),
      ),
    );
  }
  if (
    Number((accountCount.results[0] as { count?: number })?.count ?? 0) === 0
  ) {
    statements.push(
      db
        .prepare(
          'INSERT OR IGNORE INTO accounts (id, owner_id, name, type, opening_balance_cents, currency) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(
          crypto.randomUUID(),
          ownerId,
          'Conta principal',
          'checking',
          0,
          'EUR',
        ),
    );
  }
  if (
    Number((paymentCount.results[0] as { count?: number })?.count ?? 0) === 0
  ) {
    for (const name of ['Pix', 'Cartão', 'Débito automático', 'Dinheiro']) {
      statements.push(
        db
          .prepare(
            'INSERT OR IGNORE INTO payment_methods (id, owner_id, name) VALUES (?, ?, ?)',
          )
          .bind(crypto.randomUUID(), ownerId, name),
      );
    }
  }
  if (statements.length) await db.batch(statements);
}

type CardAccountRow = {
  id: string;
  type: string;
  closingDay: number | null;
  dueDay: number | null;
};

async function ensureOpenCardStatement(
  db: D1Database,
  ownerId: string,
  accountId: string,
  purchaseDate: string,
) {
  const card = await db
    .prepare(
      `SELECT id, type, closing_day AS closingDay, due_day AS dueDay
       FROM accounts WHERE id = ? AND owner_id = ?`,
    )
    .bind(accountId, ownerId)
    .first<CardAccountRow>();
  if (!card) throw new HttpError('Conta não encontrada.', 404);
  if (card.type !== 'credit') return null;
  if (!card.closingDay || !card.dueDay) {
    throw new HttpError('Complete o fechamento e o vencimento do cartão.');
  }
  const cycle = cardCycleForPurchase(
    purchaseDate,
    card.closingDay,
    card.dueDay,
  );
  const existing = await db
    .prepare(
      `SELECT id, status FROM card_statements
       WHERE owner_id = ? AND card_account_id = ? AND cycle_end = ?`,
    )
    .bind(ownerId, accountId, cycle.cycleEnd)
    .first<{ id: string; status: string }>();
  if (existing) {
    if (existing.status !== 'open') {
      throw new HttpError(
        'A fatura desse período está fechada. Reabra-a antes de alterar compras.',
        409,
      );
    }
    return existing.id;
  }
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO card_statements
        (id, owner_id, card_account_id, cycle_start, cycle_end, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'open')`,
    )
    .bind(
      id,
      ownerId,
      accountId,
      cycle.cycleStart,
      cycle.cycleEnd,
      cycle.dueDate,
    )
    .run();
  return id;
}

async function assertTransactionStatementOpen(
  db: D1Database,
  ownerId: string,
  transactionId: string,
) {
  const row = await db
    .prepare(
      `SELECT s.status
       FROM transactions t
       LEFT JOIN card_statements s
         ON s.id = t.card_statement_id AND s.owner_id = t.owner_id
       WHERE t.id = ? AND t.owner_id = ?`,
    )
    .bind(transactionId, ownerId)
    .first<{ status: string | null }>();
  if (!row) throw new HttpError('Lançamento não encontrado.', 404);
  if (row.status && row.status !== 'open') {
    throw new HttpError(
      'A fatura está fechada e protege este lançamento.',
      409,
    );
  }
}

export async function GET() {
  const user = await getSiteUser();
  if (!user) return json({ error: 'Autenticação necessária.' }, 401);
  if (user.isLocalPreview) return json({ preview: true });

  try {
    await seedDefaults(user.userId);
    const db = env.DB;
    const [
      transactions,
      categories,
      accounts,
      paymentMethods,
      budgets,
      goals,
      recurrenceRules,
      cardStatements,
      attachments,
    ] = await db.batch([
      db
        .prepare(
          `SELECT id, kind, title, notes, amount_cents AS amountCents, date, status,
            category_id AS categoryId, account_id AS accountId,
            destination_account_id AS destinationAccountId,
            payment_method_id AS paymentMethodId, responsible,
            recurrence_id AS recurrenceId,
            recurrence_occurrence_date AS recurrenceOccurrenceDate,
            card_statement_id AS cardStatementId
           FROM transactions WHERE owner_id = ? ORDER BY date DESC, created_at DESC`,
        )
        .bind(user.userId),
      db
        .prepare(
          'SELECT id, kind, name, color FROM categories WHERE owner_id = ? ORDER BY kind, name',
        )
        .bind(user.userId),
      db
        .prepare(
          `SELECT id, name, type, opening_balance_cents AS openingBalanceCents, currency,
            closing_day AS closingDay, due_day AS dueDay,
            credit_limit_cents AS creditLimitCents, card_last_four AS cardLastFour
           FROM accounts WHERE owner_id = ? AND archived = 0 ORDER BY type, name`,
        )
        .bind(user.userId),
      db
        .prepare(
          'SELECT id, name FROM payment_methods WHERE owner_id = ? ORDER BY name',
        )
        .bind(user.userId),
      db
        .prepare(
          `SELECT id, month, category_id AS categoryId, limit_cents AS limitCents
           FROM budgets WHERE owner_id = ? ORDER BY month DESC`,
        )
        .bind(user.userId),
      db
        .prepare(
          `SELECT id, name, target_cents AS targetCents, current_cents AS currentCents,
            due_date AS dueDate, color
           FROM goals WHERE owner_id = ? ORDER BY created_at`,
        )
        .bind(user.userId),
      db
        .prepare(
          `SELECT id, source_transaction_id AS sourceTransactionId, frequency, interval,
            COALESCE(anchor_date, next_date) AS anchorDate, next_date AS nextDate,
            end_date AS endDate, occurrence_status AS occurrenceStatus, active
           FROM recurrence_rules WHERE owner_id = ? ORDER BY active DESC, next_date`,
        )
        .bind(user.userId),
      db
        .prepare(
          `SELECT id, card_account_id AS cardAccountId, cycle_start AS cycleStart,
            cycle_end AS cycleEnd, due_date AS dueDate, status,
            closed_total_cents AS closedTotalCents
           FROM card_statements WHERE owner_id = ? ORDER BY cycle_end DESC`,
        )
        .bind(user.userId),
      db
        .prepare(
          `SELECT id, transaction_id AS transactionId, file_name AS fileName,
            content_type AS contentType, size_bytes AS sizeBytes, kind, status,
            created_at AS createdAt
           FROM attachments
           WHERE owner_id = ? AND status = 'ready' AND deleted_at IS NULL
           ORDER BY created_at DESC`,
        )
        .bind(user.userId),
    ]);

    return json({
      currency:
        (
          accounts.results.find((account) => {
            const value = account as { currency?: unknown };
            return currencies.has(String(value.currency));
          }) as { currency?: 'EUR' | 'BRL' } | undefined
        )?.currency ?? 'EUR',
      transactions: transactions.results,
      categories: categories.results,
      accounts: accounts.results,
      paymentMethods: paymentMethods.results,
      budgets: budgets.results,
      goals: goals.results,
      recurrenceRules: recurrenceRules.results.map((rule) => {
        const value = rule as Record<string, unknown> & { active?: number };
        return { ...value, active: Boolean(value.active) };
      }),
      cardStatements: cardStatements.results,
      attachments: attachments.results,
    });
  } catch (error) {
    console.error('finance.GET failed', error);
    return json(
      { error: 'Não foi possível carregar os dados financeiros.' },
      500,
    );
  }
}

export async function POST(request: Request) {
  const user = await getSiteUser();
  if (!user) return json({ error: 'Autenticação necessária.' }, 401);
  if (user.isLocalPreview) return json({ preview: true });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = requiredString(body.action, 'Ação', 40);
    const db = env.DB;

    if (action === 'save-transaction') {
      const id = optionalString(body.id, 80) ?? crypto.randomUUID();
      const kind = requiredString(body.kind, 'Grupo', 20);
      const status = requiredString(body.status, 'Status', 20);
      const title = requiredString(body.title, 'Descrição');
      const date = validDate(body.date);
      const amountCents = positiveInteger(body.amountCents, 'Valor');
      if (!transactionKinds.has(kind)) throw new HttpError('Grupo inválido.');
      if (!transactionStatuses.has(status))
        throw new HttpError('Status inválido.');

      const categoryId =
        kind === 'transfer' ? null : optionalString(body.categoryId, 80);
      const accountId = optionalString(body.accountId, 80);
      const destinationAccountId =
        kind === 'transfer'
          ? optionalString(body.destinationAccountId, 80)
          : null;
      const paymentMethodId = optionalString(body.paymentMethodId, 80);
      if (
        kind === 'transfer' &&
        (!accountId ||
          !destinationAccountId ||
          accountId === destinationAccountId)
      ) {
        throw new HttpError('Informe contas de origem e destino diferentes.');
      }

      const existing = await db
        .prepare('SELECT id FROM transactions WHERE id = ? AND owner_id = ?')
        .bind(id, user.userId)
        .first();
      if (existing) await assertTransactionStatementOpen(db, user.userId, id);
      await Promise.all([
        requireOwned(db, 'categories', categoryId, user.userId, 'Categoria'),
        requireOwned(db, 'accounts', accountId, user.userId, 'Conta'),
        requireOwned(
          db,
          'accounts',
          destinationAccountId,
          user.userId,
          'Conta de destino',
        ),
        requireOwned(
          db,
          'payment_methods',
          paymentMethodId,
          user.userId,
          'Forma de pagamento',
        ),
      ]);
      const cardStatementId =
        kind !== 'transfer' && accountId
          ? await ensureOpenCardStatement(db, user.userId, accountId, date)
          : null;
      const result = await db
        .prepare(
          `INSERT INTO transactions (
            id, owner_id, kind, title, notes, amount_cents, date, status,
            category_id, account_id, destination_account_id, payment_method_id,
            responsible, card_statement_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            kind = excluded.kind, title = excluded.title, notes = excluded.notes,
            amount_cents = excluded.amount_cents, date = excluded.date,
            status = excluded.status, category_id = excluded.category_id,
            account_id = excluded.account_id,
            destination_account_id = excluded.destination_account_id,
            payment_method_id = excluded.payment_method_id,
            responsible = excluded.responsible,
            card_statement_id = excluded.card_statement_id,
            updated_at = CURRENT_TIMESTAMP
          WHERE transactions.owner_id = ?`,
        )
        .bind(
          id,
          user.userId,
          kind,
          title,
          optionalString(body.notes),
          amountCents,
          date,
          status,
          categoryId,
          accountId,
          destinationAccountId,
          paymentMethodId,
          optionalString(body.responsible, 100),
          cardStatementId,
          user.userId,
        )
        .run();
      if (!result.meta.changes)
        throw new HttpError('Lançamento não encontrado.', 404);
      return json({ id, cardStatementId });
    }

    if (action === 'delete-transaction') {
      const id = requiredString(body.id, 'Lançamento', 80);
      await assertTransactionStatementOpen(db, user.userId, id);
      const files = await db
        .prepare(
          'SELECT object_key AS objectKey FROM attachments WHERE transaction_id = ? AND owner_id = ?',
        )
        .bind(id, user.userId)
        .all<{ objectKey: string }>();
      await Promise.all(
        files.results.map((file) => env.FILES.delete(file.objectKey)),
      );
      const results = await db.batch([
        db
          .prepare(
            'DELETE FROM attachments WHERE transaction_id = ? AND owner_id = ?',
          )
          .bind(id, user.userId),
        db
          .prepare(
            'DELETE FROM recurrence_rules WHERE source_transaction_id = ? AND owner_id = ?',
          )
          .bind(id, user.userId),
        db
          .prepare('DELETE FROM transactions WHERE id = ? AND owner_id = ?')
          .bind(id, user.userId),
      ]);
      if (!results[2].meta.changes)
        throw new HttpError('Lançamento não encontrado.', 404);
      return json({ id });
    }

    if (action === 'toggle-status') {
      const id = requiredString(body.id, 'Lançamento', 80);
      const status = requiredString(body.status, 'Status', 20);
      if (!transactionStatuses.has(status))
        throw new HttpError('Status inválido.');
      await assertTransactionStatementOpen(db, user.userId, id);
      const result = await db
        .prepare(
          'UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?',
        )
        .bind(status, id, user.userId)
        .run();
      if (!result.meta.changes)
        throw new HttpError('Lançamento não encontrado.', 404);
      return json({ id, status });
    }

    if (action === 'save-budget') {
      const categoryId = requiredString(body.categoryId, 'Categoria', 80);
      const month = validMonth(body.month);
      const limitCents = positiveInteger(body.limitCents, 'Limite');
      await requireOwned(
        db,
        'categories',
        categoryId,
        user.userId,
        'Categoria',
      );
      const id = optionalString(body.id, 80) ?? crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO budgets (id, owner_id, month, category_id, limit_cents)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(owner_id, month, category_id) DO UPDATE SET
             limit_cents = excluded.limit_cents, updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(id, user.userId, month, categoryId, limitCents)
        .run();
      return json({ id });
    }

    if (action === 'save-goal') {
      const id = optionalString(body.id, 80) ?? crypto.randomUUID();
      const name = requiredString(body.name, 'Nome da meta');
      const targetCents = positiveInteger(body.targetCents, 'Objetivo');
      const currentCents = Math.max(0, Number(body.currentCents) || 0);
      const dueDate = optionalString(body.dueDate, 10);
      if (dueDate && !isIsoDateStrict(dueDate))
        throw new HttpError('Prazo inválido.');
      const result = await db
        .prepare(
          `INSERT INTO goals (id, owner_id, name, target_cents, current_cents, due_date, color)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name,
             target_cents = excluded.target_cents, current_cents = excluded.current_cents,
             due_date = excluded.due_date, color = excluded.color,
             updated_at = CURRENT_TIMESTAMP
           WHERE goals.owner_id = ?`,
        )
        .bind(
          id,
          user.userId,
          name,
          targetCents,
          Math.round(currentCents),
          dueDate,
          optionalString(body.color, 20) ?? '#f59e0b',
          user.userId,
        )
        .run();
      if (!result.meta.changes)
        throw new HttpError('Meta não encontrada.', 404);
      return json({ id });
    }

    if (action === 'delete-goal') {
      const id = requiredString(body.id, 'Meta', 80);
      const result = await db
        .prepare('DELETE FROM goals WHERE id = ? AND owner_id = ?')
        .bind(id, user.userId)
        .run();
      if (!result.meta.changes)
        throw new HttpError('Meta não encontrada.', 404);
      return json({ id });
    }

    if (action === 'save-category') {
      const id = crypto.randomUUID();
      const kind = requiredString(body.kind, 'Grupo', 20);
      if (!categoryKinds.has(kind)) throw new HttpError('Grupo inválido.');
      await db
        .prepare(
          'INSERT INTO categories (id, owner_id, kind, name, color) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          user.userId,
          kind,
          requiredString(body.name, 'Categoria', 80),
          optionalString(body.color, 20) ?? '#14b8a6',
        )
        .run();
      return json({ id });
    }

    if (action === 'save-credit-card') {
      const id = optionalString(body.id, 80) ?? crypto.randomUUID();
      const name = requiredString(body.name, 'Nome do cartão', 100);
      const creditLimitCents = positiveInteger(body.creditLimitCents, 'Limite');
      const closingDay = integerInRange(body.closingDay, 'Fechamento', 1, 31);
      const dueDay = integerInRange(body.dueDay, 'Vencimento', 1, 31);
      const lastFour = optionalString(body.cardLastFour, 4);
      const currency = optionalString(body.currency, 3) ?? 'EUR';
      if (!currencies.has(currency)) throw new HttpError('Moeda inválida.');
      if (lastFour && !/^\d{4}$/.test(lastFour)) {
        throw new HttpError('Informe exatamente os quatro últimos dígitos.');
      }
      const result = await db
        .prepare(
          `INSERT INTO accounts (
            id, owner_id, name, type, opening_balance_cents, currency,
            closing_day, due_day, credit_limit_cents, card_last_four
          ) VALUES (?, ?, ?, 'credit', 0, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name,
            closing_day = excluded.closing_day, due_day = excluded.due_day,
            credit_limit_cents = excluded.credit_limit_cents,
            card_last_four = excluded.card_last_four
          WHERE accounts.owner_id = ? AND accounts.type = 'credit'`,
        )
        .bind(
          id,
          user.userId,
          name,
          currency,
          closingDay,
          dueDay,
          creditLimitCents,
          lastFour,
          user.userId,
        )
        .run();
      if (!result.meta.changes)
        throw new HttpError('Cartão não encontrado.', 404);
      return json({ id });
    }

    if (action === 'set-currency') {
      const currency = requiredString(body.currency, 'Moeda', 3);
      if (!currencies.has(currency)) throw new HttpError('Moeda inválida.');
      await db
        .prepare(
          `UPDATE accounts SET currency = ?, updated_at = CURRENT_TIMESTAMP
           WHERE owner_id = ?`,
        )
        .bind(currency, user.userId)
        .run();
      return json({ currency });
    }

    if (action === 'close-card-statement') {
      const id = requiredString(body.id, 'Fatura', 80);
      const statement = await db
        .prepare(
          'SELECT id, status FROM card_statements WHERE id = ? AND owner_id = ?',
        )
        .bind(id, user.userId)
        .first<{ id: string; status: string }>();
      if (!statement) throw new HttpError('Fatura não encontrada.', 404);
      if (statement.status !== 'open') {
        throw new HttpError('Somente faturas abertas podem ser fechadas.', 409);
      }
      const total = await db
        .prepare(
          `SELECT COALESCE(SUM(amount_cents), 0) AS total
           FROM transactions
           WHERE owner_id = ? AND card_statement_id = ? AND kind != 'transfer'`,
        )
        .bind(user.userId, id)
        .first<{ total: number }>();
      const closedTotalCents = Number(total?.total ?? 0);
      if (closedTotalCents <= 0)
        throw new HttpError('Não há compras para fechar nesta fatura.');
      await db
        .prepare(
          `UPDATE card_statements SET status = 'closed', closed_total_cents = ?,
            closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND owner_id = ? AND status = 'open'`,
        )
        .bind(closedTotalCents, id, user.userId)
        .run();
      return json({ id, status: 'closed', closedTotalCents });
    }

    if (action === 'pay-card-statement') {
      const id = requiredString(body.id, 'Fatura', 80);
      const sourceAccountId = requiredString(
        body.sourceAccountId,
        'Conta de pagamento',
        80,
      );
      const source = await db
        .prepare('SELECT id, type FROM accounts WHERE id = ? AND owner_id = ?')
        .bind(sourceAccountId, user.userId)
        .first<{ id: string; type: string }>();
      if (!source)
        throw new HttpError('Conta de pagamento não encontrada.', 404);
      if (source.type === 'credit')
        throw new HttpError('Escolha uma conta bancária para pagar a fatura.');
      const statement = await db
        .prepare(
          `SELECT s.id, s.status, s.closed_total_cents AS total,
            s.due_date AS dueDate, s.card_account_id AS cardAccountId,
            a.name AS cardName
           FROM card_statements s
           JOIN accounts a ON a.id = s.card_account_id AND a.owner_id = s.owner_id
           WHERE s.id = ? AND s.owner_id = ?`,
        )
        .bind(id, user.userId)
        .first<{
          id: string;
          status: string;
          total: number | null;
          dueDate: string;
          cardAccountId: string;
          cardName: string;
        }>();
      if (!statement) throw new HttpError('Fatura não encontrada.', 404);
      if (statement.status !== 'closed' || !statement.total) {
        throw new HttpError('Feche a fatura antes de pagar.', 409);
      }
      const transactionId = `statement-payment-${statement.id}`;
      await db.batch([
        db
          .prepare(
            `INSERT OR IGNORE INTO transactions (
              id, owner_id, kind, title, amount_cents, date, status,
              account_id, destination_account_id, card_statement_id
            ) VALUES (?, ?, 'transfer', ?, ?, ?, 'paid', ?, ?, ?)`,
          )
          .bind(
            transactionId,
            user.userId,
            `Pagamento · ${statement.cardName}`,
            statement.total,
            statement.dueDate,
            sourceAccountId,
            statement.cardAccountId,
            statement.id,
          ),
        db
          .prepare(
            `UPDATE card_statements SET status = 'paid', paid_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND owner_id = ? AND status = 'closed'`,
          )
          .bind(statement.id, user.userId),
      ]);
      return json({ id: statement.id, status: 'paid' });
    }

    if (action === 'save-recurrence') {
      const sourceTransactionId = requiredString(
        body.sourceTransactionId,
        'Lançamento base',
        80,
      );
      const frequency = requiredString(body.frequency, 'Frequência', 20);
      if (!recurrenceFrequencies.has(frequency))
        throw new HttpError('Frequência inválida.');
      const interval = integerInRange(body.interval ?? 1, 'Intervalo', 1, 12);
      const endDate = optionalString(body.endDate, 10);
      if (endDate && !isIsoDateStrict(endDate))
        throw new HttpError('Término inválido.');
      const source = await db
        .prepare(
          'SELECT id, date FROM transactions WHERE id = ? AND owner_id = ?',
        )
        .bind(sourceTransactionId, user.userId)
        .first<{ id: string; date: string }>();
      if (!source) throw new HttpError('Lançamento base não encontrado.', 404);
      if (endDate && endDate <= source.date)
        throw new HttpError('O término deve ser posterior ao lançamento base.');
      const nextDate = advanceRecurrenceDate(
        source.date,
        frequency as RecurrenceFrequency,
        interval,
        source.date,
      );
      const id = optionalString(body.id, 80) ?? crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO recurrence_rules (
            id, owner_id, source_transaction_id, frequency, interval,
            anchor_date, next_date, end_date, occurrence_status, active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1)
          ON CONFLICT(owner_id, source_transaction_id) DO UPDATE SET
            frequency = excluded.frequency, interval = excluded.interval,
            anchor_date = excluded.anchor_date, next_date = excluded.next_date,
            end_date = excluded.end_date, occurrence_status = 'pending', active = 1,
            updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          id,
          user.userId,
          sourceTransactionId,
          frequency,
          interval,
          source.date,
          nextDate,
          endDate,
        )
        .run();
      const saved = await db
        .prepare(
          `SELECT id FROM recurrence_rules
           WHERE owner_id = ? AND source_transaction_id = ?`,
        )
        .bind(user.userId, sourceTransactionId)
        .first<{ id: string }>();
      await db
        .prepare(
          `UPDATE transactions SET recurrence_id = ?, recurrence_occurrence_date = ?
           WHERE id = ? AND owner_id = ?`,
        )
        .bind(saved!.id, source.date, sourceTransactionId, user.userId)
        .run();
      return json({ id: saved!.id, nextDate, anchorDate: source.date });
    }

    if (action === 'set-recurrence-active') {
      const id = requiredString(body.id, 'Recorrência', 80);
      const active = Boolean(body.active);
      const result = await db
        .prepare(
          `UPDATE recurrence_rules SET active = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND owner_id = ?`,
        )
        .bind(active ? 1 : 0, id, user.userId)
        .run();
      if (!result.meta.changes)
        throw new HttpError('Recorrência não encontrada.', 404);
      return json({ id, active });
    }

    if (action === 'materialize-recurrences') {
      const throughDate = validDate(body.throughDate, 'Data final');
      const ruleId = optionalString(body.ruleId, 80);
      if (ruleId) {
        await requireOwned(
          db,
          'recurrence_rules',
          ruleId,
          user.userId,
          'Recorrência',
        );
      }
      const query = `SELECT r.id AS ruleId, r.frequency, r.interval,
          COALESCE(r.anchor_date, t.date) AS anchorDate,
          r.next_date AS nextDate, r.end_date AS endDate,
          r.occurrence_status AS occurrenceStatus,
          t.kind, t.title, t.notes, t.amount_cents AS amountCents,
          t.category_id AS categoryId, t.account_id AS accountId,
          t.destination_account_id AS destinationAccountId,
          t.payment_method_id AS paymentMethodId, t.responsible
        FROM recurrence_rules r
        JOIN transactions t
          ON t.id = r.source_transaction_id AND t.owner_id = r.owner_id
        WHERE r.owner_id = ? AND r.active = 1${ruleId ? ' AND r.id = ?' : ''}
        ORDER BY r.next_date`;
      const bound = ruleId
        ? db.prepare(query).bind(user.userId, ruleId)
        : db.prepare(query).bind(user.userId);
      const rules = await bound.all<{
        ruleId: string;
        frequency: RecurrenceFrequency;
        interval: number;
        anchorDate: string;
        nextDate: string;
        endDate: string | null;
        occurrenceStatus: string;
        kind: string;
        title: string;
        notes: string | null;
        amountCents: number;
        categoryId: string | null;
        accountId: string | null;
        destinationAccountId: string | null;
        paymentMethodId: string | null;
        responsible: string | null;
      }>();
      let generated = 0;
      for (const rule of rules.results) {
        let occurrenceDate = rule.nextDate;
        let iterations = 0;
        while (
          occurrenceDate <= throughDate &&
          (!rule.endDate || occurrenceDate <= rule.endDate) &&
          generated < 36 &&
          iterations < 36
        ) {
          const cardStatementId =
            rule.kind !== 'transfer' && rule.accountId
              ? await ensureOpenCardStatement(
                  db,
                  user.userId,
                  rule.accountId,
                  occurrenceDate,
                )
              : null;
          const result = await db
            .prepare(
              `INSERT OR IGNORE INTO transactions (
                id, owner_id, kind, title, notes, amount_cents, date, status,
                category_id, account_id, destination_account_id,
                payment_method_id, responsible, recurrence_id,
                recurrence_occurrence_date, card_statement_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              crypto.randomUUID(),
              user.userId,
              rule.kind,
              rule.title,
              rule.notes,
              rule.amountCents,
              occurrenceDate,
              transactionStatuses.has(rule.occurrenceStatus)
                ? rule.occurrenceStatus
                : 'pending',
              rule.categoryId,
              rule.accountId,
              rule.destinationAccountId,
              rule.paymentMethodId,
              rule.responsible,
              rule.ruleId,
              occurrenceDate,
              cardStatementId,
            )
            .run();
          generated += Number(result.meta.changes ?? 0);
          occurrenceDate = advanceRecurrenceDate(
            occurrenceDate,
            rule.frequency,
            rule.interval,
            rule.anchorDate,
          );
          iterations += 1;
        }
        await db
          .prepare(
            `UPDATE recurrence_rules SET next_date = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND owner_id = ?`,
          )
          .bind(occurrenceDate, rule.ruleId, user.userId)
          .run();
      }
      return json({ generated });
    }

    if (action === 'import-transactions') {
      if (!Array.isArray(body.rows) || body.rows.length === 0) {
        throw new HttpError('Nenhuma linha válida para importar.');
      }
      if (body.rows.length > 1000) {
        throw new HttpError('Importe no máximo 1.000 linhas por vez.');
      }
      const sourceName = optionalString(body.sourceName, 160);
      const [categoryRows, accountRows, paymentRows] = await db.batch([
        db
          .prepare('SELECT id FROM categories WHERE owner_id = ?')
          .bind(user.userId),
        db
          .prepare('SELECT id FROM accounts WHERE owner_id = ?')
          .bind(user.userId),
        db
          .prepare('SELECT id FROM payment_methods WHERE owner_id = ?')
          .bind(user.userId),
      ]);
      const ownedCategories = new Set(
        categoryRows.results.map((row) => String((row as { id: string }).id)),
      );
      const ownedAccounts = new Set(
        accountRows.results.map((row) => String((row as { id: string }).id)),
      );
      const ownedPayments = new Set(
        paymentRows.results.map((row) => String((row as { id: string }).id)),
      );
      const sanitized = await Promise.all(
        body.rows.map(async (candidate) => {
          if (!candidate || typeof candidate !== 'object')
            throw new HttpError('Linha de importação inválida.');
          const row = candidate as Record<string, unknown>;
          const kind = requiredString(row.kind, 'Grupo', 20);
          const title = requiredString(row.title, 'Descrição');
          const date = validDate(row.date);
          const status = requiredString(row.status, 'Status', 20);
          const amountCents = positiveInteger(row.amountCents, 'Valor');
          if (!transactionKinds.has(kind) || !transactionStatuses.has(status)) {
            throw new HttpError(
              'Uma ou mais linhas contêm grupo ou status inválido.',
            );
          }
          const categoryId = optionalString(row.categoryId, 80);
          const accountId = optionalString(row.accountId, 80);
          const paymentMethodId = optionalString(row.paymentMethodId, 80);
          return {
            id: crypto.randomUUID(),
            kind,
            title,
            date,
            status,
            amountCents,
            categoryId:
              categoryId && ownedCategories.has(categoryId) ? categoryId : null,
            accountId:
              accountId && ownedAccounts.has(accountId) ? accountId : null,
            paymentMethodId:
              paymentMethodId && ownedPayments.has(paymentMethodId)
                ? paymentMethodId
                : null,
            fingerprint: await fingerprint(
              `${date}|${kind}|${title.toLowerCase()}|${amountCents}`,
            ),
          };
        }),
      );

      let imported = 0;
      for (let offset = 0; offset < sanitized.length; offset += 40) {
        const chunk = sanitized.slice(offset, offset + 40);
        const statements: D1PreparedStatement[] = [];
        for (const row of chunk) {
          statements.push(
            db
              .prepare(
                `INSERT INTO transactions (
                  id, owner_id, kind, title, amount_cents, date, status,
                  category_id, account_id, payment_method_id
                )
                SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                WHERE NOT EXISTS (
                  SELECT 1 FROM import_fingerprints WHERE owner_id = ? AND fingerprint = ?
                )`,
              )
              .bind(
                row.id,
                user.userId,
                row.kind,
                row.title,
                row.amountCents,
                row.date,
                row.status,
                row.categoryId,
                row.accountId,
                row.paymentMethodId,
                user.userId,
                row.fingerprint,
              ),
            db
              .prepare(
                `INSERT OR IGNORE INTO import_fingerprints
                  (id, owner_id, fingerprint, source_name) VALUES (?, ?, ?, ?)`,
              )
              .bind(
                crypto.randomUUID(),
                user.userId,
                row.fingerprint,
                sourceName,
              ),
          );
        }
        const results = await db.batch(statements);
        imported += results
          .filter((_, index) => index % 2 === 0)
          .reduce(
            (total, result) => total + Number(result.meta.changes ?? 0),
            0,
          );
      }
      return json({ imported, skipped: sanitized.length - imported });
    }

    throw new HttpError('Ação não reconhecida.');
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    console.error('finance.POST failed', error);
    return json({ error: 'Não foi possível concluir a operação.' }, 500);
  }
}
