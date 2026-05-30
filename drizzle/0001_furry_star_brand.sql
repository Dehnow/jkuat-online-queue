CREATE TYPE "public"."mpesa_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
ALTER TABLE "queue_entries" ADD COLUMN "is_golden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD COLUMN "golden_ticket_ref" text;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD COLUMN "mpesa_transaction_id" text;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD COLUMN "mpesa_status" "mpesa_status";--> statement-breakpoint
ALTER TABLE "queue_entries" ADD COLUMN "mpesa_paid_at" timestamp;