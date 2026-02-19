import { describe, expect, it } from "vitest";
import { formatOtelStatus } from "../src/diagnostics/status-command.js";

describe("status command", () => {
  it("formats runtime snapshot", () => {
    const text = formatOtelStatus({
      enabled: true,
      privacyProfile: "detailed-with-redaction",
      traceExporter: "otlp",
      metricsExporters: ["otlp", "console"],
      traceEndpoint: "http://localhost:4318/v1/traces",
      metricsEndpoint: "http://localhost:4318/v1/metrics",
      status: {
        sessions: 1,
        turns: 2,
        toolCalls: 3,
        toolResults: 3,
        prompts: 2,
        tokens: { input: 100, output: 20, cacheRead: 3, cacheWrite: 2, total: 125 },
        cost: { input: 0.01, output: 0.002, cacheRead: 0.0001, cacheWrite: 0.0002, total: 0.0123 },
        durations: {
          session: { count: 1, totalMs: 1000, lastMs: 1000 },
          turn: { count: 2, totalMs: 700, lastMs: 350 },
          tool: { count: 3, totalMs: 120, lastMs: 40 },
        },
        provider: "anthropic",
        model: "claude-sonnet",
        traceId: "trace-id",
      },
    });

    expect(text).toContain("OTel Telemetry Status");
    expect(text).toContain("Enabled: yes");
    expect(text).toContain("Privacy: detailed-with-redaction");
    expect(text).toContain("Sessions: 1");
    expect(text).toContain("Tool calls/results: 3/3");
    expect(text).toContain("Trace ID: trace-id");
  });
});
