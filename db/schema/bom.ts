import { pgTable, uuid, text, integer, boolean, numeric } from "drizzle-orm/pg-core";

export const bomCategories = pgTable("bom_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(), // "DC Protection", "AC Protection", "Cables", etc.
  displayOrder: integer("display_order").notNull(),
  isOptional: boolean("is_optional").default(false),
});

export const bomTemplateItems = pgTable("bom_template_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id").references(() => bomCategories.id),
  skuCode: text("sku_code").notNull(),        // e.g., "DCDB-01", "MC4-PAIR-01"
  description: text("description").notNull(),
  unit: text("unit").notNull(),               // "units", "meters", "pairs"
  unitRateMin: numeric("unit_rate_min"),       // market floor rate ₹
  unitRateMax: numeric("unit_rate_max"),       // market ceiling rate ₹
  defaultRate: numeric("default_rate"),        // use midpoint as default
  qtyFormula: text("qty_formula"),            // e.g., "system_kw * 0.5" or "strings * 2"
  isSystemSurveyDependent: boolean("is_system_survey_dependent").default(false),
  notes: text("notes"),
});
