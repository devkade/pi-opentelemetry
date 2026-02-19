import { describe, expect, it } from "vitest";
import { createMetricsCollector } from "../src/metrics/collector.js";

class CapturingCounter {
  public attrs: Array<Record<string, unknown> | undefined> = [];

  add(_value: number, attrs?: Record<string, unknown>): void {
    this.attrs.push(attrs);
  }
}

class CapturingHistogram {
  public attrs: Array<Record<string, unknown> | undefined> = [];

  record(_value: number, attrs?: Record<string, unknown>): void {
    this.attrs.push(attrs);
  }
}

class CapturingMeter {
  public counters: CapturingCounter[] = [];
  public histograms: CapturingHistogram[] = [];

  createCounter(_name: string): CapturingCounter {
    const counter = new CapturingCounter();
    this.counters.push(counter);
    return counter;
  }

  createHistogram(_name: string): CapturingHistogram {
    const histogram = new CapturingHistogram();
    this.histograms.push(histogram);
    return histogram;
  }
}

describe("metrics collector", () => {
  it("tracks counts and durations", () => {
    let nowMs = 1_000;
    const collector = createMetricsCollector({
      now: () => nowMs,
    });

    collector.setProviderModel("anthropic", "claude-sonnet");
    collector.recordSessionStart();

    nowMs += 150;
    collector.recordTurnStart();

    nowMs += 50;
    collector.recordToolCall({ toolCallId: "call-1", toolName: "read" });

    nowMs += 25;
    collector.recordToolResult({ toolCallId: "call-1", toolName: "read", success: true });

    nowMs += 100;
    collector.recordTurnEnd();

    nowMs += 200;
    collector.recordSessionEnd();

    const status = collector.getStatus();
    expect(status.sessions).toBe(1);
    expect(status.turns).toBe(1);
    expect(status.toolCalls).toBe(1);
    expect(status.toolResults).toBe(1);

    expect(status.durations.tool.count).toBe(1);
    expect(status.durations.tool.lastMs).toBe(25);
    expect(status.durations.turn.lastMs).toBe(175);
    expect(status.durations.session.lastMs).toBe(525);

    expect(status.provider).toBe("anthropic");
    expect(status.model).toBe("claude-sonnet");
  });

  it("tracks prompts and token/cost usage", () => {
    const collector = createMetricsCollector({ now: () => 1_000 });
    collector.recordPrompt({ promptLength: 120 });

    collector.recordUsage({
      input: 100,
      output: 20,
      cacheRead: 5,
      cacheWrite: 3,
      totalTokens: 128,
      cost: {
        input: 0.01,
        output: 0.002,
        cacheRead: 0.0001,
        cacheWrite: 0.0002,
        total: 0.0123,
      },
    });

    const status = collector.getStatus();
    expect(status.prompts).toBe(1);
    expect(status.tokens).toEqual({
      input: 100,
      output: 20,
      cacheRead: 5,
      cacheWrite: 3,
      total: 128,
    });
    expect(status.cost.total).toBeCloseTo(0.0123, 6);
  });

  it("does not emit session.id in metric attributes", () => {
    const meter = new CapturingMeter();
    const collector = createMetricsCollector({
      now: () => 1_000,
      meter: meter as never,
    });

    collector.setProviderModel("anthropic", "claude-sonnet");
    collector.recordSessionStart();
    collector.recordPrompt({ promptLength: 10 });
    collector.recordTurnStart();
    collector.recordToolCall({ toolCallId: "c1", toolName: "read" });
    collector.recordToolResult({ toolCallId: "c1", toolName: "read", success: true });
    collector.recordTurnEnd();
    collector.recordSessionEnd();

    const attrSets = meter.counters
      .flatMap((counter) => counter.attrs)
      .concat(meter.histograms.flatMap((histogram) => histogram.attrs))
      .filter((attrs): attrs is Record<string, unknown> => Boolean(attrs));

    for (const attrs of attrSets) {
      expect(Object.keys(attrs)).not.toContain("session.id");
    }
  });
});
