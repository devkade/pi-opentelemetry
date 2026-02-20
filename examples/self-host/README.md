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
  - preloaded dashboard: `Pi OTel / Pi OTel Overview`
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

## 4) Suggested first dashboards in Grafana

Use Prometheus datasource with these starter queries:

- Sessions: `sum(increase(pi_session_count_total[1h]))`
- Turns: `sum(increase(pi_turn_count_total[1h]))`
- Tool calls: `sum(increase(pi_tool_call_count_total[1h]))`
- Token input/output:
  - `sum(increase(pi_token_usage_tokens_total{type="input"}[1h]))`
  - `sum(increase(pi_token_usage_tokens_total{type="output"}[1h]))`
- Cost total: `sum(increase(pi_cost_usage_USD_total[1h]))`
- Tool p95 latency:
  - `histogram_quantile(0.95, sum(rate(pi_tool_duration_seconds_bucket[5m])) by (le, tool_name))`

> Exact metric names can vary by collector/exporter normalization. Verify names in Prometheus first (`/graph` autocomplete).

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
