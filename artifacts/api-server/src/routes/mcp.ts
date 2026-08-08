import { Router, type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { isMockMode, MOCK_WORKSPACE } from '../mock.js';
import { resolveOrgForKey } from '../engine/apikeys.js';
import {
  MCP_TOOL_DESCRIPTORS,
  toolCheckRights,
  toolComposeNewsletter,
  toolComposePackage,
  toolSearchAssets,
  toolSendPackage,
} from '../engine/mcp.js';

const router = Router();

// ── Auth ─────────────────────────────────────────────────────

async function authenticate(req: Request): Promise<{ orgId: string } | null> {
  const header = req.headers['authorization'] ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  if (!token) return null;

  // Mock mode: any non-empty key resolves the demo org.
  if (isMockMode()) {
    return { orgId: MOCK_WORKSPACE.orgId };
  }

  // Real mode: per-customer API keys (SHA-256 hashes in Postgres) take
  // precedence, so the same minted key works across REST and MCP.
  const orgFromDb = await resolveOrgForKey(token);
  if (orgFromDb) return { orgId: orgFromDb };

  // Fall back to the shared COMPOSER_API_KEY env var (admin / back-compat).
  const expected = process.env['COMPOSER_API_KEY'];
  if (expected && token === expected) {
    return { orgId: process.env['COMPOSER_MCP_ORG_ID'] ?? 'mcp-customer' };
  }
  return null;
}

function unauthorized(res: Response): void {
  res.status(401).json({
    jsonrpc: '2.0',
    error: {
      code: -32001,
      message: 'Unauthorized — send Authorization: Bearer <key>. In COMPOSER_MOCK=1 mode any non-empty key works.',
    },
    id: null,
  });
}

function textResult(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

// ── Server factory (request-scoped, stateless) ────────────────

function createServer(orgId: string): McpServer {
  const server = new McpServer({ name: 'composer-studio', version: '1.5.0' });

  server.registerTool(
    'search_assets',
    {
      description: MCP_TOOL_DESCRIPTORS[0].description,
      inputSchema: { query: z.string().min(1).describe('What to look for, e.g. "apple pictures".') },
    },
    async ({ query }) => textResult(await toolSearchAssets(query)),
  );

  server.registerTool(
    'compose_package',
    {
      description: MCP_TOOL_DESCRIPTORS[1].description,
      inputSchema: { brief: z.string().min(1).describe('The story brief — one line to a full draft.') },
    },
    async ({ brief }) => textResult(await toolComposePackage(brief, orgId)),
  );

  server.registerTool(
    'check_rights',
    {
      description: MCP_TOOL_DESCRIPTORS[2].description,
      inputSchema: { asset_id: z.string().min(1).describe('Asset id, e.g. "lib-apple-orchard-row".') },
    },
    async ({ asset_id }) => textResult(await toolCheckRights(asset_id)),
  );

  server.registerTool(
    'compose_newsletter',
    {
      description: MCP_TOOL_DESCRIPTORS[3].description,
      inputSchema: {
        edition: z.string().min(1).describe('The full newsletter edition — markdown headings, HR-separated, or Subject:-line structure.'),
      },
    },
    async ({ edition }) => textResult(await toolComposeNewsletter(edition, orgId)),
  );

  server.registerTool(
    'send_package',
    {
      description: MCP_TOOL_DESCRIPTORS[4].description,
      inputSchema: {
        package_id: z.string().min(1).describe('Package id returned by compose_package.'),
        destination: z.enum(['beehiiv', 'cms', 'download']),
      },
    },
    async ({ package_id, destination }) => textResult(await toolSendPackage(package_id, destination)),
  );

  return server;
}

// ── GET /api/mcp — tool discovery, no auth ────────────────────

router.get('/mcp', (_req, res) => {
  res.json({
    name: 'composer-studio',
    version: '1.5.0',
    transport: 'streamable-http',
    auth: 'Bearer <key> — any non-empty key in COMPOSER_MOCK=1; set COMPOSER_API_KEY for production',
    mock: isMockMode(),
    tools: MCP_TOOL_DESCRIPTORS,
  });
});

// ── POST /api/mcp — MCP Streamable HTTP ──────────────────────

router.post('/mcp', async (req, res) => {
  const auth = await authenticate(req);
  if (!auth) {
    unauthorized(res);
    return;
  }

  const server = createServer(auth.orgId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — one request in, one response out
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', detail: String(err) });
    }
  } finally {
    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
  }
});

export default router;
