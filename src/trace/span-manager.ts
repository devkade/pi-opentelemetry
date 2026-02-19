import { SpanStatusCode, context, trace, type Span, type Tracer } from "@opentelemetry/api";
import type { PayloadPolicy } from "../privacy/payload-policy.js";

interface SessionStartArgs {
  sessionId: string;
  sessionFile?: string;
}

interface TurnStartArgs {
  turnIndex: number;
  timestamp?: number;
}

interface TurnEndArgs {
  turnIndex: number;
  toolResults: number;
  stopReason?: string;
}

interface ToolCallArgs {
  toolCallId: string;
  toolName: string;
  input: unknown;
  turnIndex?: number;
}

interface ToolResultArgs {
  toolCallId: string;
  toolName: string;
  isError: boolean;
  output: unknown;
  turnIndex?: number;
}

interface SpanManagerOptions {
  tracer: Tracer;
  payloadPolicy: PayloadPolicy;
  now?: () => number;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function previewText(value: string, maxChars: number): string {
  const normalized = normalizeText(value);
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}…`;
}

function extractPath(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const path = (input as Record<string, unknown>).path;
  return typeof path === "string" ? path : undefined;
}

function extractBashCommand(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const command = (input as Record<string, unknown>).command;
  return typeof command === "string" ? command : undefined;
}

function buildToolSpanName(toolName: string, input: unknown): string {
  if (toolName !== "bash") {
    return `pi.tool: ${toolName}`;
  }

  const command = extractBashCommand(input);
  if (!command) {
    return `pi.tool: ${toolName}`;
  }

  return `pi.tool: ${toolName}(${previewText(command, 120)})`;
}

export function createSpanManager(options: SpanManagerOptions) {
  const now = options.now ?? Date.now;

  let sessionSpan: Span | undefined;
  let agentSpan: Span | undefined;
  const turns = new Map<number, Span>();
  const tools = new Map<string, Span>();
  let traceId: string | undefined;

  const safeEnd = (span: Span | undefined): void => {
    if (!span) return;
    span.end(now());
  };

  const closeToolSpans = (reason: string): void => {
    for (const [toolCallId, span] of tools.entries()) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: `orphan tool span (${reason})` });
      span.setAttribute("pi.tool.orphan", true);
      safeEnd(span);
      tools.delete(toolCallId);
    }
  };

  const closeTurnSpans = (reason: string): void => {
    for (const [turnIndex, span] of turns.entries()) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: `orphan turn span (${reason})` });
      span.setAttribute("pi.turn.orphan", true);
      safeEnd(span);
      turns.delete(turnIndex);
    }
  };

  const closeAgentSpan = (reason: string): void => {
    if (!agentSpan) return;
    agentSpan.setStatus({ code: SpanStatusCode.ERROR, message: `orphan agent span (${reason})` });
    agentSpan.setAttribute("pi.agent.orphan", true);
    safeEnd(agentSpan);
    agentSpan = undefined;
  };

  const getToolParent = (turnIndex: number | undefined): Span | undefined => {
    if (turnIndex !== undefined) {
      return turns.get(turnIndex) ?? agentSpan ?? sessionSpan;
    }
    return agentSpan ?? sessionSpan;
  };

  const setTraceId = (span: Span | undefined): void => {
    traceId = span?.spanContext().traceId;
  };

  return {
    getTraceId(): string | undefined {
      return traceId;
    },

    onSessionStart(args: SessionStartArgs): void {
      if (sessionSpan) {
        closeToolSpans("session_restart");
        closeTurnSpans("session_restart");
        closeAgentSpan("session_restart");
        safeEnd(sessionSpan);
      }

      sessionSpan = options.tracer.startSpan("pi.session", { startTime: now() });
      sessionSpan.setAttribute("pi.session.id", args.sessionId);
      if (args.sessionFile) {
        sessionSpan.setAttribute("pi.session.file", args.sessionFile);
      }
      setTraceId(sessionSpan);
    },

    onInput(args: { text: string; source: string; imageCount?: number; path?: string }): void {
      if (!sessionSpan) return;

      const sanitized = options.payloadPolicy.sanitize(args.text, { path: args.path });
      sessionSpan.addEvent("input", {
        "pi.event.type": "input",
        "pi.input.source": args.source,
        "pi.input.images": args.imageCount ?? 0,
        ...options.payloadPolicy.toAttributes("pi.input", sanitized),
      });

      const namePreview = previewText(args.text, 50);
      if (namePreview) {
        sessionSpan.updateName(`pi.session ${namePreview}`);
      }
    },

    onAgentStart(): void {
      if (!sessionSpan) return;
      const parentCtx = trace.setSpan(context.active(), sessionSpan);
      agentSpan = options.tracer.startSpan("pi.agent", { startTime: now() }, parentCtx);
    },

    onAgentEnd(args: { stopReason?: string }): void {
      if (agentSpan) {
        agentSpan.addEvent("agent_end", {
          "pi.event.type": "agent_end",
          "pi.message.stop_reason": args.stopReason ?? "",
        });
      }

      closeToolSpans("agent_end");
      closeTurnSpans("agent_end");
      safeEnd(agentSpan);
      agentSpan = undefined;
    },

    onTurnStart(args: TurnStartArgs): void {
      const parent = agentSpan ?? sessionSpan;
      if (!parent) return;

      const parentCtx = trace.setSpan(context.active(), parent);
      const turnSpan = options.tracer.startSpan(
        "pi.turn",
        {
          startTime: args.timestamp ?? now(),
        },
        parentCtx,
      );
      turnSpan.setAttribute("pi.turn.index", args.turnIndex);
      turns.set(args.turnIndex, turnSpan);
    },

    onTurnEnd(args: TurnEndArgs): void {
      const span = turns.get(args.turnIndex);
      if (!span) return;

      span.addEvent("turn_end", {
        "pi.event.type": "turn_end",
        "pi.turn.index": args.turnIndex,
        "pi.turn.tool_results": args.toolResults,
        "pi.message.stop_reason": args.stopReason ?? "",
      });
      safeEnd(span);
      turns.delete(args.turnIndex);
    },

    onToolCall(args: ToolCallArgs): void {
      const parent = getToolParent(args.turnIndex);
      if (!parent) return;

      const parentCtx = trace.setSpan(context.active(), parent);
      const span = options.tracer.startSpan(buildToolSpanName(args.toolName, args.input), { startTime: now() }, parentCtx);

      span.setAttribute("pi.tool.name", args.toolName);
      span.setAttribute("pi.tool.call_id", args.toolCallId);
      if (args.turnIndex !== undefined) {
        span.setAttribute("pi.turn.index", args.turnIndex);
      }

      const sanitized = options.payloadPolicy.sanitize(args.input, { path: extractPath(args.input) });
      span.addEvent("tool_call", {
        "pi.event.type": "tool_call",
        "pi.tool.name": args.toolName,
        "pi.tool.call_id": args.toolCallId,
        ...options.payloadPolicy.toAttributes("pi.tool.input", sanitized),
      });

      tools.set(args.toolCallId, span);
    },

    onToolResult(args: ToolResultArgs): void {
      const span = tools.get(args.toolCallId);
      const target = span ?? sessionSpan;
      if (!target) return;

      const sanitized = options.payloadPolicy.sanitize(args.output, { path: undefined });
      target.addEvent("tool_result", {
        "pi.event.type": "tool_result",
        "pi.tool.name": args.toolName,
        "pi.tool.call_id": args.toolCallId,
        "pi.tool.is_error": args.isError,
        "pi.turn.index": args.turnIndex ?? -1,
        ...options.payloadPolicy.toAttributes("pi.tool.output", sanitized),
      });

      if (span) {
        if (args.isError) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: "tool_result error" });
        }
        safeEnd(span);
        tools.delete(args.toolCallId);
      }
    },

    onModelSelect(args: { provider: string; modelId: string; source: string }): void {
      if (!sessionSpan) return;
      sessionSpan.addEvent("model_select", {
        "pi.event.type": "model_select",
        "pi.model.provider": args.provider,
        "pi.model.id": args.modelId,
        "pi.model.source": args.source,
      });
    },

    onSessionCompact(args: { firstKeptEntryId?: string; tokensBefore?: number; summary?: unknown }): void {
      if (!sessionSpan) return;
      const sanitized = options.payloadPolicy.sanitize(args.summary);
      sessionSpan.addEvent("session_compact", {
        "pi.event.type": "session_compact",
        "pi.compaction.first_kept_entry": args.firstKeptEntryId ?? "",
        "pi.compaction.tokens_before": args.tokensBefore ?? 0,
        ...options.payloadPolicy.toAttributes("pi.compaction.summary", sanitized),
      });
    },

    onSessionTree(args: { oldLeafId?: string; newLeafId?: string; fromExtension?: boolean }): void {
      if (!sessionSpan) return;
      sessionSpan.addEvent("session_tree", {
        "pi.event.type": "session_tree",
        "pi.tree.old_leaf": args.oldLeafId ?? "",
        "pi.tree.new_leaf": args.newLeafId ?? "",
        "pi.tree.from_extension": args.fromExtension ?? false,
      });
    },

    shutdown(): void {
      closeToolSpans("shutdown");
      closeTurnSpans("shutdown");
      closeAgentSpan("shutdown");
      safeEnd(sessionSpan);
      sessionSpan = undefined;
      traceId = undefined;
    },
  };
}

export type SpanManager = ReturnType<typeof createSpanManager>;
