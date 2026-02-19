import { metrics } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ConsoleMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import type { TelemetryConfig } from "../types.js";

export interface MetricsRuntime {
  meter: ReturnType<typeof metrics.getMeter>;
  exporters: string[];
  endpoint: string;
  shutdown: () => Promise<void>;
}

export function createMetricsRuntime(
  config: TelemetryConfig,
  onError?: (error: unknown) => void,
): MetricsRuntime {
  const exporters = config.metrics.exporters.filter((item) => item !== "none");

  if (exporters.length === 0) {
    return {
      meter: metrics.getMeter("pi-opentelemetry"),
      exporters: ["none"],
      endpoint: config.metrics.endpoint,
      shutdown: async () => {},
    };
  }

  const readers: PeriodicExportingMetricReader[] = [];

  if (exporters.includes("console")) {
    readers.push(
      new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: config.metrics.exportIntervalMs,
      }),
    );
  }

  if (exporters.includes("otlp")) {
    readers.push(
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: config.metrics.endpoint,
          headers: config.metrics.headers,
        }),
        exportIntervalMillis: config.metrics.exportIntervalMs,
      }),
    );
  }

  const provider = new MeterProvider({
    resource: resourceFromAttributes({
      "service.name": config.serviceName,
      "service.version": config.serviceVersion,
    }),
    readers,
  });

  metrics.setGlobalMeterProvider(provider);

  const meter = provider.getMeter("pi-opentelemetry");

  return {
    meter,
    exporters,
    endpoint: config.metrics.endpoint,
    shutdown: async () => {
      try {
        await provider.shutdown();
      } catch (error) {
        onError?.(error);
      }
    },
  };
}
