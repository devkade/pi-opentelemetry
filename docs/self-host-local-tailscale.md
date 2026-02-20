# Self-host Local Stack + Tailscale Access

This document defines the recommended deployment mode for **personal continuous use**:

- telemetry backend runs on a single local host
- remote access is limited to web UIs through Tailscale
- OTLP ingestion is not publicly exposed

## Topology

Pi (`@devkade/pi-opentelemetry`)
→ local OTLP receiver (`otel-collector`)
→ traces (`jaeger`) + metrics (`prometheus`)
→ dashboards (`grafana`)

## Reference Implementation

Use the compose bundle (includes Grafana datasource + dashboards + alert provisioning):

- `examples/self-host/docker-compose.yaml`
- `examples/self-host/otel-collector.yaml`
- `examples/self-host/prometheus.yaml`
- `examples/self-host/grafana/provisioning/datasources/datasources.yaml`
- `examples/self-host/grafana/provisioning/alerting/pi-otel-alert-rules.yaml`
- `examples/self-host/grafana/dashboards/*.json`
- `examples/self-host/README.md` (runbook)

## Security Baseline

1. Bind host ports to `127.0.0.1` by default
2. Access web UIs only through Tailscale (`serve` or SSH tunnel)
3. Keep privacy profile default `detailed-with-redaction` (or stricter)
4. Do not expose OTLP ingestion endpoints to public internet
