CREATE TABLE `ledger_blocks` (
	`owner` text NOT NULL,
	`hash` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`owner`, `hash`)
);
