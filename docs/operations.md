# Operations & Diagnostics

## Runtime Modes

- **Trace only**: Focus on bottleneck/error root-cause analysis
- **Metrics only**: Focus on cost/usage dashboards
- **Unified (recommended)**: Trace + Metrics + Diagnostics

The default operating mode is Unified.

## Required Environment

```bash
# extension enable flag (use according to project policy)
export PI_OTEL_ENABLE=1

# traces endpoint
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces

# metrics endpoint
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics

# optional auth headers
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <token>"
```

## Personal Self-host Deployment (Recommended)

For always-on personal usage, run a local backend stack and access only web UIs via Tailscale.

- overview/policy: [self-host-local-tailscale.md](./self-host-local-tailscale.md)
- runnable compose/runbook: [../examples/self-host/README.md](../examples/self-host/README.md)

## Diagnostic Commands (Spec)

### `/otel-status`
Purpose: inspect the current telemetry pipeline status

Expected output includes:

- extension enabled state
- active exporter types
- trace/metrics endpoints
- cumulative session/turn/tool/prompt counts
- cumulative token/cost usage
- last session/turn/tool duration
- privacy profile (`strict` / `detailed-with-redaction`)
- last error (if present)

### `/otel-open-trace`
Purpose: generate/open the current session trace URL

Expected output includes:

- trace id
- primary trace URL (Jaeger/Tempo)
- remote-access URL (when available)

## Operational Checks

### Start-up checks
1. Verify endpoint validity
2. Verify exporter initialization success
3. Verify `session_start` event capture

### Continuous checks
1. Ensure orphan spans are not increasing due to missing `tool_result`
2. Ensure successful flush within the metrics export interval
3. Ensure there are no logs indicating redaction-application failure

## Failure Handling

- OTLP transmission failures must not interrupt agent execution.
- Transmission failures are recorded in internal state (`last error`) and logs.
- Retry behavior for transient failures follows the exporter default policy.

## Suggested Dashboards

1. Usage Overview
   - sessions/day, turns/day, prompts/day
2. Cost & Tokens
   - input/output/cache tokens, daily cost
3. Tool Reliability
   - tool success rate, p95 tool duration
4. Session Quality
   - turns per session, avg session duration
