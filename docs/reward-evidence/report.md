# Reward browser acceptance

Real Chrome + isolated memory DB + real HTTP handlers; not production or Mongo durability

Passed: 14; failed: 0. Module available: true.

- **passed** wish-1
- **passed** wish-10
- **passed** wish-100
- **passed** wish-failure
- **passed** island-dice
- **passed** demon-1
- **passed** demon-10
- **passed** fishing-reel
- **passed** fishing-ten
- **passed** world-tree-pickaxe
- **passed** world-tree-bomb
- **passed** world-tree-drill
- **passed** rune-board-single
- **passed** gold-cave-roulette

## Gaps
- wish-1: observed star delta 1/1; 15-star saturation may prevent one star per displayed draw. Reward-to-artifact ID mapping not exposed in presentation contract.
- wish-10: observed star delta 10/10; 15-star saturation may prevent one star per displayed draw. Reward-to-artifact ID mapping not exposed in presentation contract.
- wish-100: observed star delta 99/100; 15-star saturation may prevent one star per displayed draw. Reward-to-artifact ID mapping not exposed in presentation contract.
- [data-vn-wish-pull="100"]: mobile 390x600 and 360x480, keyboard trap, final-card footer clearance and Escape no-mutation passed.
- #btnIslandRollDice: mobile 390x600 and 360x480, keyboard trap, final-card footer clearance and Escape no-mutation passed.
- No production/deployed verification. Event persistence must be distinguished from local client delta; HTTP save results recorded below.
- Promised rune pool, rune x5/x10 VIP, artifact-tab wish x10, legacy wiki inventory actions, bingo, plinko and mystery-mine special branches require additional coverage.


See result.json for exact payloads, HTTP status evidence and browser errors. Failed-case screenshots do not imply successful acceptance.
