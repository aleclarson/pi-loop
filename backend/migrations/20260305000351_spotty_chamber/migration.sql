CREATE TABLE `pi_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`owner` text NOT NULL,
	`repo` text NOT NULL,
	`pr_number` integer NOT NULL,
	`session_type` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
