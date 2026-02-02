/**
 * MCP (Model Context Protocol) client.
 * Connects to a remote MCP server over Streamable HTTP and exposes tools for the LangGraph agent.
 * Mirrors the Python MCPServerStreamableHttp pattern: list_tools, call_tool(name, args).
 */

import { config } from "./config";

const MCP_PROTOCOL_VERSION = "2024-11-05";

export function getMcpSqlToolName(): string {
  return config.mcp.sqlTool;
}

export interface McpTool {
  name: string;
  invoke: (args: { input: string }) => Promise<unknown>;
}

let sessionPromise: Promise<{ url: string; sessionId: string | null } | null> | null =
  null;

async function getMcpUrl(): Promise<string | null> {
  const raw = config.mcp.url;
  const url = raw ? raw.replace(/\/?$/, "/") : "";
  return url || null;
}

async function getOrCreateSession(): Promise<{
  url: string;
  sessionId: string | null;
} | null> {
  const url = await getMcpUrl();
  if (!url) return null;

  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    try {
      const initRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: { tools: {} },
            clientInfo: { name: "holly-bot", version: "0.1.0" },
          },
        }),
        signal: AbortSignal.timeout(config.mcp.timeoutMs),
      });

      const sessionId = initRes.headers.get("Mcp-Session-Id");
      if (!sessionId) {
        return { url, sessionId: null };
      }

      const initResult = await initRes.json();
      if (initResult.error) {
        return { url, sessionId: null };
      }

      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "Mcp-Session-Id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
      });

      return { url, sessionId };
    } catch {
      return { url, sessionId: null };
    }
  })();

  return sessionPromise;
}

async function mcpRequest<T>(
  url: string,
  sessionId: string | null,
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const id = Math.floor(Math.random() * 1e9);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }),
    signal: AbortSignal.timeout(config.mcp.sseReadTimeoutMs),
  });

  const text = await res.text();
  let raw: unknown;
  if (text.trim().startsWith("{")) {
    raw = JSON.parse(text);
  } else {
    const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
    const jsonStr = dataLine?.replace(/^data:\s*/, "").trim();
    if (!jsonStr) throw new Error("No JSON in SSE response");
    raw = JSON.parse(jsonStr);
  }
  const data = (raw as { data?: unknown })?.data ?? raw;
  if ((data as { error?: unknown })?.error)
    throw new Error(
      (data as { error?: { message?: string } }).error?.message ||
        JSON.stringify((data as { error?: unknown }).error)
    );
  return (data as { result: T }).result;
}

/**
 * Fetches available tools from the remote MCP server (Streamable HTTP).
 * Returns an array of tools that can be invoked by name.
 * Supports stateless servers (no session) - always returns sql_agent fallback when MCP_URL is set.
 */
export async function getMcpTools(): Promise<McpTool[]> {
  const url = await getMcpUrl();
  if (!url) return [];

  const session = await getOrCreateSession();
  let tools: { name: string }[] = [];
  if (session) {
    try {
      const result = await mcpRequest<{ tools?: { name: string }[] }>(
        session.url,
        session.sessionId,
        "tools/list",
        {}
      );
      const rawTools = Array.isArray(result) ? result : result?.tools ?? [];
      tools = rawTools.map((t) => (typeof t === "string" ? { name: t } : t));
    } catch {
      /* tools/list failed, use fallback */
    }
  }
  if (tools.length === 0) {
    tools = [{ name: getMcpSqlToolName() }];
  }

  return tools.map((t) => ({
    name: t.name,
    invoke: async (args: { input: string }) => {
      const s = await getOrCreateSession();
      if (!s)
        throw new Error(
          "MCP unavailable. Check MCP_URL and that the MCP server is reachable from this environment."
        );
      const toolName = t.name;
      const sqlTool = getMcpSqlToolName();
      const callResult = await mcpRequest<{
        content?: { type: string; text?: string | { answer?: string } }[];
        structuredContent?: { result?: { answer?: string; error?: string } };
        isError?: boolean;
      }>(s.url, s.sessionId ?? null, "tools/call", {
        name: toolName,
        arguments:
          toolName === sqlTool
            ? { args: { question: args.input, limit: 10 } }
            : { input: args.input },
      });
      if (callResult?.isError) {
        const err =
          callResult.structuredContent?.result?.error ??
          callResult.content
            ?.map((c) =>
              c.type === "text"
                ? typeof c.text === "string"
                  ? c.text
                  : c.text?.answer ?? ""
                : ""
            )
            .join("");
        const msg = err || "Tool returned error";
        const hint = /unknown tool/i.test(msg)
          ? " Set MCP_SQL_TOOL (in config) to the tool name your MCP server exposes (e.g. from its docs or tools/list)."
          : "";
        throw new Error(msg + hint);
      }
      const fromStructured = callResult?.structuredContent?.result?.answer;
      if (fromStructured) return fromStructured;
      const fromContent = callResult?.content
        ?.map((c) =>
          c.type === "text"
            ? typeof c.text === "string"
              ? c.text
              : c.text?.answer ?? JSON.stringify(c.text)
            : ""
        )
        .join("");
      return fromContent ?? callResult;
    },
  }));
}
