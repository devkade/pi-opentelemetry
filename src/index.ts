import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { getConfig } from "./config.js";
import { buildTraceUrl, openTraceUrl } from "./diagnostics/open-trace-command.js";
import { formatOtelStatus } from "./diagnostics/status-command.js";
import { createMetricsCollector } from "./metrics/collector.js";
import { createMetricsRuntime } from "./metrics/provider.js";
import { createPayloadPolicy } from "./privacy/payload-policy.js";
import { createRedactor } from "./privacy/redactor.js";
import { createSpanManager } from "./trace/span-manager.js";
import { createTraceRuntime } from "./trace/provider.js";
import type { AssistantUsage, TelemetryStatus } from "./types.js";

const EXTENSION_STATUS_KEY = "pi-opentelemetry";
const CUSTOM_STATUS_MESSAGE_TYPE = "pi-opentelemetry-status";

function getSessionId(ctx: ExtensionContext): string {
  return "getSessionId" in ctx.sessionManager ? ctx.sessionManager.getSessionId() : "unknown";
}

function getSessionFile(ctx: ExtensionContext): string | undefined {
  return "getSessionFile" in ctx.sessionManager ? ctx.sessionManager.getSessionFile() : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function extractUsageFromMessage(message: unknown): AssistantUsage | undefined {
  if (!message || typeof message !== "object") return undefined;

  const msg = message as {
    role?: string;
    usage?: AssistantUsage;
  };

  if (msg.role !== "assistant") return undefined;
  if (!msg.usage) return undefined;
  return msg.usage;
}

function findStopReason(messages: unknown[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (!item || typeof item !== "object") continue;

    const message = item as { role?: string; stopReason?: string };
    if (message.role === "assistant") {
      return message.stopReason;
    }
  }

  return undefined;
}

function notifyOrMessage(pi: ExtensionAPI, ctx: ExtensionCommandContext, message: string): void {
  if (ctx.hasUI) {
    ctx.ui.notify(message, "info");
    return;
  }

  pi.sendMessage({
    customType: CUSTOM_STATUS_MESSAGE_TYPE,
    content: message,
    display: true,
  });
}

export default function piOpenTelemetryExtension(pi: ExtensionAPI): void {
  const config = getConfig();
  const redactor = createRedactor({
    extraSensitiveKeys: config.privacy.extraSensitiveKeys,
    pathDenylist: config.privacy.pathDenylist,
  });
  const payloadPolicy = createPayloadPolicy({
    profile: config.privacy.profile,
    payloadMaxBytes: config.privacy.payloadMaxBytes,
    redactor,
  });

  let lastError: string | undefined;
  let collector = createMetricsCollector();

  const onRuntimeError = (error: unknown): void => {
    lastError = getErrorMessage(error);
    collector.setLastError(lastError);
  };

  const metricsRuntime = config.enabled ? createMetricsRuntime(config, onRuntimeError) : undefined;
  const traceRuntime = config.enabled ? createTraceRuntime(config, onRuntimeError) : undefined;

  if (metricsRuntime) {
    collector = createMetricsCollector({ meter: metricsRuntime.meter });
    if (lastError) {
      collector.setLastError(lastError);
    }
  }

  const spanManager = traceRuntime
    ? createSpanManager({
        tracer: traceRuntime.tracer,
        payloadPolicy,
      })
    : undefined;

  const updateModel = (ctx: ExtensionContext): void => {
    const model = ctx.model;
    if (!model) return;
    collector.setProviderModel(String(model.provider), model.id);
  };

  const updateTraceId = (): void => {
    collector.setTraceId(spanManager?.getTraceId());
  };

  const getStatusSnapshot = (): TelemetryStatus => {
    const current = collector.getStatus();
    current.traceId = spanManager?.getTraceId();
    current.lastError = lastError;
    return current;
  };

  const shutdownRuntimes = async (): Promise<void> => {
    await Promise.all([traceRuntime?.shutdown(), metricsRuntime?.shutdown()]);
  };

  pi.registerCommand("otel-status", {
    description: "Show OpenTelemetry runtime status",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const text = formatOtelStatus({
        enabled: config.enabled,
        serviceName: config.serviceName,
        privacyProfile: config.privacy.profile,
        traceExporter: config.traces.exporter,
        metricsExporters: config.metrics.exporters,
        traceEndpoint: config.traces.endpoint,
        metricsEndpoint: config.metrics.endpoint,
        status: getStatusSnapshot(),
      });

      notifyOrMessage(pi, ctx, text);
    },
  });

  pi.registerCommand("otel-open-trace", {
    description: "Open current trace in browser",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const traceId = spanManager?.getTraceId();

      if (!traceId) {
        notifyOrMessage(pi, ctx, "No active trace ID available yet.");
        return;
      }

      const url = buildTraceUrl(config.traceUiBaseUrl, traceId);

      if (!ctx.hasUI) {
        notifyOrMessage(pi, ctx, `Trace URL: ${url}`);
        return;
      }

      const shouldOpen = await ctx.ui.confirm("Open trace", `Open this trace URL?\n${url}`);
      if (!shouldOpen) {
        notifyOrMessage(pi, ctx, `Trace URL: ${url}`);
        return;
      }

      const result = await openTraceUrl(process.platform, url, async (command, args) => {
        const execResult = await pi.exec(command, args, {});
        return {
          code: execResult.code,
          stderr: execResult.stderr,
        };
      });

      if (!result.ok) {
        notifyOrMessage(pi, ctx, `Trace open failed: ${result.error}`);
        return;
      }

      notifyOrMessage(pi, ctx, `Opened trace: ${url}`);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    if (!config.enabled) {
      if (ctx.hasUI) ctx.ui.setStatus(EXTENSION_STATUS_KEY, "otel disabled");
      return;
    }

    updateModel(ctx);
    collector.recordSessionStart();
    spanManager?.onSessionStart({
      sessionId: getSessionId(ctx),
      sessionFile: getSessionFile(ctx),
    });
    updateTraceId();

    if (ctx.hasUI) {
      ctx.ui.setStatus(EXTENSION_STATUS_KEY, "otel active");
    }
  });

  pi.on("session_switch", async (_event, ctx) => {
    if (!config.enabled) return;

    collector.recordSessionEnd();
    spanManager?.shutdown();

    updateModel(ctx);
    collector.recordSessionStart();
    spanManager?.onSessionStart({
      sessionId: getSessionId(ctx),
      sessionFile: getSessionFile(ctx),
    });
    updateTraceId();
  });

  pi.on("input", async (event, ctx) => {
    if (!config.enabled) return;

    updateModel(ctx);
    collector.recordPrompt({ promptLength: event.text.length });
    spanManager?.onInput({
      text: event.text,
      source: event.source,
      imageCount: event.images?.length,
    });
  });

  pi.on("agent_start", async () => {
    if (!config.enabled) return;
    spanManager?.onAgentStart();
  });

  pi.on("turn_start", async (event) => {
    if (!config.enabled) return;

    collector.recordTurnStart();
    spanManager?.onTurnStart({
      turnIndex: event.turnIndex,
      timestamp: event.timestamp,
    });
  });

  pi.on("tool_call", async (event) => {
    if (!config.enabled) return;

    collector.recordToolCall({
      toolCallId: event.toolCallId,
      toolName: event.toolName,
    });

    spanManager?.onToolCall({
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      input: event.input,
      turnIndex: undefined,
    });
  });

  pi.on("tool_result", async (event) => {
    if (!config.enabled) return;

    collector.recordToolResult({
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      success: !event.isError,
    });

    spanManager?.onToolResult({
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      isError: event.isError,
      output: {
        content: event.content,
        details: event.details,
      },
      turnIndex: undefined,
    });
  });

  pi.on("turn_end", async (event) => {
    if (!config.enabled) return;

    collector.recordTurnEnd();

    const usage = extractUsageFromMessage(event.message);
    if (usage) {
      collector.recordUsage(usage);
    }

    const stopReason =
      event.message && typeof event.message === "object" && "stopReason" in event.message
        ? String((event.message as { stopReason?: unknown }).stopReason ?? "")
        : undefined;

    spanManager?.onTurnEnd({
      turnIndex: event.turnIndex,
      toolResults: event.toolResults.length,
      stopReason,
    });
  });

  pi.on("agent_end", async (event) => {
    if (!config.enabled) return;

    spanManager?.onAgentEnd({
      stopReason: findStopReason(event.messages as unknown[]),
    });
  });

  pi.on("model_select", async (event) => {
    if (!config.enabled) return;

    collector.setProviderModel(String(event.model.provider), event.model.id);
    spanManager?.onModelSelect({
      provider: String(event.model.provider),
      modelId: event.model.id,
      source: event.source,
    });
  });

  pi.on("session_compact", async (event) => {
    if (!config.enabled) return;

    spanManager?.onSessionCompact({
      firstKeptEntryId: event.compactionEntry?.firstKeptEntryId,
      tokensBefore: event.compactionEntry?.tokensBefore,
      summary: event.compactionEntry?.summary,
    });
  });

  pi.on("session_tree", async (event) => {
    if (!config.enabled) return;

    spanManager?.onSessionTree({
      oldLeafId: event.oldLeafId ?? undefined,
      newLeafId: event.newLeafId ?? undefined,
      fromExtension: event.fromExtension,
    });
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (!config.enabled) {
      if (ctx.hasUI) ctx.ui.setStatus(EXTENSION_STATUS_KEY, undefined);
      return;
    }

    collector.recordSessionEnd();
    spanManager?.shutdown();
    updateTraceId();
    await shutdownRuntimes();

    if (ctx.hasUI) {
      ctx.ui.setStatus(EXTENSION_STATUS_KEY, undefined);
    }
  });
}
