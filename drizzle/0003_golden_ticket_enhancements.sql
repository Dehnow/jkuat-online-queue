CREATE TYPE "public"."debt_status" AS ENUM('pending', 'paid', 'waived');--> statement-breakpoint
CREATE TYPE "public"."service_log_status" AS ENUM('served', 'cancelled');--> statement-breakpoint
ALTER TABLE "queue_entries" ADD COLUMN "claimed_at" timestamp;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD COLUMN "staff_confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD COLUMN "cancelled_by_staff" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD COLUMN "golden_penalty_applied" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_debts" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"amount" integer DEFAULT 2000 NOT NULL,
	"reason" text NOT NULL,
	"golden_ticket_ref" text,
	"created_at" timestamp DEFAULT now(),
	"paid_at" timestamp,
	"status" "debt_status" DEFAULT 'pending' NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"office_id" integer NOT NULL,
	"queue_entry_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"queue_number" integer NOT NULL,
	"service_type" "service_type" NOT NULL,
	"is_golden" boolean DEFAULT false NOT NULL,
	"golden_ticket_ref" text,
	"status" "service_log_status" NOT NULL,
	"served_at" timestamp,
	"cancelled_at" timestamp,
	"cancelled_by_staff" boolean DEFAULT false NOT NULL,
	"staff_id" integer,
	"created_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_debts_student_id_status_idx" on "student_debts" ("student_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_log_office_id_served_at_idx" on "service_log" ("office_id","served_at");
