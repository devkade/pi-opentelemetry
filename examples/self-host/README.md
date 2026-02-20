# Self-host Local Observability Stack (with Tailscale remote access)

This setup is optimized for personal use:

- keep telemetry ingestion/storage on one local host
- access only web UIs remotely from your MacBook through Tailscale

## Stack

- `otel-collector` (OTLP receiver + routing)
- `jaeger` (trace storage + trace UI)
- `prometheus` (metrics storage)
- `grafana` (dashboard UI)

> Note: `jaegertracing/all-in-one` may print a Jaeger v1 EOL notice. For long-term usage, replace it with Tempo or Jaeger v2.

## 1) Start the stack

```bash
cd examples/self-host
docker compose up -d
```

Check health:

```bash
docker compose ps
docker compose logs -f otel-collector
```

If Grafana dashboard provisioning does not appear immediately:

```bash
docker compose restart grafana
```

Local UIs on host machine:

- Grafana: `http://127.0.0.1:3789` (`admin` / `admin`)
  - first login: change password if prompted
  - preloaded dashboards:
    - `Pi OTel / Pi OTel Overview`
    - `Pi OTel / Pi OTel Ops Live`
    - `Pi OTel / Pi OTel Efficiency & Decision`
  - provisioned alert rules folder: `Pi OTel Alerts`
- Jaeger: `http://127.0.0.1:16686`
- Prometheus: `http://127.0.0.1:9090`

## 2) Point Pi extension to the collector

```bash
source examples/self-host/pi-otel.env.example
```

Then run Pi with extension and verify:

```bash
pi -e ./src/index.ts "/otel-status"
pi -e ./src/index.ts "/otel-open-trace"
```

`OTEL_SERVICE_NAME` is auto-detected from the nearest project `package.json#name` (fallback: directory name).
Use manual override only when needed:

```bash
# optional
export OTEL_SERVICE_NAME=my-project-name
```

## 3) Remote web access with Tailscale

> Recommended: keep docker ports bound to `127.0.0.1` (as in this compose file), then expose only via Tailscale.

### Option A) Tailscale Serve (direct web URLs)

Run on the host machine (use unused HTTPS ports on your tailnet):

```bash
tailscale serve --bg --https=13000 3789
# optional: expose Jaeger too
# tailscale serve --bg --https=13001 16686
```

Check published endpoints:

```bash
tailscale serve status
```

Reset serve config:

```bash
tailscale serve reset
```

### Option B) Tailscale SSH tunnel (most restrictive)

Run on your MacBook:

```bash
tailscale ssh -L 3789:127.0.0.1:3789 -L 16686:127.0.0.1:16686 <user>@<host>
```

Then open locally on your MacBook:

- `http://127.0.0.1:3789` (Grafana)
- `http://127.0.0.1:16686` (Jaeger)

## 4) Provisioned dashboards + alert rules

Provisioned dashboard JSON files:

- `grafana/dashboards/pi-otel-overview.json`
- `grafana/dashboards/pi-otel-ops-live.json`
- `grafana/dashboards/pi-otel-efficiency-decision.json`

Provisioned alert rules file:

- `grafana/provisioning/alerting/pi-otel-alert-rules.yaml`

Default alert set:

- Collector down (`up{job="pi-otel-collector"} < 1`, 5m)
- Tool error rate warning/critical (>5% / >10%, 10m)
- Turn p95 warning/critical (>8s / >12s, 15m)
- Cost-per-turn regression warning (>1.3x vs 7-day baseline, 30m)

> Alert rules are provisioned in Grafana, but notification routing (Slack/Email/Webhook) is environment-specific. Configure contact points and policy in Grafana UI after first boot.

## 5) Data persistence and retention

This compose file persists storage with docker volumes:

- `jaeger-data`
- `prometheus-data`
- `grafana-data`

Prometheus retention is set to `30d`.

## 6) Stop / reset

Stop services:

```bash
docker compose down
```

Stop and remove persisted data:

```bash
docker compose down -v
```
