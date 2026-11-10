# Final reward reveal acceptance

Run `node tools/verify-reward-browser.mjs`. Real Chrome + real HTTP handlers + isolated memory DB; no production data or environment secrets.

Final stable execution: **14 passed, 0 failed**; no page errors or save 409. Covers wishes 1/10/100, insufficient gems, Island dice, Demon 1/10, fishing reel/ten, World Tree pickaxe/bomb/drill, rune board single, Gold Cave roulette/cashout. Wishes use decoded artwork and displayed granted stars equal actual star deltas, including explicit zero-gain capped outcomes. Mobile 390x600 and 360x480, keyboard containment, last-card reachability and presentation-only dismissal passed.

Additional handler tests cover Plinko stop/leave/insufficient batches, wheel acknowledgment/retry/skip, legacy artifact wishes, campaign sweep, random gem craft, special mining cells, rune flush/freeze/response loss. Full suite: 816 pass, 4 baseline failures, 9 skipped (battle-ui, chapter-victory, two hero-selection-ownership fixtures).

Limits: no production/Mongo durability or screen-reader audit; promised/VIP rune variants and some legacy handlers have fixture rather than real-browser coverage. Every local event ordinary-save persistence is not independently proven by this matrix. See result.json/report.md and tests/event-reward-results-inventory.md.

