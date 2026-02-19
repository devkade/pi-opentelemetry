import { describe, expect, it } from "vitest";
import { buildTraceUrl, getOpenUrlCommand } from "../src/diagnostics/open-trace-command.js";

describe("open trace command utils", () => {
  it("builds trace url", () => {
    expect(buildTraceUrl("http://localhost:16686/trace", "abc")).toBe("http://localhost:16686/trace/abc");
    expect(buildTraceUrl("http://localhost:16686/trace/", "abc")).toBe("http://localhost:16686/trace/abc");
  });

  it("returns platform-specific open command", () => {
    expect(getOpenUrlCommand("darwin", "https://example.com")).toEqual({
      command: "open",
      args: ["https://example.com"],
    });

    expect(getOpenUrlCommand("win32", "https://example.com")).toEqual({
      command: "cmd",
      args: ["/c", "start", "", "https://example.com"],
    });

    expect(getOpenUrlCommand("linux", "https://example.com")).toEqual({
      command: "xdg-open",
      args: ["https://example.com"],
    });
  });
});
