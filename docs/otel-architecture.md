# OTel Architecture

## Scope

This project provides the following observability coverage for the Pi Coding Agent.

1. **Trace**: Causal analysis and latency/root-cause visibility across session/turn/tool execution
2. **Metrics**: Usage, cost, and performance trend analysis
3. **Diagnostics**: Health checks for the active telemetry pipeline

## High-level Flow

Pi Extension Events  
→ Trace/Metrics Processor  
→ OTLP Export (HTTP)  
→ OpenTelemetry Collector  
→ Backend (Jaeger/Tempo + Prometheus/Grafana)

Recommendation: operate separate endpoints for traces and metrics.

- traces: `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
- metrics: `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`
- fallback: `OTEL_EXPORTER_OTLP_ENDPOINT`

## Trace Model

Recommended span hierarchy:

- `pi.session`
  - `pi.agent`
    - `pi.turn`
      - `pi.tool:<tool-name>`

Recommended events:

- `input`
- `tool_call`
- `tool_result`
- `turn_end`
- `agent_end`
- `model_select`
- `session_compact`

Core principles:

- Create a tool span at `tool_call`, and close it at `tool_result`
- For orphan spans (missing end events), force-close at shutdown and mark as error
- Payload recording follows the privacy policy (see: [privacy-redaction.md](./privacy-redaction.md))

## Metrics Model

### Counters

- `pi.session.count`
- `pi.turn.count`
- `pi.tool_call.count`
- `pi.tool_result.count`
- `pi.prompt.count`
- `pi.token.usage` (`type=input|output|cache_read|cache_write`)
- `pi.cost.usage` (`type=input|output|cache_read|cache_write`)

### Histograms

- `pi.session.duration` (s)
- `pi.turn.duration` (s)
- `pi.tool.duration` (s)

## Event → Telemetry Mapping

| Pi Event | Trace | Metrics |
|---|---|---|
| `session_start` | `pi.session` span start | `pi.session.count += 1` |
| `input` | session span event `input` | `pi.prompt.count += 1` |
| `agent_start` | `pi.agent` span start | - |
| `turn_start` | `pi.turn` span start | `pi.turn.count += 1` |
| `tool_call` | `pi.tool:*` span start + `tool_call` event | `pi.tool_call.count += 1` |
| `tool_result` | tool span event + tool span end | `pi.tool_result.count += 1`, `pi.tool.duration.record(...)` |
| `turn_end` | turn span end | `pi.turn.duration.record(...)`, token/cost accumulation |
| `agent_end` | agent span end | - |
| `session_shutdown` | session span end | `pi.session.duration.record(...)` |

## Cardinality Policy

Metric labels allow only the following by default:

- `provider`, `model`, `tool.name`, `success`, `type`

Default disallow list (high cardinality):

- raw prompt
- raw command
- raw session/file path

Record detailed context separately in trace attributes/events.

## Harness Tracking Extensions (Planned)

For personal harness experiment tracking, the following attributes are allowed.

- `harness.run_id`
- `harness.scenario_id`
- `harness.variant`
- `harness.dataset_id`

Principles:

- Record only low-cardinality derived values in metrics
- Record detailed experiment context in traces
