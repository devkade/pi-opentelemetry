const DEFAULT_SENSITIVE_KEYS = [
  "token",
  "api_key",
  "secret",
  "password",
  "authorization",
  "cookie",
  "session",
  "private_key",
];

const REDACTED = "[redacted]";

const DEFAULT_VALUE_PATTERNS = [
  /(^|\s)bearer\s+[a-z0-9\-_.=:+/]+/i,
  /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /^sk-[a-z0-9\-_]+$/i,
  /^(?:[A-Za-z0-9+/]{40,}={0,2})$/,
];

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export interface RedactorOptions {
  extraSensitiveKeys: string[];
  pathDenylist: string[];
}

export interface Redactor {
  redact(value: unknown): unknown;
  shouldSkipPath(path: string): boolean;
}

export function createRedactor(options: RedactorOptions): Redactor {
  const keyPatterns = DEFAULT_SENSITIVE_KEYS.concat(options.extraSensitiveKeys)
    .map((key) => key.trim())
    .filter(Boolean)
    .map((key) => new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

  const denyPatterns = options.pathDenylist.map((pattern) => wildcardToRegExp(pattern));

  const matchesSensitiveKey = (key: string) => keyPatterns.some((pattern) => pattern.test(key));

  const matchesSensitiveValue = (value: string) => DEFAULT_VALUE_PATTERNS.some((pattern) => pattern.test(value));

  const redactRecursive = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((entry) => redactRecursive(entry));
    }

    if (isPlainObject(value)) {
      const output: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value)) {
        if (matchesSensitiveKey(key)) {
          output[key] = REDACTED;
          continue;
        }
        output[key] = redactRecursive(entry);
      }
      return output;
    }

    if (typeof value === "string" && matchesSensitiveValue(value.trim())) {
      return REDACTED;
    }

    return value;
  };

  return {
    redact(value: unknown): unknown {
      return redactRecursive(value);
    },
    shouldSkipPath(path: string): boolean {
      return denyPatterns.some((pattern) => pattern.test(path));
    },
  };
}
