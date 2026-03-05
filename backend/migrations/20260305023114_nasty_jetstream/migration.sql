CREATE TABLE `pi_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`repo_owner` text NOT NULL,
	`repo_name` text NOT NULL,
	`pr_number` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
