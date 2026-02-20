# Pi OpenTelemetry Extension

An extension for the [Pi coding agent](https://github.com/badlogic/pi-mono/) that adds production-ready usage observability:

- **Trace** (`session -> agent -> turn -> tool`)
- **Metrics** (session/turn/tool/prompt/token/cost/duration)
- **Diagnostics** (`/otel-status`, `/otel-open-trace`)
- **Privacy by default** (`detailed-with-redaction`)

```bash
pi -e ./src/index.ts "/otel-status"
```

## Why

When you run Pi at scale, you need more than logs:

- **Trace context** for "what happened in this session/turn/tool call"
- **Low-cardinality metrics** for trend and alerting
- **Fast diagnostics commands** for operator workflows
- **Safe payload collection** with redaction and denylist controls

This extension is designed to keep exporter failures non-blocking while preserving useful runtime visibility.

## Install

### From npm

```bash
pi install npm:@devkade/pi-opentelemetry
```

### From git

```bash
pi install git:github.com/devkade/pi-opentelemetry@main
# or pin a tag
pi install git:github.com/devkade/pi-opentelemetry@v0.1.0
```

### Local development run

```bash
pi -e ./src/index.ts
```

## Quick Start

### 1) Configure exporter endpoints

```bash
# enable/disable (default: true)
export PI_OTEL_ENABLE=1

# traces
export OTEL_TRACES_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces

# metrics (default exporter: otlp)
export OTEL_METRICS_EXPORTER=otlp,console
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics
export OTEL_METRIC_EXPORT_INTERVAL=10000

# optional auth headers
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <token>"

# privacy profile (default: detailed-with-redaction)
export PI_OTEL_PRIVACY_PROFILE=detailed-with-redaction
export PI_OTEL_PAYLOAD_MAX_BYTES=32768
```

> Any key above can be provided as both `<KEY>` and `PI_<KEY>`.

### 2) Run diagnostics commands

```txt
/otel-status      # show current telemetry runtime and counters
/otel-open-trace  # print/open current trace URL
```

### 3) (Recommended) run a local self-host backend

```bash
cd examples/self-host
docker compose up -d
```

Then set Pi exporter env:

```bash
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://127.0.0.1:4318/v1/traces
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://127.0.0.1:4318/v1/metrics
export OTEL_TRACE_UI_BASE_URL=http://127.0.0.1:16686/trace
```

Detailed runbook (including Tailscale remote web access):
- [docs/self-host-local-tailscale.md](./docs/self-host-local-tailscale.md)
- [examples/self-host/README.md](./examples/self-host/README.md)

## Diagnostics Commands

| Command | Description |
|---|---|
| `/otel-status` | Shows enablement, privacy profile, exporters/endpoints, provider/model, usage counters, cost, durations, trace ID, last error |
| `/otel-open-trace` | Builds URL from `OTEL_TRACE_UI_BASE_URL` + current trace ID; in interactive mode, can open browser |

## Configuration Reference

| Key | Default | Description |
|---|---|---|
| `OTEL_ENABLE` | `true` | Global telemetry on/off |
| `OTEL_SERVICE_NAME` | `pi-opentelemetry` | OTel service name |
| `OTEL_SERVICE_VERSION` | `0.1.0` | OTel service version |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | - | Base OTLP endpoint (auto-resolves traces/metrics paths) |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | `http://localhost:4318/v1/traces` | Trace endpoint |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | `http://localhost:4318/v1/metrics` | Metrics endpoint |
| `OTEL_EXPORTER_OTLP_HEADERS` | `{}` | OTLP headers (`k=v,k2=v2`) |
| `OTEL_TRACES_EXPORTER` | `otlp` | `otlp` or `none` |
| `OTEL_METRICS_EXPORTER` | `otlp` | comma list: `otlp`, `console`, `none` |
| `OTEL_METRIC_EXPORT_INTERVAL` | `60000` | Metrics export interval (ms) |
| `OTEL_TRACE_UI_BASE_URL` | `http://localhost:16686/trace` | Trace UI base URL |
| `OTEL_PRIVACY_PROFILE` | `detailed-with-redaction` | `detailed-with-redaction` or `strict` |
| `OTEL_PAYLOAD_MAX_BYTES` | `32768` | Max payload capture bytes |
| `OTEL_REDACT_KEYS` | `[]` | Extra sensitive keys (comma-separated) |
| `OTEL_PATH_DENYLIST` | built-in + custom | File path denylist patterns |

> `PI_` prefix is supported for all keys (e.g. `PI_OTEL_PRIVACY_PROFILE`).

## Development

```bash
npm install
npm test
npm run typecheck
npm run release:check
```

`npm run release:check` runs tests, type checks, and `npm pack --dry-run`.

## Release

```bash
npm whoami
npm publish --access public
```

Published package artifacts are restricted by `package.json#files`.

## Project Structure

- `src/index.ts` - extension entrypoint, event hooks, command registration
- `src/config.ts` - env parsing and default resolution
- `src/privacy/*` - payload policy + redaction
- `src/trace/*` - tracer/provider + span lifecycle management
- `src/metrics/*` - meter/provider + usage metrics collector
- `src/diagnostics/*` - `/otel-status`, `/otel-open-trace` helpers
- `examples/otel-collector.yaml` - minimal collector debug example
- `examples/self-host/*` - local self-host stack (collector + jaeger + prometheus + grafana)

## Documentation Map

- Agent entry: [AGENTS.md](./AGENTS.md)
- Docs index: [docs/index.md](./docs/index.md)
- Self-host + Tailscale guide: [docs/self-host-local-tailscale.md](./docs/self-host-local-tailscale.md)
- Implementation plan: [PLAN.md](./PLAN.md)
- Progress tracker: [PROGRESS.md](./PROGRESS.md)
