// Composer Studio persistence — one table per store collection. Each row
// keeps the query keys (id / org_id / package_id / created_at) as real
// columns and stores the rich engine object as jsonb `data`. This is a
// faithful lift-and-shift of the id/org-keyed in-memory store onto durable
// Postgres, without coupling lib/db to the api-server's domain types.

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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

// Per-customer API keys. Only the SHA-256 hash of the raw key is stored;
// the plaintext key is shown once at mint time and never persisted. Each
// key maps a Bearer token to an org (tenant), enabling real multi-tenancy
// in place of the single shared COMPOSER_API_KEY.
export const composerApiKeys = pgTable(
  "composer_api_keys",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    keyHash: text("key_hash").notNull(),
    label: text("label").notNull().default("default"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revoked: boolean("revoked").notNull().default(false),
  },
  (t) => [
    uniqueIndex("composer_api_keys_hash_idx").on(t.keyHash),
    index("composer_api_keys_org_idx").on(t.orgId),
  ],
);
