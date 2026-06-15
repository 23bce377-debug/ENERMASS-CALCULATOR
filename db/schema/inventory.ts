import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const inventoryStates = [
  "in_warehouse",
  "in_transit",          // dispatched from warehouse, not yet site-confirmed
  "at_site",             // site supervisor confirmed receipt
  "installed",           // physically mounted/wired
  "commissioned",        // system live, material fully consumed
  "returned_to_warehouse",  // defective / excess return
  "scrapped",
] as const;

export const inventoryMovements = pgTable("inventory_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Drizzle references using type assertions or existing schemas.
  // We use string representations if the other schemas aren't fully defined in Drizzle here yet.
  itemId: uuid("item_id").notNull(), 
  projectId: uuid("project_id"),
  fromState: text("from_state"),     // null for initial stock receipt
  toState: text("to_state").notNull(),
  quantity: numeric("quantity").notNull(),
  movedBy: uuid("moved_by"),
  movedAt: timestamp("moved_at", { withTimezone: true }).defaultNow(),
  vehicleNumber: text("vehicle_number"),    // for in_transit moves
  driverContact: text("driver_contact"),
  siteReceivedBy: text("site_received_by"), // for at_site confirmation
  siteReceivedAt: timestamp("site_received_at", { withTimezone: true }),
  notes: text("notes"),
  // Immutability: movements are append-only. No updates. No deletes.
});
