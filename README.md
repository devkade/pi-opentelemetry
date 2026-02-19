# pi-opentelemetry

Pi Coding Agent 사용량/행동을 OpenTelemetry로 수집·분석하기 위한 Pi extension package입니다.

핵심 제공 기능:
- Trace (`session -> agent -> turn -> tool`)
- Metrics (sessions/turns/tools/prompts/tokens/cost/duration)
- Diagnostics (`/otel-status`, `/otel-open-trace`)
- Privacy 기본 프로파일: `detailed-with-redaction`

## Install (as Pi package)

```bash
pi install ./
# 또는
pi -e ./src/index.ts
```

## Environment

```bash
# on/off
export PI_OTEL_ENABLE=1

# traces
export OTEL_TRACES_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces

# metrics
export OTEL_METRICS_EXPORTER=otlp,console
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics
export OTEL_METRIC_EXPORT_INTERVAL=10000

# auth headers (optional)
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <token>"

# privacy (default: detailed-with-redaction)
export PI_OTEL_PRIVACY_PROFILE=detailed-with-redaction
export PI_OTEL_PAYLOAD_MAX_BYTES=32768
```

## Commands

- `/otel-status` — telemetry 상태/누적 지표/endpoint/trace id 표시
- `/otel-open-trace` — 현재 trace URL 생성(인터랙티브 모드에서는 브라우저 오픈 가능)

## Development (TDD)

```bash
npm install
npm test
npm run typecheck
```

## Release prep

```bash
npm run release:check
# publish
npm publish --access public
```

패키지 배포 아티팩트는 `package.json#files` allowlist로 제한됩니다.

## Collector sample

- Example config: [`examples/otel-collector.yaml`](./examples/otel-collector.yaml)

## Documentation Map

- Agent entry: [AGENTS.md](./AGENTS.md)
- Docs index: [docs/index.md](./docs/index.md)
- Implementation plan: [PLAN.md](./PLAN.md)
- Progress tracker: [PROGRESS.md](./PROGRESS.md)
