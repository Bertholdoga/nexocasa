CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`opening_balance_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_owner_name_unique` ON `accounts` (`owner_id`,`name`);--> statement-breakpoint
CREATE INDEX `accounts_owner_idx` ON `accounts` (`owner_id`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`transaction_id` text,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attachments_owner_transaction_idx` ON `attachments` (`owner_id`,`transaction_id`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`month` text NOT NULL,
	`category_id` text NOT NULL,
	`limit_cents` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_owner_month_category_unique` ON `budgets` (`owner_id`,`month`,`category_id`);--> statement-breakpoint
CREATE INDEX `budgets_owner_month_idx` ON `budgets` (`owner_id`,`month`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#14b8a6' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_owner_kind_name_unique` ON `categories` (`owner_id`,`kind`,`name`);--> statement-breakpoint
CREATE INDEX `categories_owner_kind_idx` ON `categories` (`owner_id`,`kind`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`target_cents` integer NOT NULL,
	`current_cents` integer DEFAULT 0 NOT NULL,
	`due_date` text,
	`color` text DEFAULT '#f59e0b' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `goals_owner_idx` ON `goals` (`owner_id`);--> statement-breakpoint
CREATE TABLE `import_fingerprints` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`source_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_fingerprints_owner_value_unique` ON `import_fingerprints` (`owner_id`,`fingerprint`);--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_methods_owner_name_unique` ON `payment_methods` (`owner_id`,`name`);--> statement-breakpoint
CREATE INDEX `payment_methods_owner_idx` ON `payment_methods` (`owner_id`);--> statement-breakpoint
CREATE TABLE `recurrence_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`source_transaction_id` text NOT NULL,
	`frequency` text NOT NULL,
	`interval` integer DEFAULT 1 NOT NULL,
	`next_date` text NOT NULL,
	`end_date` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recurrence_owner_next_idx` ON `recurrence_rules` (`owner_id`,`next_date`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`amount_cents` integer NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`category_id` text,
	`account_id` text,
	`destination_account_id` text,
	`payment_method_id` text,
	`responsible` text,
	`recurrence_id` text,
	`attachment_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `transactions_owner_date_idx` ON `transactions` (`owner_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_owner_status_date_idx` ON `transactions` (`owner_id`,`status`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_owner_category_date_idx` ON `transactions` (`owner_id`,`category_id`,`date`);