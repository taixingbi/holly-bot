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
fly deploy
```

To confirm: `fly secrets list`. If you see "MCP unavailable" or "Available: (none)", check that `MCP_URL` is set and the MCP server is reachable.
# holly-bot
# holly-bot
