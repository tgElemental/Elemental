# Elemental — evolving-world game design

## Thesis

'Infinite' means there is no fixed final level, **not** that a player can click endlessly without consequence. The experience should always combine a short tactical loop (15–45s), a daily exploration loop (2–5min), and a longer seasonal/social loop.

## Core loop (implemented in v0.1)

Pick one of water/fire/earth/wind → server draws opponent → compare win cycle → synthesize tree or light on matching pairs → award points/affinity/streak → record and consume the chosen element atomically → refresh the world and leaderboard.

Classic victory cycle: water > fire > earth > wind > water. Identical choices draw, other pairings lose. Win is 3 base points, draw 1, loss 0. Fire+wind yields light; earth+water yields tree regardless of order or victory. +1 for winning with the day's affinity element. Each consecutive winning round adds `min(previous_streak, 2)` extra points.

Per UTC day, add 5 of each of four cards to each player (20 total). First referral earns 5 of each for the inviter, never for themselves. Weekly leaderboard begins Monday UTC. This foundation is intentionally bounded in scope.

## Anti-boredom mechanics (roadmap, not implemented)

1. **Daily expeditions:** daily deterministic map seed chooses a chapter challenge, 2–3 objectives and a biome-specific twist. Keep tactical choices meaningful with limited cards.
2. **Discovery codex:** players earn persistent recipe discoveries by combining rare interactions (beyond Tree/Light), not purely randomized drops.
3. **World restoration:** player contributions visibly restore a procedurally generated map; trees and light become resources that unlock cosmetics, terrain and chapter narratives without pay-to-win.
4. **Seasonal meta:** 7-day ranking competitions and 28-day thematic seasons, with cosmetic badges and archive gallery; permanent player heritage survives season resets.
5. **Asynchronous cooperative quests:** friends collectively heal a biome with a capped reward per unique player; referral participation does not guarantee repeated rewards.
6. **Narrative events:** same rules expressed through distinct weather, fauna, hazards, and hard tactical constraints; authored season palette layered onto procedural daily seed.
7. **Strategic sinks:** crafting costs and element replenishment designed through an economy simulator before release, preserving card scarcity and anti-inflation limits.

## Retention and fairness

Measure D1/D7 retention, rounds per session, invitation activation, day-7 season return, queue failure, cheating attempts, and accessible-completion rate. Avoid manipulative countdowns and unlimited spam invites. Prize/rank rewards require identity, fraud and legality evaluation before any monetary/token incentive.
