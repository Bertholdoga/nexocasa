import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    kind: text('kind', {
      enum: ['income', 'expense', 'investment'],
    }).notNull(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#14b8a6'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('categories_owner_kind_name_unique').on(
      table.ownerId,
      table.kind,
      table.name,
    ),
    index('categories_owner_kind_idx').on(table.ownerId, table.kind),
  ],
);

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['checking', 'savings', 'cash', 'investment', 'credit'],
    }).notNull(),
    openingBalanceCents: integer('opening_balance_cents').notNull().default(0),
    currency: text('currency').notNull().default('BRL'),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('accounts_owner_name_unique').on(table.ownerId, table.name),
    index('accounts_owner_idx').on(table.ownerId),
  ],
);

export const paymentMethods = sqliteTable(
  'payment_methods',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('payment_methods_owner_name_unique').on(
      table.ownerId,
      table.name,
    ),
    index('payment_methods_owner_idx').on(table.ownerId),
  ],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    kind: text('kind', {
      enum: ['income', 'expense', 'investment', 'transfer'],
    }).notNull(),
    title: text('title').notNull(),
    notes: text('notes'),
    amountCents: integer('amount_cents').notNull(),
    date: text('date').notNull(),
    status: text('status', { enum: ['paid', 'pending'] }).notNull(),
    categoryId: text('category_id'),
    accountId: text('account_id'),
    destinationAccountId: text('destination_account_id'),
    paymentMethodId: text('payment_method_id'),
    responsible: text('responsible'),
    recurrenceId: text('recurrence_id'),
    attachmentKey: text('attachment_key'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('transactions_owner_date_idx').on(table.ownerId, table.date),
    index('transactions_owner_status_date_idx').on(
      table.ownerId,
      table.status,
      table.date,
    ),
    index('transactions_owner_category_date_idx').on(
      table.ownerId,
      table.categoryId,
      table.date,
    ),
  ],
);

export const budgets = sqliteTable(
  'budgets',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    month: text('month').notNull(),
    categoryId: text('category_id').notNull(),
    limitCents: integer('limit_cents').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('budgets_owner_month_category_unique').on(
      table.ownerId,
      table.month,
      table.categoryId,
    ),
    index('budgets_owner_month_idx').on(table.ownerId, table.month),
  ],
);

export const goals = sqliteTable(
  'goals',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull(),
    targetCents: integer('target_cents').notNull(),
    currentCents: integer('current_cents').notNull().default(0),
    dueDate: text('due_date'),
    color: text('color').notNull().default('#f59e0b'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('goals_owner_idx').on(table.ownerId)],
);

export const recurrenceRules = sqliteTable(
  'recurrence_rules',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    sourceTransactionId: text('source_transaction_id').notNull(),
    frequency: text('frequency', {
      enum: ['monthly', 'weekly', 'yearly'],
    }).notNull(),
    interval: integer('interval').notNull().default(1),
    nextDate: text('next_date').notNull(),
    endDate: text('end_date'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('recurrence_owner_next_idx').on(table.ownerId, table.nextDate),
  ],
);

export const importFingerprints = sqliteTable(
  'import_fingerprints',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    fingerprint: text('fingerprint').notNull(),
    sourceName: text('source_name'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('import_fingerprints_owner_value_unique').on(
      table.ownerId,
      table.fingerprint,
    ),
  ],
);

export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    transactionId: text('transaction_id'),
    objectKey: text('object_key').notNull(),
    fileName: text('file_name').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('attachments_owner_transaction_idx').on(
      table.ownerId,
      table.transactionId,
    ),
  ],
);
