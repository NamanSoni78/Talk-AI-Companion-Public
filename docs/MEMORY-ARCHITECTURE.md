# Memory Architecture — how Talk remembers (and why this playground doesn't)

> **TL;DR:** This playground is intentionally memory-less — conversations live in `localStorage` and die on refresh. The full [Talk app](https://talkaicompanion.com?utm_source=github&utm_medium=memory_doc) implements the 4-tier system below, and this doc is the public design note on it.

## The problem with AI companions

Most AI chats reset the moment you close the tab. You come back, and the "companion" asks your name again — the relationship you built evaporated with the session. That's a query box, not a companion.

Talk was designed to be the opposite: **the memory is the product**.

## The 4-tier system

Tell Arya about your placement season on Monday, and on Friday she asks how the interview went. That "magic" is four cooperating layers:

### Tier 1 — Rolling summaries
Every conversation is condensed into a living summary of the relationship: what you talk about, where things stand, running jokes, current mood. This is what keeps the companion's *tone* continuous — she doesn't just remember facts, she remembers *the vibe* of your friendship.

### Tier 2 — Hard facts
The things that must never be forgotten get pinned: your name, your college, your best friend's name, exam dates, the internship you mentioned once, your birthday. Deterministic, always in context, never paraphrased away.

### Tier 3 — Event log
A chronological record of what happened — the fight you told Kabir about, the win you celebrated with Rohan, the Sunday call with Mira. This is the companion's autobiography of *your* relationship.

### Tier 4 — Semantic recall
When you mention something related to an old conversation, the *relevant* memory surfaces — not everything, the right thing. Mention "that professor" and the right complaint from three weeks ago comes back, without the other 200 conversations.

## Why the playground skips all this

1. **Cost & keys.** Semantic recall needs embeddings + storage. The playground runs on free-tier Workers with no database — that's the whole reason you can self-host it in 2 minutes.
2. **The tease is the point.** The playground is the free taste: you feel the personality, hit the memory wall, and the [full app](https://talkaicompanion.com?utm_source=github&utm_medium=memory_doc) is waiting with the real thing. Memory is the upgrade.

## What this playground does instead

- Conversation state persists in `localStorage` per companion (`talk-playground-v1`) — survives refreshes *within* a browser, dies on reset/clear.
- The last 12 messages ride along on each request so short-term context works.
- That's it. By design.

## Implementing your own (sketch)

If you're forking this into a real product, a pragmatic v1 of the Talk model looks like:

```
session ends
   ├── LLM call: "condense this chat into / merge with existing summary"  → Tier 1
   ├── regex/LLM extract: names, dates, commitments                        → Tier 2 (store as facts)
   ├── append events to a log table                                        → Tier 3
   └── (later) embed transcripts → vector search top-k                     → Tier 4
next session
   system prompt = card + Tier 1 summary + Tier 2 facts (+ Tier 4 top-k on demand)
```

Tiers 1-2 get you 80% of the "she remembers me" feeling. Tier 4 is where it starts feeling impossible.

---

*Want to feel the real thing instead of reading about it? [Talk is free to start — sirf naam, no OTP.](https://talkaicompanion.com?utm_source=github&utm_medium=memory_doc)*
