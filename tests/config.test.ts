import { describe, expect, it } from "vitest";
import { getConfig, parseKeyValuePairs, resolveOtlpEndpoint } from "../src/config.js";

describe("config", () => {
  it("parses key value headers", () => {
    expect(parseKeyValuePairs("Authorization=Bearer abc, x-scope = dev ")).toEqual({
      Authorization: "Bearer abc",
      "x-scope": "dev",
    });
  });

  it("provides sane defaults", () => {
    const config = getConfig({});

    expect(config.enabled).toBe(true);
    expect(config.privacy.profile).toBe("detailed-with-redaction");
    expect(config.privacy.payloadMaxBytes).toBe(32 * 1024);
    expect(config.traces.exporter).toBe("otlp");
    expect(config.traces.endpoint).toBe("http://localhost:4318/v1/traces");
    expect(config.metrics.exporters).toEqual(["otlp"]);
    expect(config.metrics.endpoint).toBe("http://localhost:4318/v1/metrics");
    expect(config.metrics.exportIntervalMs).toBe(60_000);
    expect(config.traceUiBaseUrl).toBe("http://localhost:16686/trace");
  });

  it("supports strict profile and exporter override", () => {
    const config = getConfig({
      PI_OTEL_PRIVACY_PROFILE: "strict",
      PI_OTEL_TRACES_EXPORTER: "none",
      OTEL_METRICS_EXPORTER: "console,otlp",
    });

    expect(config.privacy.profile).toBe("strict");
    expect(config.traces.exporter).toBe("none");
    expect(config.metrics.exporters).toEqual(["console", "otlp"]);
  });

  it("uses explicit signal endpoints first", () => {
    const config = getConfig({
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://trace.example.com/custom-trace",
      OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "https://metric.example.com/custom-metric",
    });

    expect(config.traces.endpoint).toBe("https://trace.example.com/custom-trace");
    expect(config.metrics.endpoint).toBe("https://metric.example.com/custom-metric");
  });

  it("appends signal path when using base endpoint", () => {
    expect(resolveOtlpEndpoint("https://otel.example.com", "/v1/traces")).toBe("https://otel.example.com/v1/traces");
    expect(resolveOtlpEndpoint("https://otel.example.com/collector", "/v1/metrics")).toBe(
      "https://otel.example.com/collector/v1/metrics",
    );
    expect(resolveOtlpEndpoint("https://otel.example.com/v1/traces", "/v1/traces")).toBe(
      "https://otel.example.com/v1/traces",
    );
  });

  it("parses extra sensitive keys and path denylist", () => {
    const config = getConfig({
      PI_OTEL_REDACT_KEYS: "bearer_token,refreshToken",
      PI_OTEL_PATH_DENYLIST: "*.cert,private/keys/*",
    });

    expect(config.privacy.extraSensitiveKeys).toEqual(["bearer_token", "refreshToken"]);
    expect(config.privacy.pathDenylist).toEqual(
      expect.arrayContaining(["*.cert", "private/keys/*", ".env", "*.pem"]),
    );
  });
});
