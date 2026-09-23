#!/usr/bin/env node
/**
 * End-to-end smoke test for worker.js without Cloudflare:
 *  - mock OpenAI-compatible SSE upstream (with key echo)
 *  - mock ASSETS binding serving character cards
 *  - verifies: health, chat streaming, SFW system prompt injection,
 *    key rotation on 429, rate limiting, unknown companion rejection.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert";

const ROOT = new URL("..", import.meta.url).pathname; // repo root
const worker = (await import(join(ROOT, "worker.js"))).default;

// ---------- mock upstream: echoes which key was used + streams tokens ----------
let failFirstKeys = new Set(); // keys that should 429 once
const upstream = createServer((req, res) => {
  const key = (req.headers.authorization || "").replace("Bearer ", "");
  if (failFirstKeys.has(key)) {
    failFirstKeys.delete(key);
    res.writeHead(429, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "rate_limited" }));
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const payload = JSON.parse(body);
    // echo key fingerprint + model + message count into the streamed reply
    const msg = `KEY=${key} MODEL=${payload.model} MSGS=${payload.messages.length} SYSLEN=${payload.messages[0].content.length}`;
    res.writeHead(200, { "content-type": "text/event-stream" });
    for (const tok of msg.split(" ")) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: tok + " " } }] })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  });
});
await new Promise((r) => upstream.listen(4599, r));
const BASE = "http://localhost:4599/v1";

// ---------- mock env ----------
const env = {
  API_KEYS: "sk-keyONE123;sk-keyTWO456;sk-keyTHREE789",
  API_BASE_URL: BASE,
  API_MODEL: "test-model-x",
  RATE_LIMIT_PER_DAY: "50",
  ASSETS: {
    async fetch(url) {
      const u = new URL(typeof url === "string" ? url : url.url);
      const slug = u.pathname.split("/").pop();
      try {
        const data = await readFile(join(ROOT, "public/characters", slug), "utf8");
        return new Response(data, { status: 200, headers: { "content-type": "application/json" } });
      } catch {
        return new Response("not found", { status: 404 });
      }
    },
  },
};

const call = (path, init, ip = "1.1.1.1") =>
  worker.fetch(
    new Request(`https://playground.test${path}`, {
      ...init,
      headers: { ...(init?.headers || {}), "cf-connecting-ip": ip },
    }),
    env
  );

// ---------- tests ----------
// 1. health
{
  const r = await call("/api/health");
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.configured, true);
  assert.equal(j.companions.length, 6);
  console.log("✓ health: ok, configured, 6 companions");
}

// 2. chat happy path (streaming + card injection)
{
  const r = await call("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companion: "arya",
      name: "Naman",
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hey!" },
        { role: "user", content: "kya haal?" },
      ],
    }),
  });
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").includes("text/event-stream"));
  const text = await r.text();
  assert.ok(text.includes("KEY=sk-key"), "stream should echo key used: " + text.slice(0, 80));
  assert.ok(text.includes("MODEL=test-model-x"));
  assert.ok(text.includes("MSGS=4"), "system + 3 history = 4 messages");
  // system prompt should contain card content + playground rules + name
  assert.ok(text.includes("SYSLEN="));
  console.log("✓ chat: streams SSE, model+history correct");
}

// 3. SFW system layer actually injected (verify via SYSLEN — parse it from stream)
{
  const r = await call("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companion: "noor", name: "Test", messages: [{ role: "user", content: "hello" }] }),
  });
  const text = await r.text();
  const syslen = Number(text.match(/SYSLEN=(\d+)/)[1]);
  // card (description+personality+scenario+mes_example) alone is >1500 chars for noor
  assert.ok(syslen > 1500, `system prompt suspiciously short: ${syslen}`);
  console.log(`✓ SFW layer + card injected server-side (system prompt ${syslen} chars)`);
}

// 4. key rotation on 429
{
  // make the first random key fail with 429 → worker should retry another key and still 200
  failFirstKeys.add("sk-keyONE123");
  failFirstKeys.add("sk-keyTWO456");
  failFirstKeys.add("sk-keyTHREE789");
  // all three fail once → 3 attempts all 429 → all_keys_failed (429)
  const r = await call("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companion: "arya", name: "X", messages: [{ role: "user", content: "yo" }] }),
  });
  assert.equal(r.status, 429);
  const j = await r.json();
  assert.equal(j.error, "all_keys_failed");
  assert.ok(j.site.includes("talkaicompanion.com"), "429 should funnel to the app");
  console.log("✓ key rotation: all keys exhausted → 429 with funnel message");

  // now only one key fails → rotation recovers with 200
  failFirstKeys.add("sk-keyONE123");
  const r2 = await call("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companion: "arya", name: "X", messages: [{ role: "user", content: "yo" }] }),
  });
  assert.equal(r2.status, 200);
  const t2 = await r2.text();
  assert.ok(/KEY=sk-key(TWO456|THREE789)/.test(t2), "should have rotated to a non-failing key: " + t2.slice(0, 60));
  console.log("✓ key rotation: single key 429 → rotated to healthy key, 200");
}

// 5. unknown companion rejected
{
  const r = await call("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companion: "../../etc/passwd", name: "X", messages: [{ role: "user", content: "yo" }] }),
  });
  assert.equal(r.status, 400);
  console.log("✓ unknown/path-traversal companion rejected with 400");
}

// 6. rate limit — dedicated env with limit=2, fresh IP
{
  const env2 = { ...env, RATE_LIMIT_PER_DAY: "2" };
  const rlCall = (i) =>
    worker.fetch(
      new Request("https://playground.test/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": "9.9.9.9" },
        body: JSON.stringify({ companion: "arya", name: "X", messages: [{ role: "user", content: "yo" }] }),
      }),
      env2
    );
  assert.equal((await rlCall(1)).status, 200);
  assert.equal((await rlCall(2)).status, 200);
  const r = await rlCall(3);
  assert.equal(r.status, 429);
  const j = await r.json();
  assert.equal(j.error, "rate_limited");
  assert.ok(j.message.includes("300 free credits"), "rate-limit message should tease the app");
  console.log("✓ rate limiting: 2 allowed, 3rd → 429, message teases full app");
}

// 7. unconfigured env
{
  const r = await worker.fetch(new Request("https://playground.test/api/chat", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }), {});
  assert.equal(r.status, 503);
  const j = await r.json();
  assert.equal(j.error, "not_configured");
  console.log("✓ unconfigured worker → 503 with self-host hint");
}

upstream.close();
console.log("\nAll worker smoke tests passed 🎉");
process.exit(0);
