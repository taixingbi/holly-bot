/**
 * App config. Values can be overridden via environment variables.
 * Uses getters so process.env is read at access time (important for Next.js).
 */

function fromEnv(name: string, fallback: string): string {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  const trimmed = v.split("#")[0].trim().replace(/^["']|["']$/g, "").trim();
  return trimmed || fallback;
}

export const config = {
  get mcp() {
    return {
      url: fromEnv("MCP_URL", "https://mcp-tool-sql.fly.dev/mcp/"),
      sqlTool: fromEnv("MCP_SQL_TOOL", "sql_agent"),
      timeoutMs: Number(process.env.MCP_TIMEOUT_MS ?? 30_000),
      sseReadTimeoutMs: Number(process.env.MCP_SSE_READ_TIMEOUT_MS ?? 120_000),
    };
  },
  get eval() {
    return {
      dataset: fromEnv("EVAL_DATASET", "holly-bot-eval"),
      concurrency: Number(process.env.EVAL_CONCURRENCY ?? 4),
      experimentPrefix: fromEnv("EVAL_EXPERIMENT_PREFIX", "holly-bot-v1.01"),
    };
  },
};
