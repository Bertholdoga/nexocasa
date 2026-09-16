CREATE TABLE `card_statements` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`card_account_id` text NOT NULL,
	`cycle_start` text NOT NULL,
	`cycle_end` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`closed_total_cents` integer,
	`closed_at` text,
	`paid_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_statements_owner_card_cycle_unique` ON `card_statements` (`owner_id`,`card_account_id`,`cycle_end`);--> statement-breakpoint
CREATE INDEX `card_statements_owner_due_idx` ON `card_statements` (`owner_id`,`due_date`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `closing_day` integer;--> statement-breakpoint
ALTER TABLE `accounts` ADD `due_day` integer;--> statement-breakpoint
ALTER TABLE `accounts` ADD `credit_limit_cents` integer;--> statement-breakpoint
ALTER TABLE `accounts` ADD `card_last_four` text;--> statement-breakpoint
ALTER TABLE `attachments` ADD `kind` text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `attachments` ADD `status` text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE `attachments` ADD `checksum_sha256` text;--> statement-breakpoint
ALTER TABLE `attachments` ADD `duration_seconds` integer;--> statement-breakpoint
ALTER TABLE `attachments` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `attachments` ADD `deleted_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `attachments_object_key_unique` ON `attachments` (`object_key`);--> statement-breakpoint
ALTER TABLE `recurrence_rules` ADD `anchor_date` text;--> statement-breakpoint
ALTER TABLE `recurrence_rules` ADD `occurrence_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `recurrence_rules` ADD `updated_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `recurrence_owner_source_unique` ON `recurrence_rules` (`owner_id`,`source_transaction_id`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `recurrence_occurrence_date` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `card_statement_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_owner_recurrence_occurrence_unique` ON `transactions` (`owner_id`,`recurrence_id`,`recurrence_occurrence_date`);--> statement-breakpoint
CREATE INDEX `transactions_owner_card_statement_idx` ON `transactions` (`owner_id`,`card_statement_id`);