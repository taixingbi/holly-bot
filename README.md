# holly bot

## Design

### Architecture

- **Next.js 15** (App Router) – frontend and API routes
- **LangGraph** – routing graph for LLM vs SQL
- **MCP (Model Context Protocol)** – remote SQL tool via Streamable HTTP
- **OpenAI** – LLM (gpt-4o-mini)

### Components

| Component | Purpose |
|-----------|---------|
| `app/chat/page.tsx` | Chat UI with message list, loading states (Thinking…, Searching SQL…, From cache…) |
| `app/api/chat/route.ts` | API handler: cache check, routing, SSE stream or JSON response |
| `app/lib/graph-core.ts` | LangGraph: keyword-based routing, LLM node, SQL node |
| `app/lib/mcp_client.ts` | MCP client; connects to remote SQL server, exposes `sql_agent` tool |
| `app/lib/query-cache.ts` | In-memory cache (max 500 entries) with normalized keys |
| `app/lib/config.ts` | Central config: MCP URL, timeouts, eval settings |

### Routing

- **LLM path**: General questions (greetings, non-data queries).
- **SQL path**: Salary/job/jurisdiction queries (e.g. pay, salary, amount, jurisdiction, job keywords).

## Workflow

1. **User sends message** → `POST /api/chat` with `{ message }`.
2. **Cache check** → Normalized query (lowercase, trim, no punctuation) looked up in cache.
   - **Cache hit** → Return JSON `{ cached: true, response }`.
   - **Cache miss** → Continue.
3. **Route determination** → `route()` decides `llm` or `sql` from keywords.
4. **Stream status** → Emit SSE event: `thinking` or `searching_sql`.
5. **Execute**:
   - **LLM path**: `ChatOpenAI.invoke(message)`.
   - **SQL path**: MCP `tools/call` with `sql_agent` on remote server.
6. **Cache result** → Store response for future requests.
7. **Stream result** → Emit SSE `result` or `error`.
8. **Client** → Consumes SSE stream and updates UI with status and final response.

---

## Local run

```bash
pnpm install
pnpm test
pnpm dev
```

Production build:

```bash
pnpm build
pnpm start
```

## Eval

```bash
pnpm exec tsx app/eva/run_eval.ts
```

## Docker

```bash
pnpm docker:build
pnpm docker:run
```

Or: `docker build -t holly-bot .` then `docker run -p 3000:3000 --env-file .env.local holly-bot`. The app listens on port 3000.

## Deploy on Fly.io

Set secrets before deploy:

```bash
fly auth login
fly deploy
```

To confirm: `fly secrets list`. If you see "MCP unavailable" or "Available: (none)", check that `MCP_URL` is set and the MCP server is reachable.
