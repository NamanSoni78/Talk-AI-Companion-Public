#!/usr/bin/env node
/**
 * Validates every Character Card V2 JSON in public/characters/.
 * Runs locally (node scripts/validate-characters.mjs) and in CI.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const DIR = new URL("../public/characters", import.meta.url).pathname;
const REQUIRED = ["name", "description", "personality", "scenario", "first_mes", "mes_example", "creator_notes", "tags", "creator"];
const SFW_BLOCKLIST = [/explicit sex/i, /nude/i, /nsfw pics/i, /erotic roleplay/i];

let failures = 0;
const files = (await readdir(DIR)).filter((f) => f.endsWith(".json"));

if (!files.length) {
  console.error("✗ no character cards found in", DIR);
  process.exit(1);
}

for (const file of files) {
  const path = join(DIR, file);
  const label = file.replace(".json", "");

  try {
    const raw = await readFile(path, "utf8");
    const card = JSON.parse(raw);

    const errors = [];

    if (card.spec !== "chara_card_v2") errors.push(`spec must be "chara_card_v2"`);
    if (String(card.spec_version || "") !== "2.0") errors.push(`spec_version must be "2.0"`);

    const d = card.data || {};
    for (const field of REQUIRED) {
      const v = d[field];
      const empty = v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);
      if (empty) errors.push(`data.${field} is missing/empty`);
    }

    if (d.name && d.name.length > 40) errors.push(`data.name too long (max 40 chars)`);
    if (d.first_mes && d.first_mes.length > 600) errors.push(`data.first_mes too long (max 600 chars — chat opener, not a novel)`);
    if (d.description && d.description.length > 2000) errors.push(`data.description too long (max 2000 chars)`);

    const searchable = [d.description, d.personality, d.first_mes, d.mes_example].filter(Boolean).join(" \n ");
    for (const rx of SFW_BLOCKLIST) {
      if (rx.test(searchable)) errors.push(`SFW violation: matches ${rx}`);
    }

    if (!Array.isArray(d.tags) || !d.tags.length) errors.push("data.tags must be a non-empty array");

    if (errors.length) {
      failures++;
      console.error(`✗ ${label}\n   ${errors.join("\n   ")}`);
    } else {
      console.log(`✓ ${label} — ${d.name} (${d.tags.length} tags, first_mes ${d.first_mes.length} chars)`);
    }
  } catch (e) {
    failures++;
    console.error(`✗ ${label} — JSON parse error: ${e.message}`);
  }
}

console.log(
  failures
    ? `\n${failures} card(s) failed validation.`
    : `\nAll ${files.length} card(s) valid. Cards ready for the playground 🎉`
);
process.exit(failures ? 1 : 0);
