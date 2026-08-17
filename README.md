# Badminton Player Rating

[![CI](https://github.com/kobo046/kobo/actions/workflows/ci.yml/badge.svg)](https://github.com/kobo046/kobo/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/kobo046/kobo/actions/workflows/pages.yml/badge.svg)](https://github.com/kobo046/kobo/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A mobile-first doubles badminton match tracker and individual player ranking system. It runs as a static web app, synchronizes shared club data through Supabase, and can be packaged as a native iOS app with Capacitor.

**[Live demo](https://kobo046.github.io/kobo/)** · **[繁體中文說明](README.zh-HK.md)** · **[iOS guide](IOS_APP_GUIDE.md)**

![Badminton doubles match](assets/badminton-doubles-hero.webp)

## Why this project exists

Most casual badminton groups rotate partners frequently, so a fixed-team table does not describe individual performance well. This project records every doubles match as four individual participants and rebuilds each player's statistics from the complete match history.

It is designed for real use at the court:

- large, touch-friendly match entry controls;
- individual ratings despite changing partners;
- total and match-day leaderboards;
- shared multi-device records with offline-safe local snapshots;
- editable historical matches with deterministic full recomputation;
- the same code and data model on the web and iOS.

The reference deployment currently supports 16 active players and 64 recorded matches across six match days. See [Project Impact](docs/PROJECT_IMPACT.md) for privacy-safe usage evidence and current limitations.

## Ranking model

The application intentionally separates two questions:

| View | Purpose | Calculation |
| --- | --- | --- |
| Match-day ranking | Who performed best on a specific day? | Elo-inspired updates using match result, score margin, and upset probability |
| Rolling total ranking | Who has sustained performance over time? | Best 10 match-day results from the latest 52 weeks, using 100/84/69/54/35 placement points |

The public display maps rolling points to a 5.00–10.00 scale. Players with fewer than three match days are marked provisional. The scoring implementation is isolated in [`scoring.js`](scoring.js), documented with [worked formulas](docs/SCORING.md), and covered by executable tests.

## Features

- Player creation, rename, and protected deletion
- Match date, venue, notes, teams, and scores
- Total and per-day leaderboards
- Search, sorting, player profiles, match-day summaries, and history
- Edit/delete with full ranking recomputation
- JSON import/export and automatic local recovery snapshots
- Supabase merge-based synchronization with tombstones
- Viewer and administrator interface modes
- GitHub Pages deployment and Capacitor iOS packaging
- Automated scoring, storage, cloud-sync, and event tests

## Architecture

This is deliberately a small, framework-free application. The browser loads modules in dependency order:

```text
index.html
  ├─ storage.js       local state, normalization, backup/import/export
  ├─ scoring.js       match changes, day ranking, rolling ranking
  ├─ render.js        leaderboard, players, history, rule views
  ├─ events.js        forms, buttons, edits, and deletes
  ├─ cloud-storage.js Supabase REST adapter and merge synchronization
  ├─ auth.js          viewer/editor UI gate
  └─ app.js           initialization
```

See [Architecture](docs/ARCHITECTURE.md) for data flow, conflict handling, and important design decisions.

## Quick start

Requirements: Node.js 20 or newer.

```bash
git clone https://github.com/kobo046/kobo.git
cd kobo
npm ci
npm test
```

Start a local static server:

```bash
npx serve .
```

Then open the URL printed by `serve`. Python's `python -m http.server 8787` also works.

## Supabase setup

The app works locally without Supabase. Shared multi-device data requires a Supabase project and the schema in [`supabase-schema.sql`](supabase-schema.sql).

1. Create a Supabase project.
2. Run the schema in the Supabase SQL editor.
3. Copy [`supabase-config.example.js`](supabase-config.example.js) to `supabase-config.js`.
4. Enter the project URL, publishable key, and a club ID.
5. Run `npm run validate` before deployment.

Detailed instructions and the current security model are documented in [Supabase setup](SUPABASE_SETUP.md).

> The publishable Supabase key is expected to be public. Never commit a secret key or `service_role` key. The current passcode mode is a convenience UI gate, not database-level authorization; production deployments should use Supabase Auth and restrictive RLS. See [Security](SECURITY.md).

## iOS

The repository includes a Capacitor iOS project. On a Mac with Xcode, Node.js 20+, and CocoaPods:

```bash
bash scripts/prepare-ios-mac.sh
```

The script validates the project, rebuilds the web bundle, synchronizes it into Xcode, and opens the workspace. See [iOS App Guide](IOS_APP_GUIDE.md).

## Testing and validation

```bash
npm test            # scoring, storage, cloud sync, and events
npm run validate    # tests plus release and credential checks
npm run audit       # fail on high/critical dependency advisories
npm run build:ios-web
```

CI runs on every pull request and push to `main`. GitHub Pages deploys only after the validation job succeeds.

## Contributing

Bug reports, scoring discussions, translations, accessibility improvements, and deployment feedback from badminton groups are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

## Roadmap

- Supabase Auth with editor/admin roles and restrictive RLS
- Club onboarding without editing source files
- Installable PWA with explicit cache-version handling
- More ranking simulations and fairness reports
- TestFlight distribution and iOS release automation

See the full [roadmap](ROADMAP.md).

## License

Released under the [MIT License](LICENSE).
