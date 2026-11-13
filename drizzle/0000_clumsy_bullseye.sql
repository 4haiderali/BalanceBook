CREATE TABLE `ledger_versions` (
	`owner` text NOT NULL,
	`revision` integer NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`reason` text NOT NULL,
	PRIMARY KEY(`owner`, `revision`)
);
