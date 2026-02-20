import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { MetricsExporter, PrivacyProfile, TelemetryConfig, TraceExporter } from "./types.js";

const DEFAULT_SERVICE_NAME = "pi-opentelemetry";
const DEFAULT_TRACES_ENDPOINT = "http://localhost:4318/v1/traces";
const DEFAULT_METRICS_ENDPOINT = "http://localhost:4318/v1/metrics";
const DEFAULT_TRACE_UI_BASE = "http://localhost:16686/trace";

const DEFAULT_PATH_DENYLIST = [
  ".env",
  ".env.*",
  "*.pem",
  "*.key",
  "*.p12",
  "id_rsa",
  "id_ed25519",
];

function readEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  return env[`PI_${key}`] ?? env[key];
}

function asBool(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
  return defaultValue;
}

function asInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function splitComma(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeServiceName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[\/\s]+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");

  return normalized || DEFAULT_SERVICE_NAME;
}

function findNearestPackageName(startDir: string): string | undefined {
  let current = startDir;

  while (true) {
    const packageJsonPath = join(current, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: unknown };
        if (typeof parsed.name === "string" && parsed.name.trim().length > 0) {
          return parsed.name.trim();
        }
      } catch {
        // ignore invalid/unreadable package.json and continue upward
      }
    }

    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return undefined;
}

function resolveServiceName(env: NodeJS.ProcessEnv): string {
  const explicit = readEnv(env, "OTEL_SERVICE_NAME")?.trim();
  if (explicit) return explicit;

  const autoEnabled = asBool(readEnv(env, "OTEL_SERVICE_NAME_AUTO"), true);
  if (!autoEnabled) return DEFAULT_SERVICE_NAME;

  const projectRoot = readEnv(env, "OTEL_PROJECT_ROOT") ?? process.cwd();

  const packageName = findNearestPackageName(projectRoot);
  if (packageName) {
    return sanitizeServiceName(packageName);
  }

  return sanitizeServiceName(basename(projectRoot));
}

export function parseKeyValuePairs(raw: string | undefined): Record<string, string> {
  if (!raw) return {};

  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const [key, ...rest] = pair.split("=");
      if (!key || rest.length === 0) return acc;
      acc[key.trim()] = rest.join("=").trim();
      return acc;
    }, {});
}

export function resolveOtlpEndpoint(baseEndpoint: string, signalPath: "/v1/traces" | "/v1/metrics"): string {
  const normalized = baseEndpoint.replace(/\/+$/, "");
  if (normalized.endsWith(signalPath)) {
    return normalized;
  }

  return `${normalized}${signalPath}`;
}

function parsePrivacyProfile(value: string | undefined): PrivacyProfile {
  if (value === "strict") return "strict";
  return "detailed-with-redaction";
}

function parseTraceExporter(value: string | undefined): TraceExporter {
  if (value?.trim() === "none") return "none";
  return "otlp";
}

function parseMetricsExporters(value: string | undefined): MetricsExporter[] {
  const values = splitComma(value);
  if (values.length === 0) return ["otlp"];

  const allowed = new Set<MetricsExporter>(["none", "console", "otlp"]);
  const deduped: MetricsExporter[] = [];

  for (const item of values) {
    if (!allowed.has(item as MetricsExporter)) continue;
    const typed = item as MetricsExporter;
    if (!deduped.includes(typed)) deduped.push(typed);
  }

  return deduped.length > 0 ? deduped : ["otlp"];
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): TelemetryConfig {
  const baseEndpoint = readEnv(env, "OTEL_EXPORTER_OTLP_ENDPOINT");

  const tracesEndpoint =
    readEnv(env, "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT") ??
    (baseEndpoint ? resolveOtlpEndpoint(baseEndpoint, "/v1/traces") : DEFAULT_TRACES_ENDPOINT);

  const metricsEndpoint =
    readEnv(env, "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT") ??
    (baseEndpoint ? resolveOtlpEndpoint(baseEndpoint, "/v1/metrics") : DEFAULT_METRICS_ENDPOINT);

  return {
    enabled: asBool(readEnv(env, "OTEL_ENABLE"), true),
    serviceName: resolveServiceName(env),
    serviceVersion: readEnv(env, "OTEL_SERVICE_VERSION") ?? "0.1.3",
    traceUiBaseUrl: readEnv(env, "OTEL_TRACE_UI_BASE_URL") ?? DEFAULT_TRACE_UI_BASE,
    privacy: {
      profile: parsePrivacyProfile(readEnv(env, "OTEL_PRIVACY_PROFILE")),
      payloadMaxBytes: asInt(readEnv(env, "OTEL_PAYLOAD_MAX_BYTES"), 32 * 1024),
      extraSensitiveKeys: splitComma(readEnv(env, "OTEL_REDACT_KEYS")),
      pathDenylist: splitComma(readEnv(env, "OTEL_PATH_DENYLIST")).concat(DEFAULT_PATH_DENYLIST),
    },
    traces: {
      exporter: parseTraceExporter(readEnv(env, "OTEL_TRACES_EXPORTER")),
      endpoint: tracesEndpoint,
      headers: parseKeyValuePairs(readEnv(env, "OTEL_EXPORTER_OTLP_HEADERS")),
    },
    metrics: {
      exporters: parseMetricsExporters(readEnv(env, "OTEL_METRICS_EXPORTER")),
      endpoint: metricsEndpoint,
      headers: parseKeyValuePairs(readEnv(env, "OTEL_EXPORTER_OTLP_HEADERS")),
      exportIntervalMs: asInt(readEnv(env, "OTEL_METRIC_EXPORT_INTERVAL"), 60_000),
    },
  };
}
