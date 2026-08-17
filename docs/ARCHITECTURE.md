# Architecture

## Overview

Badminton Player Rating is a static, framework-free web application. The same web bundle is deployed to GitHub Pages and copied into a Capacitor iOS shell. Supabase is optional: without it, the application remains a local-first browser tool.

## Runtime modules

| File | Responsibility |
| --- | --- |
| `storage.js` | State normalization, localStorage, snapshots, JSON import/export |
| `scoring.js` | Match changes, deterministic recomputation, daily and rolling rankings |
| `render.js` | Leaderboard, player, match-day, history, and rules views |
| `events.js` | Form submissions, buttons, editing, deletion, and previews |
| `cloud-storage.js` | Supabase REST/client adapter, mapping, merge, queue, tombstones |
| `auth.js` | Viewer/editor presentation gate |
| `app.js` | Startup and initialization ordering |

Modules use browser globals to preserve a zero-build static deployment. Tests load individual modules in isolated VM contexts.

## Data model

```text
Club
  ├─ Players (club_id + player_id)
  └─ Matches (club_id + match_id)
       ├─ date, location, note
       ├─ team A player IDs and score
       └─ team B player IDs and score
```

Player ratings are derived data. They are not authoritative cloud fields and are rebuilt from match history, preventing stale scores after an edit or deletion.

## Local-first data flow

1. Normalize local state and preserve backward compatibility.
2. Create an automatic recovery snapshot before risky operations.
3. Load cloud players, matches, and tombstones when Supabase is available.
4. Merge records by stable ID and `updatedAt` timestamp.
5. Preserve local-only and cloud-only records.
6. Recompute all derived rankings from the merged match history.
7. Queue changed records for upload.

A remote absence is never interpreted as deletion. Explicit cloud tombstones prevent intentionally deleted matches from returning during a later merge.

## Ranking flow

The match-day model starts all participating players at 5.00 for that date and applies every match in order. The rolling model converts each day's final placement to event points and totals the best 10 results in a 52-week window. The user-facing 5.00–10.00 score is a display mapping of those rolling points.

## iOS packaging

`scripts/build-ios-web.mjs` creates a clean `ios-web` bundle from the public web assets. `npx cap sync ios` copies that bundle into the native project. The iOS app and web deployment therefore use the same scoring, rendering, storage, and Supabase code, but maintain separate device-local storage.

## Security boundary

The current passcode controls visible editing actions only. Supabase RLS is the actual security boundary for any untrusted deployment. See [Security Policy](../SECURITY.md) and [Roadmap](../ROADMAP.md).
