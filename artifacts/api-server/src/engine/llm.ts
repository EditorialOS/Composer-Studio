// Editorial Director gate, backed by Claude. Called only when an Anthropic
// key is configured (per-workspace or env); every failure path returns null
// so the caller falls back to the heuristic evaluation. Uses the Messages
// API over fetch — consistent with the other real adapters (Cloudinary,
// Serper, Brave), which are all SDK-free.

import { GATE_NAMES, type GateEvaluation, type GateName, type GateStatus, type ParsedBrief, type WorkspaceContextData } from './types.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-opus-5';
const REQUEST_TIMEOUT_MS = 30_000;

export interface LlmConfig {
  apiKey: string;
  model: string;
}

/** Resolve an Anthropic config from workspace keys or env, or null if none. */
export function resolveLlm(keys?: { anthropicApiKey?: string; anthropicModel?: string }): LlmConfig | null {
  const apiKey = keys?.anthropicApiKey || process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) return null;
  const model = keys?.anthropicModel || process.env['COMPOSER_LLM_MODEL'] || DEFAULT_MODEL;
  return { apiKey, model };
}

const GATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    gates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          gate: { type: 'string', enum: [...GATE_NAMES] },
          status: { type: 'string', enum: ['pass', 'warn', 'fail'] },
          note: { type: 'string' },
        },
        required: ['gate', 'status', 'note'],
      },
    },
    verdictSummary: { type: 'string' },
    requiredRevisions: { type: 'array', items: { type: 'string' } },
    editorNote: { type: 'string' },
  },
  required: ['gates', 'verdictSummary', 'requiredRevisions', 'editorNote'],
} as const;

const SYSTEM_PROMPT = `You are the Editorial Director of a newsroom's content studio. A brief has been submitted for a content package. Evaluate it against exactly five gates, in this order:

1. "Theme alignment" — does it advance one of the workspace's active themes?
2. "Angle differentiation" — is the angle distinct from recent coverage?
3. "Audience need" — is the audience benefit demonstrated, not just assumed?
4. "Production reality" — is the scope realistic for the team's capacity?
5. "Calendar fit" — does it avoid clashing with scheduled items?

For each gate return status "pass", "warn", or "fail" and a one-sentence, specific note grounded in the workspace context you are given (name the theme, the overlapping coverage item, or the calendar clash where relevant). Then write a one-sentence verdictSummary, a short list of concrete requiredRevisions (empty if every gate passes), and a brief editorNote. Be a rigorous gatekeeper: warn or fail when the brief does not clearly earn a slot. Respond only with the structured object.`;

interface RawGate {
  gate?: unknown;
  status?: unknown;
  note?: unknown;
}

function coerceStatus(v: unknown): GateStatus {
  return v === 'pass' || v === 'warn' || v === 'fail' ? v : 'warn';
}

/**
 * Evaluate the five gates with Claude. Returns null on any failure (network,
 * non-2xx, refusal, malformed output) so the adapter can fall back cleanly.
 */
export async function evaluateGatesWithClaude(
  parsed: ParsedBrief,
  workspace: WorkspaceContextData,
  cfg: LlmConfig,
): Promise<GateEvaluation | null> {
  const userPayload = {
    brief: { headline: parsed.headline, kind: parsed.kind, keywords: parsed.searchTags },
    workspace: {
      activeThemes: workspace.activeThemes,
      recentCoverage: workspace.recentCoverage,
      calendar: workspace.calendar,
      voiceNotes: workspace.voiceNotes,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: GATE_SCHEMA } },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(userPayload) }],
      }),
    });
  } catch {
    return null; // network error or timeout
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) return null;

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null;
  }

  const b = body as { stop_reason?: string; content?: Array<{ type?: string; text?: string }> };
  if (b.stop_reason === 'refusal') return null;

  const textBlock = Array.isArray(b.content)
    ? b.content.find((blk) => blk?.type === 'text' && typeof blk.text === 'string')
    : undefined;
  if (!textBlock?.text) return null;

  let parsedOut: { gates?: RawGate[]; verdictSummary?: unknown; requiredRevisions?: unknown; editorNote?: unknown };
  try {
    parsedOut = JSON.parse(textBlock.text);
  } catch {
    return null;
  }
  if (!Array.isArray(parsedOut.gates) || parsedOut.gates.length === 0) return null;

  // Normalize to the five canonical gates in order, keyed by name.
  const byName = new Map<string, RawGate>();
  for (const g of parsedOut.gates) {
    if (g && typeof g.gate === 'string') byName.set(g.gate, g);
  }
  const gates: GateEvaluation['gates'] = GATE_NAMES.map((name: GateName) => {
    const g = byName.get(name);
    return {
      gate: name,
      status: coerceStatus(g?.status),
      note: typeof g?.note === 'string' && g.note.trim() ? g.note.trim() : 'No assessment returned for this gate.',
    };
  });

  const hasNonPass = gates.some((g) => g.status !== 'pass');
  const requiredRevisions = Array.isArray(parsedOut.requiredRevisions)
    ? parsedOut.requiredRevisions.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    : [];

  return {
    gates,
    verdict: hasNonPass ? 'REVISE' : 'APPROVED',
    verdictSummary:
      typeof parsedOut.verdictSummary === 'string' && parsedOut.verdictSummary.trim()
        ? parsedOut.verdictSummary.trim()
        : hasNonPass
          ? 'The brief needs revision before it earns a slot.'
          : 'All five gates pass against current workspace context.',
    requiredRevisions,
    editorNote:
      typeof parsedOut.editorNote === 'string' && parsedOut.editorNote.trim()
        ? `${parsedOut.editorNote.trim()} (Editorial Director via ${cfg.model}.)`
        : `Editorial Director evaluation via ${cfg.model}.`,
  };
}
