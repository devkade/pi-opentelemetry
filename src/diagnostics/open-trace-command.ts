export function buildTraceUrl(baseUrl: string, traceId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${traceId}`;
}

export function getOpenUrlCommand(platform: NodeJS.Platform, url: string): { command: string; args: string[] } {
  if (platform === "darwin") {
    return { command: "open", args: [url] };
  }

  if (platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", url] };
  }

  return { command: "xdg-open", args: [url] };
}

export async function openTraceUrl(
  platform: NodeJS.Platform,
  url: string,
  exec: (command: string, args: string[]) => Promise<{ code: number; stderr?: string }>,
): Promise<{ ok: boolean; error?: string }> {
  const cmd = getOpenUrlCommand(platform, url);
  const result = await exec(cmd.command, cmd.args);

  if (result.code === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    error: result.stderr?.trim() || `failed to open trace url (exit ${result.code})`,
  };
}
