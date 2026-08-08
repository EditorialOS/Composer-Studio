#!/usr/bin/env node
// Mint a Composer Studio API key for a tenant (org).
//
//   DATABASE_URL=postgres://... node scripts/mint-api-key.mjs <orgId> [label]
//
// Prints the plaintext key ONCE — store it now; only its SHA-256 hash is
// persisted. Uses `pg` directly so it runs with plain node, no build step.

import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';

const orgId = process.argv[2];
const label = process.argv[3] ?? 'default';

if (!orgId) {
  console.error('Usage: DATABASE_URL=... node scripts/mint-api-key.mjs <orgId> [label]');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const key = `cmp_live_${randomBytes(24).toString('hex')}`;
const keyHash = createHash('sha256').update(key).digest('hex');
const id = `key-${randomBytes(8).toString('hex')}`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(
    `insert into composer_api_keys (id, org_id, key_hash, label, revoked)
     values ($1, $2, $3, $4, false)`,
    [id, orgId, keyHash, label],
  );
  console.log('✓ API key minted');
  console.log(`  org:   ${orgId}`);
  console.log(`  label: ${label}`);
  console.log(`  id:    ${id}`);
  console.log('');
  console.log('  Store this key now — it will not be shown again:');
  console.log(`  ${key}`);
} catch (err) {
  console.error('Failed to mint key:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
