// Billing scaffold. Defines the plan tiers, reads/writes per-org subscription
// state (Postgres when configured, in-memory otherwise), and exposes whether
// Stripe is wired. The actual Stripe calls live in routes/billing.ts and are
// intentionally stubbed until STRIPE_SECRET_KEY is set — this module is the
// durable, provider-agnostic core the integration will build on.

import { eq } from 'drizzle-orm';
import { loadDb, pgEnabled } from './db.js';

export type PlanId = 'free' | 'pro' | 'scale';
export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled';

export interface Plan {
  id: PlanId;
  name: string;
  priceUsdMonthly: number;
  composesPerDay: number;
  requestsPerMinute: number;
  seats: number;
  /** Env var holding the Stripe Price ID for this plan (set when wiring Stripe). */
  stripePriceEnv: string;
}

export const PLANS: Plan[] = [
  { id: 'free', name: 'Free', priceUsdMonthly: 0, composesPerDay: 20, requestsPerMinute: 30, seats: 1, stripePriceEnv: 'STRIPE_PRICE_FREE' },
  { id: 'pro', name: 'Pro', priceUsdMonthly: 49, composesPerDay: 200, requestsPerMinute: 60, seats: 5, stripePriceEnv: 'STRIPE_PRICE_PRO' },
  { id: 'scale', name: 'Scale', priceUsdMonthly: 199, composesPerDay: 2000, requestsPerMinute: 120, seats: 25, stripePriceEnv: 'STRIPE_PRICE_SCALE' },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/** True once a Stripe secret key is present — gates the checkout/portal flows. */
export function stripeConfigured(): boolean {
  return Boolean(process.env['STRIPE_SECRET_KEY']);
}

export interface Subscription {
  orgId: string;
  plan: PlanId;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
  updatedAt: string;
}

function freeSubscription(orgId: string): Subscription {
  return { orgId, plan: 'free', status: 'none', updatedAt: new Date().toISOString() };
}

// In-memory fallback when no database is provisioned.
const memSubs = new Map<string, Subscription>();

export async function getSubscription(orgId: string): Promise<Subscription> {
  if (pgEnabled()) {
    const { db, composerSubscriptions } = await loadDb();
    const [row] = await db
      .select()
      .from(composerSubscriptions)
      .where(eq(composerSubscriptions.orgId, orgId))
      .limit(1);
    if (!row) return freeSubscription(orgId);
    return {
      orgId: row.orgId,
      plan: (row.plan as PlanId) ?? 'free',
      status: (row.status as SubscriptionStatus) ?? 'none',
      stripeCustomerId: row.stripeCustomerId ?? undefined,
      stripeSubscriptionId: row.stripeSubscriptionId ?? undefined,
      currentPeriodEnd: row.currentPeriodEnd ? row.currentPeriodEnd.toISOString() : undefined,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
  return memSubs.get(orgId) ?? freeSubscription(orgId);
}

/** Upsert a subscription — the write path a Stripe webhook handler will call. */
export async function setSubscription(sub: Subscription): Promise<void> {
  const record = { ...sub, updatedAt: new Date().toISOString() };
  if (pgEnabled()) {
    const { db, composerSubscriptions } = await loadDb();
    const row = {
      orgId: record.orgId,
      plan: record.plan,
      status: record.status,
      stripeCustomerId: record.stripeCustomerId ?? null,
      stripeSubscriptionId: record.stripeSubscriptionId ?? null,
      currentPeriodEnd: record.currentPeriodEnd ? new Date(record.currentPeriodEnd) : null,
      updatedAt: new Date(record.updatedAt),
    };
    await db
      .insert(composerSubscriptions)
      .values(row)
      .onConflictDoUpdate({ target: composerSubscriptions.orgId, set: row });
    return;
  }
  memSubs.set(record.orgId, record);
}
