// Composer Studio persistence — one table per store collection. Each row
// keeps the query keys (id / org_id / package_id / created_at) as real
// columns and stores the rich engine object as jsonb `data`. This is a
// faithful lift-and-shift of the id/org-keyed in-memory store onto durable
// Postgres, without coupling lib/db to the api-server's domain types.

import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const composerPackages = pgTable(
  "composer_packages",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    data: jsonb("data").notNull(),
  },
  (t) => [index("composer_packages_org_created_idx").on(t.orgId, t.createdAt)],
);

export const composerEditions = pgTable(
  "composer_editions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    data: jsonb("data").notNull(),
  },
  (t) => [index("composer_editions_org_created_idx").on(t.orgId, t.createdAt)],
);

export const composerMemory = pgTable(
  "composer_memory",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    data: jsonb("data").notNull(),
  },
  (t) => [index("composer_memory_org_created_idx").on(t.orgId, t.createdAt)],
);

export const composerSends = pgTable(
  "composer_sends",
  {
    id: text("id").primaryKey(),
    packageId: text("package_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    data: jsonb("data").notNull(),
  },
  (t) => [index("composer_sends_package_idx").on(t.packageId)],
);

export const composerWorkspaces = pgTable("composer_workspaces", {
  orgId: text("org_id").primaryKey(),
  data: jsonb("data").notNull(),
});
