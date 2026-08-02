// Mock mode — COMPOSER_MOCK=1 makes the engine fully runnable with zero
// real API keys. Every external dependency resolves through the adapter
// seam (engine/) which ships mock implementations with rich fixtures.

export function isMockMode(): boolean {
  return process.env['COMPOSER_MOCK'] === '1';
}

export const MOCK_WORKSPACE = {
  orgId: 'demo-org',
  orgName: 'Demo Publication',
  userId: 'demo-user',
} as const;
