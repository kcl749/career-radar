CREATE TABLE `application_events` (
	`user_id` text NOT NULL,
	`application_id` text NOT NULL,
	`id` text NOT NULL,
	`stage` text NOT NULL,
	`date` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `application_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`source_job_id` text,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`applied_date` text,
	`current_stage` text DEFAULT '已投递' NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`next_due` text,
	`last_updated` text,
	`notes` text DEFAULT '' NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
