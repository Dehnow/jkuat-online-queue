CREATE TYPE "public"."message_type" AS ENUM('feedback', 'admin_request', 'admin_response');--> statement-breakpoint
CREATE TYPE "public"."office_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('registrar', 'finance', 'ict_helpdesk');--> statement-breakpoint
CREATE TYPE "public"."queue_status" AS ENUM('waiting', 'serving', 'served', 'cancelled');--> statement-breakpoint
CREATE TABLE "admin_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"office_id" integer,
	"staff_username" text NOT NULL,
	"request_type" text NOT NULL,
	"request_data" text,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "feedback_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"office_id" integer NOT NULL,
	"staff_username" text NOT NULL,
	"message_type" "message_type" NOT NULL,
	"message" text NOT NULL,
	"response" text,
	"responded_by" text,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "offices" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"service_type" "service_type" NOT NULL,
	"status" "office_status" DEFAULT 'open' NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"created_by" text,
	CONSTRAINT "offices_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "queue_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"student_id" text NOT NULL,
	"service_type" "service_type" NOT NULL,
	"queue_number" integer NOT NULL,
	"status" "queue_status" DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"served_at" timestamp,
	"office_id" integer
);
--> statement-breakpoint
CREATE TABLE "staff_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"office_id" integer NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"has_admin_privilege" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"created_by" text,
	CONSTRAINT "staff_accounts_username_unique" UNIQUE("username")
);
