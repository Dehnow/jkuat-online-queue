import { pgTable, serial, text, timestamp, integer, pgEnum, boolean } from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("queue_status", ["waiting", "serving", "served", "cancelled"]);
export const serviceEnum = pgEnum("service_type", ["registrar", "finance", "ict_helpdesk"]);
export const officeStatusEnum = pgEnum("office_status", ["open", "closed"]);
export const messageTypeEnum = pgEnum("message_type", ["feedback", "admin_request", "admin_response"]);
export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "rejected"]);
export const mpesaStatusEnum = pgEnum("mpesa_status", ["pending", "success", "failed"]);
export const debtStatusEnum = pgEnum("debt_status", ["pending", "paid", "waived"]);
export const serviceLogStatusEnum = pgEnum("service_log_status", ["served", "cancelled"]);

export const queueEntries = pgTable("queue_entries", {
  id: serial().primaryKey(),
  name: text("name").notNull(),
  studentId: text("student_id").notNull(),
  serviceType: serviceEnum("service_type").notNull(),
  queueNumber: integer("queue_number").notNull(),
  status: statusEnum("status").notNull().default("waiting"),
  createdAt: timestamp("created_at").defaultNow(),
  servedAt: timestamp("served_at"),
  officeId: integer("office_id"),
  // Golden ticket fields
  isGolden: boolean("is_golden").notNull().default(false),
  goldenTicketRef: text("golden_ticket_ref"),
  canUpgradeToGolden: boolean("can_upgrade_to_golden").notNull().default(true), // Can only upgrade the most recent ticket
  mpesaTransactionId: text("mpesa_transaction_id"),
  mpesaStatus: mpesaStatusEnum("mpesa_status"),
  mpesaPaidAt: timestamp("mpesa_paid_at"),
  // Golden ticket claim & confirmation fields
  claimedAt: timestamp("claimed_at"),
  staffConfirmedAt: timestamp("staff_confirmed_at"),
  cancelledByStaff: boolean("cancelled_by_staff").notNull().default(false),
  goldenPenaltyApplied: boolean("golden_penalty_applied").notNull().default(false),
});

export const offices = pgTable("offices", {
  id: serial().primaryKey(),
  name: text("name").notNull(),
  serviceType: serviceEnum("service_type").notNull(),
  status: officeStatusEnum("status").notNull().default("open"),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
});

export const staffAccounts = pgTable("staff_accounts", {
  id: serial().primaryKey(),
  officeId: integer("office_id").notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  hasAdminPrivilege: boolean("has_admin_privilege").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
});

export const feedbackMessages = pgTable("feedback_messages", {
  id: serial().primaryKey(),
  officeId: integer("office_id").notNull(),
  staffUsername: text("staff_username").notNull(),
  messageType: messageTypeEnum("message_type").notNull(),
  message: text("message").notNull(),
  response: text("response"),
  respondedBy: text("responded_by"),
  status: requestStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
});

export const adminRequests = pgTable("admin_requests", {
  id: serial().primaryKey(),
  officeId: integer("office_id"),
  staffUsername: text("staff_username").notNull(),
  requestType: text("request_type").notNull(), // e.g., "create_office", "edit_office"
  requestData: text("request_data"), // JSON stringified data
  status: requestStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
});

export const studentDebts = pgTable("student_debts", {
  id: serial().primaryKey(),
  studentId: text("student_id").notNull(),
  amount: integer("amount").notNull().default(2000),
  reason: text("reason").notNull(),
  goldenTicketRef: text("golden_ticket_ref"),
  createdAt: timestamp("created_at").defaultNow(),
  paidAt: timestamp("paid_at"),
  status: debtStatusEnum("status").notNull().default("pending"),
});

export const serviceLog = pgTable("service_log", {
  id: serial().primaryKey(),
  officeId: integer("office_id").notNull(),
  queueEntryId: integer("queue_entry_id").notNull(),
  studentId: text("student_id").notNull(),
  queueNumber: integer("queue_number").notNull(),
  serviceType: serviceEnum("service_type").notNull(),
  isGolden: boolean("is_golden").notNull().default(false),
  goldenTicketRef: text("golden_ticket_ref"),
  status: serviceLogStatusEnum("status").notNull(),
  servedAt: timestamp("served_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledByStaff: boolean("cancelled_by_staff").notNull().default(false),
  staffId: integer("staff_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
