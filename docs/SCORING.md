# Scoring Model

The project keeps match-day performance separate from the rolling skill ranking. The match-day view answers who performed best on one date. The total leaderboard estimates who is currently strongest and does not award points merely for attending more often.

## Match evidence

Team strength is the average current rating of both players. For team A:

```text
expectedA = 1 / (1 + 10 ^ ((teamBRating - teamARating) / 4))
marginRatio = min(abs(scoreA - scoreB) / winningScore, 0.75)
marginMultiplier = 1 + marginRatio
teamChangeA = clamp((actualA - expectedA) × marginMultiplier, -1.35, +1.35)
teamChangeB = -teamChangeA
```

This means:

- beating a stronger team is worth more than beating a weaker team;
- losing to a weaker team costs more than losing to a stronger team;
- a clearer score margin strengthens the evidence without being counted twice;
- no individual moves by more than 1.35 in one match.

## Teammate updates

A doubles score contains team evidence, not individual performance data. The model therefore does not guess which teammate carried the team. Both players receive the same directional result signal, with an adaptive learning multiplier based on how established each rating is:

| Previous rated matches | Multiplier |
| --- | ---: |
| 0–4 | 1.20 |
| 5–9 | 1.10 |
| 10–19 | 1.00 |
| 20–39 | 0.90 |
| 40+ | 0.80 |

A newer player's estimate moves faster in either direction because it is less certain. An experienced player's estimate is more stable. When teammates have equal experience, they still receive equal changes because the match contains no fair basis for separating their contributions.

For an evenly rated 21:17 match, the shared team signal is approximately `+0.60`. A new player with fewer than five previous matches moves approximately `+0.71`, while a teammate with at least 20 previous matches moves approximately `+0.54`. If both have the same experience, both move by the same amount.

## Match-day ranking

Every participating player begins each date at 5.00. Only matches from that date are applied, in their recorded order. This view measures that day's performance and includes only players who played on that date.

## Rolling skill ranking

The total leaderboard:

1. keeps matches from the latest 52 weeks;
2. orders them chronologically;
3. starts every player at 5.00;
4. applies every match using opponent strength, result, score margin, and rating confidence;
5. ranks official players by their resulting individual rating.

Playing another match does not award attendance points. A player gains only by performing better than the model expected and can lose rating when performing worse than expected.

A rating is provisional until the player has all of the following within the window:

- at least 10 matches;
- at least 3 match days;
- at least 5 distinct opponents.

These thresholds affect confidence status only. They do not add rating points. Provisional players remain visible but are sorted after official players by default.

## Deterministic recomputation

Ratings are derived data rather than authoritative stored values. Editing, deleting, importing, or synchronizing a match rebuilds all ratings from match history. Matches are sorted by date and stable match ID before calculation so the web and iOS builds produce the same result even when cloud records arrive in a different order.

## Limits of score-only ranking

No score-only doubles system can identify who made the winning shots, committed errors, or carried a partnership. Fair individual separation emerges over time when partners and opponents rotate. Adding unequal teammate rewards without rally-level or player-level evidence would introduce an unsupported assumption.

## Changing the model

A scoring change should include:

- a written fairness problem;
- worked examples before and after the proposal;
- tests for expected movement and boundary conditions;
- confirmation that old match records remain readable;
- separate consideration of match-day and rolling rankings.
