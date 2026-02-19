import { describe, expect, it } from "vitest";
import { createRedactor } from "../src/privacy/redactor.js";
import { createPayloadPolicy } from "../src/privacy/payload-policy.js";

describe("payload policy", () => {
  const redactor = createRedactor({
    extraSensitiveKeys: [],
    pathDenylist: ["*.pem"],
  });

  it("returns metadata only in strict mode", () => {
    const policy = createPayloadPolicy({
      profile: "strict",
      payloadMaxBytes: 1024,
      redactor,
    });

    const sanitized = policy.sanitize({ token: "abc" }, { path: "input.json" });

    expect(sanitized.mode).toBe("strict");
    expect(sanitized.text).toBeUndefined();
    expect(sanitized.bytes).toBeGreaterThan(0);
    expect(sanitized.truncated).toBe(false);
  });

  it("redacts and keeps payload in detailed mode", () => {
    const policy = createPayloadPolicy({
      profile: "detailed-with-redaction",
      payloadMaxBytes: 1024,
      redactor,
    });

    const sanitized = policy.sanitize({ token: "abc", ok: "yes" }, { path: "input.json" });

    expect(sanitized.mode).toBe("detailed-with-redaction");
    expect(sanitized.text).toContain("[redacted]");
    expect(sanitized.text).toContain("yes");
    expect(sanitized.truncated).toBe(false);
  });

  it("truncates when payload exceeds max bytes", () => {
    const policy = createPayloadPolicy({
      profile: "detailed-with-redaction",
      payloadMaxBytes: 20,
      redactor,
    });

    const sanitized = policy.sanitize({ data: "x".repeat(400) }, { path: "input.json" });

    expect(sanitized.truncated).toBe(true);
    expect(sanitized.originalBytes).toBeGreaterThan(20);
    expect(sanitized.bytes).toBeLessThanOrEqual(20);
  });

  it("omits content for denylisted path", () => {
    const policy = createPayloadPolicy({
      profile: "detailed-with-redaction",
      payloadMaxBytes: 1024,
      redactor,
    });

    const sanitized = policy.sanitize("CERT DATA", { path: "keys/server.pem" });

    expect(sanitized.omitted).toBe(true);
    expect(sanitized.text).toBeUndefined();
  });
});
