import type { Counter, Histogram, Meter } from "@opentelemetry/api";
import type { AssistantUsage, TelemetryStatus } from "../types.js";

interface CollectorOptions {
  meter?: Meter;
  now?: () => number;
}

interface ToolCallArgs {
  toolCallId: string;
  toolName: string;
}

interface ToolResultArgs extends ToolCallArgs {
  success: boolean;
}

interface PromptArgs {
  promptLength: number;
}

interface Counters {
  session?: Counter;
  turn?: Counter;
  toolCall?: Counter;
  toolResult?: Counter;
  prompt?: Counter;
  token?: Counter;
  cost?: Counter;
}

interface Histograms {
  session?: Histogram;
  turn?: Histogram;
  tool?: Histogram;
}

function durationTemplate() {
  return { count: 0, totalMs: 0, lastMs: 0 };
}

function statusTemplate(): TelemetryStatus {
  return {
    sessions: 0,
    turns: 0,
    toolCalls: 0,
    toolResults: 0,
    prompts: 0,
    tokens: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
    durations: {
      session: durationTemplate(),
      turn: durationTemplate(),
      tool: durationTemplate(),
    },
    provider: "unknown",
    model: "unknown",
  };
}

export function createMetricsCollector(options: CollectorOptions = {}) {
  const now = options.now ?? Date.now;
  const status = statusTemplate();

  const counters: Counters = options.meter
    ? {
        session: options.meter.createCounter("pi.session.count", {
          description: "Count of sessions started",
          unit: "1",
        }),
        turn: options.meter.createCounter("pi.turn.count", {
          description: "Count of turns",
          unit: "1",
        }),
        toolCall: options.meter.createCounter("pi.tool_call.count", {
          description: "Count of tool calls",
          unit: "1",
        }),
        toolResult: options.meter.createCounter("pi.tool_result.count", {
          description: "Count of tool results",
          unit: "1",
        }),
        prompt: options.meter.createCounter("pi.prompt.count", {
          description: "Count of user prompts",
          unit: "1",
        }),
        token: options.meter.createCounter("pi.token.usage", {
          description: "Token usage",
          unit: "tokens",
        }),
        cost: options.meter.createCounter("pi.cost.usage", {
          description: "Cost usage",
          unit: "USD",
        }),
      }
    : {};

  const histograms: Histograms = options.meter
    ? {
        session: options.meter.createHistogram("pi.session.duration", {
          description: "Session duration",
          unit: "s",
        }),
        turn: options.meter.createHistogram("pi.turn.duration", {
          description: "Turn duration",
          unit: "s",
        }),
        tool: options.meter.createHistogram("pi.tool.duration", {
          description: "Tool duration",
          unit: "s",
        }),
      }
    : {};

  let sessionStart: number | undefined;
  let turnStart: number | undefined;
  const toolStart = new Map<string, { startedAt: number; toolName: string }>();

  const baseAttrs = () => ({
    provider: status.provider,
    model: status.model,
  });

  const trackDuration = (target: { count: number; totalMs: number; lastMs: number }, durationMs: number) => {
    target.count += 1;
    target.totalMs += durationMs;
    target.lastMs = durationMs;
  };

  return {
    setProviderModel(provider: string, model: string): void {
      status.provider = provider;
      status.model = model;
    },

    setTraceId(traceId: string | undefined): void {
      status.traceId = traceId;
    },

    setLastError(error: string | undefined): void {
      status.lastError = error;
    },

    recordSessionStart(): void {
      status.sessions += 1;
      sessionStart = now();
      counters.session?.add(1, baseAttrs());
    },

    recordSessionEnd(): void {
      if (sessionStart === undefined) return;
      const durationMs = now() - sessionStart;
      trackDuration(status.durations.session, durationMs);
      histograms.session?.record(durationMs / 1000, baseAttrs());
      sessionStart = undefined;
    },

    recordTurnStart(): void {
      status.turns += 1;
      turnStart = now();
      counters.turn?.add(1, baseAttrs());
    },

    recordTurnEnd(): void {
      if (turnStart === undefined) return;
      const durationMs = now() - turnStart;
      trackDuration(status.durations.turn, durationMs);
      histograms.turn?.record(durationMs / 1000, baseAttrs());
      turnStart = undefined;
    },

    recordToolCall(args: ToolCallArgs): void {
      status.toolCalls += 1;
      toolStart.set(args.toolCallId, { startedAt: now(), toolName: args.toolName });
      counters.toolCall?.add(1, {
        ...baseAttrs(),
        "tool.name": args.toolName,
      });
    },

    recordToolResult(args: ToolResultArgs): void {
      status.toolResults += 1;

      const started = toolStart.get(args.toolCallId);
      if (started) {
        const durationMs = now() - started.startedAt;
        trackDuration(status.durations.tool, durationMs);
        histograms.tool?.record(durationMs / 1000, {
          ...baseAttrs(),
          "tool.name": args.toolName,
          success: String(args.success),
        });
        toolStart.delete(args.toolCallId);
      }

      counters.toolResult?.add(1, {
        ...baseAttrs(),
        "tool.name": args.toolName,
        success: String(args.success),
      });
    },

    recordPrompt(args: PromptArgs): void {
      status.prompts += 1;
      counters.prompt?.add(1, {
        ...baseAttrs(),
        "prompt.length": args.promptLength,
      });
    },

    recordUsage(usage: AssistantUsage): void {
      status.tokens.input += usage.input;
      status.tokens.output += usage.output;
      status.tokens.cacheRead += usage.cacheRead;
      status.tokens.cacheWrite += usage.cacheWrite;
      status.tokens.total += usage.totalTokens;

      status.cost.input += usage.cost.input;
      status.cost.output += usage.cost.output;
      status.cost.cacheRead += usage.cost.cacheRead;
      status.cost.cacheWrite += usage.cost.cacheWrite;
      status.cost.total += usage.cost.total;

      const attrs = baseAttrs();
      counters.token?.add(usage.input, { ...attrs, type: "input" });
      counters.token?.add(usage.output, { ...attrs, type: "output" });
      counters.token?.add(usage.cacheRead, { ...attrs, type: "cache_read" });
      counters.token?.add(usage.cacheWrite, { ...attrs, type: "cache_write" });

      counters.cost?.add(usage.cost.input, { ...attrs, type: "input" });
      counters.cost?.add(usage.cost.output, { ...attrs, type: "output" });
      counters.cost?.add(usage.cost.cacheRead, { ...attrs, type: "cache_read" });
      counters.cost?.add(usage.cost.cacheWrite, { ...attrs, type: "cache_write" });
    },

    getStatus(): TelemetryStatus {
      return {
        ...status,
        tokens: { ...status.tokens },
        cost: { ...status.cost },
        durations: {
          session: { ...status.durations.session },
          turn: { ...status.durations.turn },
          tool: { ...status.durations.tool },
        },
      };
    },
  };
}

export type MetricsCollector = ReturnType<typeof createMetricsCollector>;
