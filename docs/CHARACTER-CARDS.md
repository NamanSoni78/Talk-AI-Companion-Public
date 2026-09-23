# Character Cards — the V2 spec, Talk-style

Every companion in the playground is a **Character Card V2** JSON file in [`public/characters/`](../public/characters/). V2 is the community spec popularized by SillyTavern, which means cards built here work in other frontends — and cards built elsewhere can work here.

## The file

```jsonc
{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "data": {
    // core V2 fields
    "name": "Arya",
    "description": "Who they are — 2-5 tight sentences. Drives the model's understanding most.",
    "personality": "Trait soup: warm, loud, brutally honest…",
    "scenario": "One line of stage-setting for the chat.",
    "first_mes": "The opening message the user sees.",
    "mes_example": "<START>\n{{user}}: …\n{{char}}: …",  // THE most underrated field — shows the voice
    "creator_notes": "Credit + context. Link yourself.",
    "system_prompt": "",               // playground injects its own; keep empty
    "post_history_instructions": "",   // keep empty
    "alternate_greetings": [],
    "tags": ["ai-companion", "hinglish", "…"],
    "creator": "your-handle",
    "character_version": "1.0",

    // Talk-specific metadata (safe to omit — UI falls back gracefully)
    "extensions": {
      "talk": {
        "slug": "arya",
        "avatar": "/assets/companions/arya.png",
        "tagline": "your 2AM bestie — gossip, gyaan & gussa",
        "hinglish_ratio": "65%",
        "vibes": ["2AM energy", "brutally honest", "chai + SRK"],
        "playground": true,
        "full_profile": "https://talkaicompanion.com/companions/arya"
      }
    }
  }
}
```

## Field priorities (what actually matters)

1. **`mes_example`** — few people write it well; it's the single best lever for voice consistency. Write 2-4 exchanges that *could only come from this character*.
2. **`description`** — concrete beats poetic. "Gets angry on your behalf when people hurt you" > "a complex soul".
3. **`personality`** — 5-10 comma traits, front-load the dominant ones.
4. **`first_mes`** — under 300 chars, in-voice, ends with an invitation to reply.

## How the worker uses cards

On each request the worker:

1. validates the requested companion against an allowlist (`ALLOWED_COMPANIONS` in `worker.js` — add your slug there in the same PR),
2. fetches the card JSON from static assets (server-side — clients can't inject their own),
3. wraps it in the playground's SFW system layer,
4. sends `card.description + personality + scenario + mes_example` as the character context.

The UI roster (`COMPANIONS` in `public/index.html`) mirrors the cards for the demo fallback — keep both in sync when adding a companion.

## Adding your companion, end to end

```
1. public/characters/your-slug.json     ← the card
2. public/assets/companions/your-slug.png  ← square-ish avatar
3. worker.js:  ALLOWED_COMPANIONS += "your-slug"
4. index.html: COMPANIONS["your-slug"] = { name, tagline, status, avatar, chips, greeting }
5. node scripts/validate-characters.mjs   ← must pass
6. PR it 🎉
```

## Style notes for Talk cards

- **Hinglish ratio** is a feature, not a bug — say the percentage in `extensions.talk.hinglish_ratio` and mean it.
- Characters should **want things**: Arya wants the gossip, Kabir wants your Monday plan, Noor wants you to earn the nickname.
- Keep every field SFW — the server layer enforces it regardless.

---

*The 6 launch cards were written by the Talk team as teasers of the full companions — more depth, memory and voice await at [talkaicompanion.com](https://talkaicompanion.com?utm_source=github&utm_medium=character_cards).*
