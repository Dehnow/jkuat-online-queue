import { pgTable, serial, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("queue_status", ["waiting", "serving", "served", "cancelled"]);
export const serviceEnum = pgEnum("service_type", ["registrar", "finance", "ict_helpdesk"]);

export const queueEntries = pgTable("queue_entries", {
  id: serial().primaryKey(),
  name: text("name").notNull(),
  studentId: text("student_id").notNull(),
  serviceType: serviceEnum("service_type").notNull(),
  queueNumber: integer("queue_number").notNull(),
  status: statusEnum("status").notNull().default("waiting"),
  createdAt: timestamp("created_at").defaultNow(),
  servedAt: timestamp("served_at"),
});
