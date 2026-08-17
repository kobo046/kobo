# Scoring Model

The project uses separate calculations for match-day performance and long-term participation. This avoids letting one unusually strong day permanently dominate the overall leaderboard while keeping each day's results sensitive to opponent strength and score margin.

## Match-day performance

Every player begins a match day at 5.00. Matches are applied in recorded order.

For team A:

```text
expectedA = 1 / (1 + 10 ^ ((teamBRating - teamARating) / 4))
marginRatio = min(abs(scoreA - scoreB) / winningScore, 0.75)
rawChangeA = 0.85 × (1 + marginRatio) × (actualA - expectedA)
             + (scoreA - scoreB) × 0.035
changeA = clamp(rawChangeA, -1.35, +1.35)
changeB = -changeA
```

Both members of a team receive the same change. Individual ratings are clamped to 0.00–10.00.

This means:

- a win increases the winning team and decreases the losing team;
- a larger score margin creates a larger change;
- a higher-rated team loses more for an upset;
- no player moves by more than 1.35 in one match.

## Daily placement points

After all matches for a date are applied, participating players are sorted by their match-day rating. Exact rating ties share the same position and points.

| Daily position | Ranking points |
| --- | ---: |
| 1 | 100 |
| 2 | 84 |
| 3–4 | 69 |
| 5–8 | 54 |
| 9+ | 35 |

## Rolling total ranking

For each player:

1. Keep match days within the latest 52 weeks.
2. Sort results by points, then daily rating, then date.
3. Count the best 10 match days.
4. Sum their ranking points.
5. Display `5 + rankingPoints / 200`, clamped to 10.00.

A player needs three match days for an official ranking. Earlier results are visible but marked provisional and sorted after official players.

## Deterministic recomputation

Ratings are never treated as authoritative stored values. Editing, deleting, importing, or synchronizing a match causes all derived statistics to be rebuilt from match history. Tests cover the formula, caps, upset behavior, time window, best-10 selection, ties, and historical recomputation.

## Changing the model

A scoring change should include:

- a written fairness problem;
- worked examples before and after the proposal;
- tests for expected movement and boundary conditions;
- confirmation that old match records remain readable;
- separate consideration of match-day and rolling rankings.
