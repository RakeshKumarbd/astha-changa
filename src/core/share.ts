// Share codes for rule sets: only the rules that differ from the defaults, as
// JSON, compressed when the platform can, then base64url so it fits in a link.
//   "z…" = deflate-raw compressed JSON, "j…" = plain JSON (fallback).

import { DEFAULT_RULES, RULES_VERSION, migrateRules, type RuleConfig } from './state';

export interface SharedRules {
  name: string;
  rules: RuleConfig;
}

const MAX_NAME = 40;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** The fields that differ from the defaults (always including the version). */
function diff(rules: RuleConfig): Partial<RuleConfig> {
  const out: Record<string, unknown> = { rulesVersion: RULES_VERSION };
  for (const [k, v] of Object.entries(rules)) {
    if (JSON.stringify(v) !== JSON.stringify(DEFAULT_RULES[k as keyof RuleConfig])) out[k] = v;
  }
  return out as Partial<RuleConfig>;
}

export async function encodeRules(name: string, rules: RuleConfig): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify({ n: name.slice(0, MAX_NAME), r: diff(rules) }));
  if (typeof CompressionStream === 'function') return 'z' + toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
  return 'j' + toBase64Url(json);
}

/** Returns null for anything that isn't a valid code; never throws. */
export async function decodeRules(code: string): Promise<SharedRules | null> {
  try {
    const kind = code.trim()[0];
    let bytes = fromBase64Url(code.trim().slice(1));
    if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else if (kind !== 'j') return null;
    const data = JSON.parse(new TextDecoder().decode(bytes)) as { n?: unknown; r?: unknown };
    if (typeof data !== 'object' || data === null || typeof data.r !== 'object') return null;
    const name = typeof data.n === 'string' && data.n.trim() ? data.n.trim().slice(0, MAX_NAME) : 'Shared rules';
    return { name, rules: migrateRules({ ...DEFAULT_RULES, ...(data.r as object) }) };
  } catch {
    return null;
  }
}

/** Pull a share code out of a pasted link or a bare code. */
export function extractCode(text: string): string {
  const link = /[#&?]rules=([A-Za-z0-9_-]+)/.exec(text);
  if (link) return link[1]!;
  // A pasted share message: the code is the last long word starting with z or j.
  const words = text.match(/\b[zj][A-Za-z0-9_-]{16,}/g);
  return (words ? words[words.length - 1]! : text).trim();
}
