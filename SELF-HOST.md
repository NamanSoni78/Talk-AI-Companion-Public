# Self-Hosting the Talk Playground

The whole thing is **one Cloudflare Worker + one static folder**. Free tier friendly: no server, no Docker, no database. If you can run `npm install`, you can host this.

> Prefer watching buttons over reading? → **[Deploy to Cloudflare](https://deploy.workers.cloudflare.com/?url=https://github.com/NamanSoni78/Talk-AI-Companion-Public)** and jump to [Step 3](#3-set-your-secrets).

---

## 1. Prerequisites

- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- Node.js 18+
- An API key (or several) from **any OpenAI-compatible provider**:
  OpenAI · Groq (generous free tier) · Together · OpenRouter · Cerebras · your own proxy

## 2. Get the code

```bash
git clone https://github.com/NamanSoni78/Talk-AI-Companion-Public
cd Talk-AI-Companion-Public
npm install
```

## 3. Set your secrets

Secrets never touch git. Set them locally for dev:

```bash
cp .dev.vars.example .dev.vars
# edit .dev.vars with your keys
```

```ini
# .dev.vars — local development
API_KEYS=sk-first-key;sk-second-key;sk-third-key
API_BASE_URL=https://api.groq.com/openai/v1
API_MODEL=llama-3.1-8b-instant
```

### How key rotation works

`API_KEYS` is a **semicolon-separated list**. On every request the worker:

1. **picks one key at random** (spreads load across your quota),
2. calls your `API_BASE_URL`,
3. if it gets `429` (rate limited) / `401` / `403` → **silently retries with a different key** (up to 3 attempts),
4. streams the response back.

So with N keys your effective rate limit is roughly **N × single-key quota**. 10 free-tier Groq keys ≈ a very chatty playground.

### The full env var table

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `API_KEYS` | ✅ | — | Semicolon-separated API keys. Random pick per request + rotation on failure. |
| `API_BASE_URL` | ✅ | — | OpenAI-compatible base URL (must expose `/chat/completions`). |
| `API_MODEL` | ✅ | — | Model name, e.g. `gpt-4o-mini`, `llama-3.1-8b-instant`. |
| `RATE_LIMIT_PER_DAY` | ➖ | `40` | Messages per IP per day. |
| `ALLOWED_ORIGINS` | ➖ | — | Comma-separated origins allowed to call `/api/chat` cross-origin (e.g. if you host the UI on GitHub Pages separately). |

## 4. Run locally

```bash
npm run dev
# → http://localhost:8787
```

## 5. Deploy to Cloudflare Workers (free)

```bash
npx wrangler login          # once
npx wrangler secret put API_KEYS      # paste: sk-aaa;sk-bbb;sk-ccc
npx wrangler secret put API_BASE_URL  # paste: https://api.groq.com/openai/v1
npx wrangler secret put API_MODEL     # paste: llama-3.1-8b-instant
npx wrangler deploy
```

Done. Your playground is live on `https://talk-ai-companion-playground.<your-subdomain>.workers.dev` — static UI and API on the same domain, no CORS setup needed.

### Custom domain

In the Cloudflare dashboard: **Workers & Pages → your worker → Settings → Domains & Routes → Add → Custom domain**. Any domain on your Cloudflare account works, SSL included. Something like `playground.yourdomain.com` fits nicely.

---

## Optional upgrades

### Durable rate limiting with Workers KV

The built-in limiter is in-memory per isolate — fine for a demo, approximate at scale (redeploys reset it). For exact cross-isolate limits:

1. Create a KV namespace: `wrangler kv namespace create RATE_LIMITS`
2. Add to `wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "RATE_LIMITS"
   id = "<namespace-id>"
   ```
3. Swap the `buckets` Map in `worker.js` for KV reads/writes (`ctx.waitUntil` + TTL).

### Hosting the UI separately (GitHub Pages, Netlify, etc.)

`public/` is a fully static site. Deploy it anywhere, then point it at your worker:

```
https://yourname.github.io/Talk-AI-Companion-Public/?api=https://talk-ai-companion-playground.yourname.workers.dev
```

And allow the origin on the worker (dashboard → Settings → Variables, or `wrangler secret put ALLOWED_ORIGINS`):

```ini
ALLOWED_ORIGINS=https://yourname.github.io
```

Without a live backend the UI still runs in **scripted demo mode** — nice for showcasing the interface with zero cost.

### Choosing a model

The playground sends **≤12 messages of history** and caps replies at ~260 tokens, so cheap/fast models work great:
`gpt-4o-mini` · `llama-3.1-8b-instant` (Groq, fast + free tier) · `gemini-2.0-flash` via OpenAI-compat proxies. Avoid huge reasoning models — chat vibes > benchmark scores.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `"not_configured"` error in chat | One of `API_KEYS` / `API_BASE_URL` / `API_MODEL` isn't set on the deployed worker. `wrangler secret list` to check. |
| `"all_keys_failed"` | Every key got 429/401 — keys exhausted or wrong `API_BASE_URL`. Test one key with `curl`. |
| UI loads but chat says "scripted demo mode" | The page can't reach `/api/health` — you're on static-only hosting. Deploy the worker or pass `?api=<worker-url>`. |
| CORS error in console | You're calling the worker from another origin — set `ALLOWED_ORIGINS`. |

## Security notes

- Keys live **only** as Worker secrets — never in the repo, never in the browser.
- User input is capped (~900 chars) and message count trimmed (last 12) before it reaches your provider.
- The character card + SFW system prompt are injected **server-side**; clients can't override them.
- Rate limiting is per-IP; raise/lower via `RATE_LIMIT_PER_DAY`.

---

*Self-hosting is the point of open source — but if you'd rather just chat, the hosted version (with memory, voice and 11 companions) is at [talkaicompanion.com](https://talkaicompanion.com?utm_source=github&utm_medium=self_host).*
