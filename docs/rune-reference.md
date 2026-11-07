# Rune art and reference data

- Game Vault source: https://archero-2.game-vault.net/wiki/Runes
- Live page was blocked by Cloudflare. Reference recovered from the 2026-03-16 archive: https://web.archive.org/web/20260316234950/https://archero-2.game-vault.net/wiki/Runes (page last edited 2026-03-10).
- Mobi.gg design reference: https://mobi.gg/en/tips/archero-2-runes/ ; archived https://web.archive.org/web/20250622051453/https://mobi.gg/en/tips/archero-2-runes/ . Its site accent colors inspire category markers, not authoritative rarity colors.
- Rarity colors come from the wiki table headers: Normal #cecddb, Fine #3fa43d, Rare #4695d1, Epic #a260ec, Legendary #ff9753, Mythic #e65355. Intermediate ranks keep their parent rarity color.
- All 46 names, base text and tier cells are retained, including blank cells. Blessing, Enhancement and Ability also retain six tiers of rune-specific and shared enchantments. Etched has no enchantment table in this source.
- This update changes art and reference presentation. It does not implement every described combat mechanic. Existing combat handlers remain unchanged.

## Supplied icon ambiguity

The user supplied 45 named PNGs. Two are explicitly labelled Star_of_Fury (Skill_007 and Skill_009). Both are preserved in RuneImageManifest and as separate local assets; Skill_009 is the displayed Star of Fury. Do not silently rename Skill_007 to Arrow Rain. Consequently 44 distinct runes have local art; Arrow Rain and Echo Scythe retain SVG fallback until their images are supplied or confirmed.

## Regeneration

Run `node tools/sync-rune-reference.mjs <saved-wiki.html> <composer-images-directory>`.
The script validates 46 reference rows, maps user filenames by name, preserves both Fury variants and produces rune-wiki-data.js and rune-wiki-images.js. For repeated uploads of the same labelled file it selects the most recently modified copy. It never fetches a URL or changes save data.

Verify with `node --max-old-space-size=128 --test --test-concurrency=1 tests/rune-economy.test.mjs tests/rune-board-save.test.mjs tests/rune-purchase-api.test.mjs`.
