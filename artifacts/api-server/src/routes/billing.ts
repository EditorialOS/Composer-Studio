// Billing routes — a Stripe-shaped scaffold. The plan catalog and per-org
// subscription state are real and durable; the checkout / portal / webhook
// flows are stubs that honestly report "not configured" until STRIPE_SECRET_KEY
// (and STRIPE_WEBHOOK_SECRET) are set and the Stripe calls are filled in.
//
// Express 5: mount-relative paths ("/billing/...") — the parent app mounts the
// router at "/api", so these resolve as /api/billing/*.

import { Router, type Request, type Response } from 'express';
import { authenticate } from './rest.js';
import { getPlan, getSubscription, PLANS, stripeConfigured } from '../engine/billing.js';

const router = Router();

function unauthorized(res: Response): void {
  res.status(401).json({ error: 'unauthorized', message: 'Send Authorization: Bearer <key>.' });
}

function notConfigured(res: Response): void {
  res.status(501).json({
    error: 'billing_not_configured',
    message: 'Billing is not configured. Set STRIPE_SECRET_KEY (and the STRIPE_PRICE_* env vars) to enable checkout.',
  });
}

// GET /billing/plans — the public plan catalog + whether billing is live.
router.get('/billing/plans', async (req, res) => {
  const auth = await authenticate(req);
  if (!auth) {
    unauthorized(res);
    return;
  }
  res.json({ plans: PLANS, stripeConfigured: stripeConfigured() });
});

// GET /billing/subscription — the caller's current subscription + plan detail.
router.get('/billing/subscription', async (req, res) => {
  const auth = await authenticate(req);
  if (!auth) {
    unauthorized(res);
    return;
  }
  const subscription = await getSubscription(auth.orgId);
  res.json({ subscription, plan: getPlan(subscription.plan) ?? null, stripeConfigured: stripeConfigured() });
});

// POST /billing/checkout {plan} — create a Stripe Checkout session. Stub until wired.
router.post('/billing/checkout', async (req, res) => {
  const auth = await authenticate(req);
  if (!auth) {
    unauthorized(res);
    return;
  }
  const planId = typeof (req.body as { plan?: unknown })?.plan === 'string' ? (req.body as { plan: string }).plan : '';
  const plan = getPlan(planId);
  if (!plan || plan.id === 'free') {
    res.status(400).json({ error: 'bad_request', message: 'plan must be one of: pro, scale.' });
    return;
  }
  if (!stripeConfigured()) {
    notConfigured(res);
    return;
  }
  // Stripe wiring pending: create a Checkout Session for process.env[plan.stripePriceEnv],
  // keyed to auth.orgId, and return { url }. Until then this is an honest stub.
  res.status(501).json({
    error: 'not_implemented',
    message: `Stripe checkout for the ${plan.name} plan is scaffolded but not yet wired.`,
    plan: plan.id,
    orgId: auth.orgId,
  });
});

// POST /billing/portal — Stripe billing portal session. Stub until wired.
router.post('/billing/portal', async (req, res) => {
  const auth = await authenticate(req);
  if (!auth) {
    unauthorized(res);
    return;
  }
  if (!stripeConfigured()) {
    notConfigured(res);
    return;
  }
  res.status(501).json({
    error: 'not_implemented',
    message: 'Stripe billing portal is scaffolded but not yet wired.',
    orgId: auth.orgId,
  });
});

// POST /billing/webhook — Stripe event receiver (no Bearer auth; Stripe signs it).
// Stub: real handling needs the raw body + STRIPE_WEBHOOK_SECRET signature check,
// then setSubscription(...) on subscription lifecycle events.
router.post('/billing/webhook', (_req, res) => {
  if (!process.env['STRIPE_WEBHOOK_SECRET']) {
    res.status(501).json({ error: 'billing_not_configured', message: 'Set STRIPE_WEBHOOK_SECRET to receive Stripe webhooks.' });
    return;
  }
  // Signature verification + event handling pending.
  res.json({ received: true, handled: false });
});

export default router;
