CREATE TABLE `auth_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `migration_imports` (
	`owner` text PRIMARY KEY NOT NULL,
	`backup_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`revision` integer NOT NULL
);
