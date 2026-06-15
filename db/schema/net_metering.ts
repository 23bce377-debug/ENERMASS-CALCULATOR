import { pgTable, uuid, text, timestamp, jsonb, date } from "drizzle-orm/pg-core";

export const netMeteringApplications = pgTable("net_metering_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull(),
  discoms: text("discom_name").notNull(),
  consumerNumber: text("consumer_number").notNull(),
  currentStage: text("current_stage", {
    enum: ["feasibility", "registration", "inspection", "meter_change", "approved"]
  }).default("feasibility"),
  applicationDate: date("application_date"),
  registrationNumber: text("registration_number"),
  inspectionDate: date("inspection_date"),
  netMeterSerial: text("net_meter_serial"),
  commissioningCertUrl: text("commissioning_cert_url"),  // Supabase Storage
  documentUrls: jsonb("document_urls").default({}),
  estimatedCompletionDate: date("estimated_completion_date"),
  notes: text("notes"),
  lastUpdatedBy: uuid("last_updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
