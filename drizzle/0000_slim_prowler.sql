CREATE TABLE `custom_jobs` (
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`user_id`, `job_id`)
);
--> statement-breakpoint
CREATE TABLE `marks` (
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`saved` integer DEFAULT 0 NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`feedback_reason` text DEFAULT '' NOT NULL,
	`feedback_note` text DEFAULT '' NOT NULL,
	`updated` text NOT NULL,
	PRIMARY KEY(`user_id`, `job_id`)
);
