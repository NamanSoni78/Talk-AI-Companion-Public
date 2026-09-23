# Contributing

Thanks for wanting to help! This repo is deliberately small — a worker, a single-file UI, and a folder of character cards — so most contributions fall into one of these buckets.

## 🥇 The good stuff: new character cards

The highest-value PR is a **new companion**. Cards live in [`public/characters/`](public/characters/) as [Character Card V2](docs/CHARACTER-CARDS.md) JSON.

Guidelines:

1. **SFW only.** The playground is rated 13+. Cards that lean explicit will be declined — the system prompt blocks it anyway, so the card just ends up fighting the worker.
2. **Personality > backstory.** The best cards define *how someone talks*, not their wikipedia page. Show the voice in `mes_example`.
3. **Hinglish encouraged.** The whole point of Talk is Indian characters written the way India actually texts. English-only cards are fine too, but tell us the Hinglish ratio.
4. **Keep `first_mes` under ~300 chars** — it's a chat opener, not a novel.
5. **Fill in `creator_notes`** — credit yourself (name/handle/link).
6. Run your card through validation (the [GitHub Action](.github/workflows/validate-characters.yml) does it on every PR):
   ```bash
   node scripts/validate-characters.mjs
   ```

If your character is really good it might even graduate to the full app at [talkaicompanion.com](https://talkaicompanion.com?utm_source=github&utm_medium=contributing) — with credit.

## UI / worker improvements

- The UI is a **single HTML file with no build step** — keep it that way. No frameworks, no bundlers.
- The worker is dependency-free JavaScript — keep it that way too.
- PRs must not introduce: user-supplied system prompts, image generation, or anything that breaks the SFW layer.

## Commit style & PRs

- Descriptive titles (`add companion: meera, the CA-student bestie` > `update json`)
- One logical change per PR.
- Be nice. Desi warmth encouraged. 🫖

## Reporting issues

Bugs → open an issue with: what you did, what you expected, what happened, and whether you're on the hosted demo or self-hosted (which provider/model).

## License

By contributing you agree your contributions are MIT-licensed, like the repo.
