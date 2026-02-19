import type { PrivacyProfile } from "../types.js";
import type { Redactor } from "./redactor.js";

export interface SanitizedPayload {
  mode: PrivacyProfile;
  omitted: boolean;
  text?: string;
  bytes: number;
  originalBytes: number;
  truncated: boolean;
}

export interface PayloadPolicy {
  sanitize(value: unknown, options?: { path?: string }): SanitizedPayload;
  toAttributes(prefix: string, sanitized: SanitizedPayload): Record<string, string | number | boolean>;
}

export interface PayloadPolicyOptions {
  profile: PrivacyProfile;
  payloadMaxBytes: number;
  redactor: Redactor;
}

function safeSerialize(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "null";
  } catch {
    return '"[unserializable]"';
  }
}

function truncateUtf8(value: string, maxBytes: number): { text: string; bytes: number; truncated: boolean } {
  const fullBytes = Buffer.byteLength(value, "utf8");
  if (fullBytes <= maxBytes) {
    return { text: value, bytes: fullBytes, truncated: false };
  }

  let end = value.length;
  while (end > 0) {
    const slice = value.slice(0, end);
    const bytes = Buffer.byteLength(slice, "utf8");
    if (bytes <= maxBytes) {
      return { text: slice, bytes, truncated: true };
    }
    end -= 1;
  }

  return { text: "", bytes: 0, truncated: true };
}

export function createPayloadPolicy(options: PayloadPolicyOptions): PayloadPolicy {
  const profile = options.profile;
  const maxBytes = Math.max(1, options.payloadMaxBytes);

  return {
    sanitize(value: unknown, sanitizeOptions: { path?: string } = {}): SanitizedPayload {
      const path = sanitizeOptions.path;

      if (path && options.redactor.shouldSkipPath(path)) {
        return {
          mode: profile,
          omitted: true,
          text: undefined,
          bytes: 0,
          originalBytes: 0,
          truncated: false,
        };
      }

      const redacted = options.redactor.redact(value);
      const serialized = safeSerialize(redacted);
      const originalBytes = Buffer.byteLength(serialized, "utf8");

      if (profile === "strict") {
        return {
          mode: profile,
          omitted: false,
          text: undefined,
          bytes: originalBytes,
          originalBytes,
          truncated: false,
        };
      }

      const truncated = truncateUtf8(serialized, maxBytes);

      return {
        mode: profile,
        omitted: false,
        text: truncated.text,
        bytes: truncated.bytes,
        originalBytes,
        truncated: truncated.truncated,
      };
    },

    toAttributes(prefix: string, sanitized: SanitizedPayload): Record<string, string | number | boolean> {
      return {
        [`${prefix}.mode`]: sanitized.mode,
        [`${prefix}.omitted`]: sanitized.omitted,
        [`${prefix}.bytes`]: sanitized.bytes,
        [`${prefix}.original_bytes`]: sanitized.originalBytes,
        [`${prefix}.truncated`]: sanitized.truncated,
        [`${prefix}.text`]: sanitized.text ?? "",
      };
    },
  };
}
