# Server patrol

`api/patrol.js` exports authenticated GET and POST, Node runtime. No production environment or database is required by the tests.

## Integration contract

- Route GET/POST `/api/patrol` through the dev server and deployment router.
- GET returns `{ok,playerId,data,revision,patrol}`. First access CAS-persistently initializes a baseline at server time (no retroactive rewards), incrementing revision once. Canonical missing saves are restored using the existing repository; legacy missing saves return 404.
- POST JSON: `{action: 'claim' | 'quickEnergy' | 'quickAd', requestId: UUIDv4, revision: positive integer}`. UUID case is normalized for dedupe. Authenticated cookie determines owner; client rewards, elapsed time and balances are ignored.
- Success returns GET fields plus `{action,rewards,replayed}`. `rewards` has `{gold,exp,aurocite,gearScrolls:{weapon,armor,helmet,ring,necklace,boots}}`. EXP adds to `data.patrolExp`, cumulative only: **does not increase playerLevel**.
- Preview: `serverNow,startedAt,lastClaimAt,elapsedSeconds,capSeconds,minClaimSeconds,canClaim,bestClearedChapter,ratesPerHour,rewards,quickRewards,quickSeconds,quickEnergy:{cost,limit,remaining},quickAd:{available,limit,remaining,reason},dailyResetTimezone,dailyResetAt`.
- All timestamps are epoch milliseconds; durations seconds. Claim minimum 60 seconds, accrual cap 86400 seconds. Quick grants 7200 seconds without resetting accumulated AFK time. Energy cost 5, max 3 per UTC calendar day.
- No verified advertising provider exists in this integration: quickAd is explicitly unavailable, advertised configured cap 2 but remaining 0; POST returns 422 `AD_UNAVAILABLE`. No ad rewards are minted.
- Revision conflicts return 409 `PATROL_CONFLICT`, `conflict:true`, serverRevision and current data/preview where possible. Reload canonical data; never retry with a different request key after an ambiguous success. Same key/action replays safely, even using old revision; reusing a key for another action returns 409.

## Save-policy integration (owned by parent)

- Add `data.patrolExp` default 0, integer cap 1e12 to schema and client load/save; preserve previous server value in prepareSaveData and include in validation projection.
- Persist `ledger.patrol` across normal PUT /api/save transitions, copying previous server value, never incoming client ledger. This is separate from client data.
- `ledger.patrol`: `{version:1,startedAt,lastClaimAt,day:'YYYY-MM-DD',energyUsed,adUsed,receipts:[{requestId,action,at,rewards}]}`.
- No economy budget limits are increased. Patrol writes trusted reward data, preserved existing ledger budget, quota/timestamps/receipt, and revision together in one Mongo CAS. Normal saves compare against this newly granted balance.
- Reward overflow aborts all changes, including energy/quota. Bad stored patrol state fails closed rather than resetting quotas.

## Rates and limits

Server-owned balance configuration in domain.js uses highest valid saved winsByChapter key in the campaign catalog, not selectedChapterIdx, bestRooms, or any request value. No win uses base rates. **Existing campaign wins are client-save sourced; this does not add server-verified battle completion.** Rates are consequently based on persisted campaign progress, not proof of combat.

Gold/hour = 240 + chapter*60; EXP/hour = 120 + chapter*30; each scroll/hour = 1 + floor(chapter/5); Aurocite/hour = 0 until chapter 3, then 1 + floor(chapter/10). These are new tuning defaults, not copied screenshot numbers. Fractional rewards round down; a successful claim resets the full elapsed interval. No random gear/rune drops are promised.

Permanent request-key dedupe uses a bounded server ledger journal of 4096 receipts; it **does not evict** keys and make them payable again. Once full, writes fail closed with `PATROL_JOURNAL_FULL`; future archival needs a durable dedupe store. This is a known operational limitation, not an unlimited-history claim.

## Verification

`node --test tests/patrol.test.mjs tests/patrol-api.test.mjs`

Tests exercise pure capped server-clock math and real cookie-authenticated handlers with isolated memory Mongo and an injected in-process clock: persisted baseline, claim minimum, CAS races, replay, stale revision, quota exhaustion/reset UTC, insufficient stamina, ad refusal, forged rewards/time, overflow atomicity and parent save-policy protection of patrolExp/ledger.patrol.
