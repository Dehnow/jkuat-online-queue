CREATE TYPE "service_type" AS ENUM('registrar', 'finance', 'ict_helpdesk');--> statement-breakpoint
CREATE TYPE "queue_status" AS ENUM('waiting', 'serving', 'served', 'cancelled');--> statement-breakpoint
CREATE TABLE "queue_entries" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"student_id" text NOT NULL,
	"service_type" "service_type" NOT NULL,
	"queue_number" integer NOT NULL,
	"status" "queue_status" DEFAULT 'waiting'::"queue_status" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"served_at" timestamp
);
