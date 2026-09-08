import { env } from 'cloudflare:workers';

import { getSiteUser } from '@/lib/server-user';

const transactionKinds = new Set([
  'income',
  'expense',
  'investment',
  'transfer',
]);
const transactionStatuses = new Set(['paid', 'pending']);
const categoryKinds = new Set(['income', 'expense', 'investment']);

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function requiredString(value: unknown, field: string, maxLength = 160) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} é obrigatório.`);
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
    throw new Error(`${field} deve ser maior que zero.`);
  }
  return Number(value);
}

function isIsoDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
  );
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
            'INSERT INTO categories (id, owner_id, kind, name, color) VALUES (?, ?, ?, ?, ?)',
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
          'INSERT INTO accounts (id, owner_id, name, type, opening_balance_cents, currency) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(
          crypto.randomUUID(),
          ownerId,
          'Conta principal',
          'checking',
          0,
          'BRL',
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
            'INSERT INTO payment_methods (id, owner_id, name) VALUES (?, ?, ?)',
          )
          .bind(crypto.randomUUID(), ownerId, name),
      );
    }
  }
  if (statements.length) await db.batch(statements);
}

export async function GET() {
  const user = await getSiteUser();
  if (!user) return json({ error: 'Autenticação necessária.' }, 401);
  if (user.isLocalPreview) return json({ preview: true });

  try {
    await seedDefaults(user.userId);
    const db = env.DB;
    const [transactions, categories, accounts, paymentMethods, budgets, goals] =
      await db.batch([
        db
          .prepare(
            `SELECT id, kind, title, notes, amount_cents AS amountCents, date, status,
              category_id AS categoryId, account_id AS accountId,
              destination_account_id AS destinationAccountId,
              payment_method_id AS paymentMethodId, responsible
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
            `SELECT id, name, type, opening_balance_cents AS openingBalanceCents, currency
             FROM accounts WHERE owner_id = ? AND archived = 0 ORDER BY name`,
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
      ]);

    return json({
      transactions: transactions.results,
      categories: categories.results,
      accounts: accounts.results,
      paymentMethods: paymentMethods.results,
      budgets: budgets.results,
      goals: goals.results,
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
      const date = requiredString(body.date, 'Data', 10);
      const amountCents = positiveInteger(body.amountCents, 'Valor');

      if (!transactionKinds.has(kind)) throw new Error('Grupo inválido.');
      if (!transactionStatuses.has(status)) throw new Error('Status inválido.');
      if (!isIsoDate(date)) throw new Error('Data inválida.');

      const accountId = optionalString(body.accountId, 80);
      const destinationAccountId = optionalString(
        body.destinationAccountId,
        80,
      );
      if (
        kind === 'transfer' &&
        (!accountId ||
          !destinationAccountId ||
          accountId === destinationAccountId)
      ) {
        throw new Error('Informe contas de origem e destino diferentes.');
      }

      await db
        .prepare(
          `INSERT INTO transactions (
            id, owner_id, kind, title, notes, amount_cents, date, status,
            category_id, account_id, destination_account_id, payment_method_id, responsible
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            kind = excluded.kind, title = excluded.title, notes = excluded.notes,
            amount_cents = excluded.amount_cents, date = excluded.date,
            status = excluded.status, category_id = excluded.category_id,
            account_id = excluded.account_id,
            destination_account_id = excluded.destination_account_id,
            payment_method_id = excluded.payment_method_id,
            responsible = excluded.responsible, updated_at = CURRENT_TIMESTAMP
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
          optionalString(body.categoryId, 80),
          accountId,
          destinationAccountId,
          optionalString(body.paymentMethodId, 80),
          optionalString(body.responsible, 100),
          user.userId,
        )
        .run();
      return json({ id });
    }

    if (action === 'delete-transaction') {
      const id = requiredString(body.id, 'Lançamento', 80);
      await db
        .prepare('DELETE FROM transactions WHERE id = ? AND owner_id = ?')
        .bind(id, user.userId)
        .run();
      return json({ id });
    }

    if (action === 'toggle-status') {
      const id = requiredString(body.id, 'Lançamento', 80);
      const status = requiredString(body.status, 'Status', 20);
      if (!transactionStatuses.has(status)) throw new Error('Status inválido.');
      await db
        .prepare(
          'UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?',
        )
        .bind(status, id, user.userId)
        .run();
      return json({ id, status });
    }

    if (action === 'save-budget') {
      const categoryId = requiredString(body.categoryId, 'Categoria', 80);
      const month = requiredString(body.month, 'Mês', 7);
      const limitCents = positiveInteger(body.limitCents, 'Limite');
      if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Mês inválido.');
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
      if (dueDate && !isIsoDate(dueDate)) throw new Error('Prazo inválido.');
      await db
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
      return json({ id });
    }

    if (action === 'delete-goal') {
      const id = requiredString(body.id, 'Meta', 80);
      await db
        .prepare('DELETE FROM goals WHERE id = ? AND owner_id = ?')
        .bind(id, user.userId)
        .run();
      return json({ id });
    }

    if (action === 'save-category') {
      const id = crypto.randomUUID();
      const kind = requiredString(body.kind, 'Grupo', 20);
      if (!categoryKinds.has(kind)) throw new Error('Grupo inválido.');
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

    if (action === 'import-transactions') {
      if (!Array.isArray(body.rows) || body.rows.length === 0) {
        throw new Error('Nenhuma linha válida para importar.');
      }
      if (body.rows.length > 1000) {
        throw new Error('Importe no máximo 1.000 linhas por vez.');
      }

      const sourceName = optionalString(body.sourceName, 160);
      const sanitized = await Promise.all(
        body.rows.map(async (candidate) => {
          if (!candidate || typeof candidate !== 'object')
            throw new Error('Linha de importação inválida.');
          const row = candidate as Record<string, unknown>;
          const kind = requiredString(row.kind, 'Grupo', 20);
          const title = requiredString(row.title, 'Descrição');
          const date = requiredString(row.date, 'Data', 10);
          const status = requiredString(row.status, 'Status', 20);
          const amountCents = positiveInteger(row.amountCents, 'Valor');
          if (
            !transactionKinds.has(kind) ||
            !transactionStatuses.has(status) ||
            !isIsoDate(date)
          ) {
            throw new Error(
              'Uma ou mais linhas contêm grupo, status ou data inválidos.',
            );
          }
          return {
            id: crypto.randomUUID(),
            kind,
            title,
            date,
            status,
            amountCents,
            categoryId: optionalString(row.categoryId, 80),
            accountId: optionalString(row.accountId, 80),
            paymentMethodId: optionalString(row.paymentMethodId, 80),
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

    return json({ error: 'Ação não reconhecida.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dados inválidos.';
    return json({ error: message }, 400);
  }
}
