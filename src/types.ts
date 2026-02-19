export type PrivacyProfile = "strict" | "detailed-with-redaction";

export type TraceExporter = "none" | "otlp";
export type MetricsExporter = "none" | "console" | "otlp";

export interface TelemetryConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  traceUiBaseUrl: string;
  privacy: {
    profile: PrivacyProfile;
    payloadMaxBytes: number;
    extraSensitiveKeys: string[];
    pathDenylist: string[];
  };
  traces: {
    exporter: TraceExporter;
    endpoint: string;
    headers: Record<string, string>;
  };
  metrics: {
    exporters: MetricsExporter[];
    endpoint: string;
    headers: Record<string, string>;
    exportIntervalMs: number;
  };
}

export interface DurationStats {
  count: number;
  totalMs: number;
  lastMs: number;
}

export interface UsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

export interface CostTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

export interface TelemetryStatus {
  sessions: number;
  turns: number;
  toolCalls: number;
  toolResults: number;
  prompts: number;
  tokens: UsageTotals;
  cost: CostTotals;
  durations: {
    session: DurationStats;
    turn: DurationStats;
    tool: DurationStats;
  };
  provider: string;
  model: string;
  traceId?: string;
  lastError?: string;
}

export interface AssistantUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}
