/**
 * Remove private activity content and credentials from locally persisted logs.
 * Diagnostics remain useful for debugging without storing titles, descriptions,
 * transcripts, locations, email addresses, or OAuth/session secrets.
 */
const SENSITIVE_KEY = /^(?:title|description|notes|location|link|source_text|text|transcript|user_text|email|user_id|access_token|refresh_token|provider_token|provider_refresh_token|authorization|cookie|password|secret|token|code|query|api_key|apikey)$/i;

function redactString(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:eyJ[A-Za-z0-9_-]{10,}\.)[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]')
    .replace(/([?&](?:access_token|refresh_token|code|token|key|secret|password)=)[^&#\s]*/gi, '$1[REDACTED]')
    .replace(/\b(access_token|refresh_token|provider_token|authorization|client_secret|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
}

export function redactLogDetails(value: unknown, key?: string, depth = 0): unknown {
  const normalizedKey = key?.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[-\s]/g, '_').toLowerCase();
  if (normalizedKey && SENSITIVE_KEY.test(normalizedKey)) return '[REDACTED]';
  if (depth > 8) return '[TRUNCATED]';
  if (typeof value === 'string') return redactString(value);
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message), stack: value.stack ? redactString(value.stack) : undefined };
  }
  if (Array.isArray(value)) return value.map((item) => redactLogDetails(item, undefined, depth + 1));
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      result[childKey] = redactLogDetails(childValue, childKey, depth + 1);
    }
    return result;
  }
  return value;
}
