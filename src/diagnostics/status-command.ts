import type { MetricsExporter, PrivacyProfile, TelemetryStatus, TraceExporter } from "../types.js";

export interface StatusSnapshot {
  enabled: boolean;
  serviceName: string;
  privacyProfile: PrivacyProfile;
  traceExporter: TraceExporter;
  metricsExporters: MetricsExporter[];
  traceEndpoint: string;
  metricsEndpoint: string;
  status: TelemetryStatus;
}

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatMs(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

export function formatOtelStatus(snapshot: StatusSnapshot): string {
  const { status } = snapshot;

  return [
    "OTel Telemetry Status",
    `Enabled: ${snapshot.enabled ? "yes" : "no"}`,
    `Service: ${snapshot.serviceName}`,
    `Privacy: ${snapshot.privacyProfile}`,
    `Trace exporter: ${snapshot.traceExporter}`,
    `Metrics exporters: ${snapshot.metricsExporters.join(", ")}`,
    `Trace endpoint: ${snapshot.traceEndpoint}`,
    `Metrics endpoint: ${snapshot.metricsEndpoint}`,
    `Model: ${status.provider}/${status.model}`,
    `Sessions: ${status.sessions}`,
    `Turns: ${status.turns}`,
    `Prompts: ${status.prompts}`,
    `Tool calls/results: ${status.toolCalls}/${status.toolResults}`,
    `Tokens total: ${status.tokens.total} (in=${status.tokens.input}, out=${status.tokens.output}, cache=${status.tokens.cacheRead}/${status.tokens.cacheWrite})`,
    `Cost total: ${formatUsd(status.cost.total)} (in=${formatUsd(status.cost.input)}, out=${formatUsd(status.cost.output)}, cache=${formatUsd(status.cost.cacheRead)}/${formatUsd(status.cost.cacheWrite)})`,
    `Duration last(session/turn/tool): ${formatMs(status.durations.session.lastMs)} / ${formatMs(status.durations.turn.lastMs)} / ${formatMs(status.durations.tool.lastMs)}`,
    `Trace ID: ${status.traceId ?? "(none)"}`,
    `Last error: ${status.lastError ?? "(none)"}`,
  ].join("\n");
}
