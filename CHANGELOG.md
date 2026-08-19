# Changelog

All notable changes are documented here. The project follows semantic versioning from the first public release.

## [Unreleased]

### Changed

- Replaced attendance-based best-10 placement points with a rolling 52-week individual skill rating
- Added confidence-aware teammate updates so less-established ratings adapt faster without guessing individual contribution
- Added official-rating thresholds for match sample, match-day coverage, and opponent diversity
- Made rolling recomputation chronological when older matches are added later

### Planned

- Supabase Auth and restrictive RLS for editor/admin roles
- Additional ranking fairness simulations and calibration reports
- PWA cache update strategy

## [1.0.0] - 2026-08-17

### Added

- Mobile-first doubles match entry and individual player management
- Elo-inspired match-day ranking based on result, margin, and upset probability
- Rolling 52-week total ranking using the best 10 match days
- Supabase multi-device synchronization with merge recovery and tombstones
- JSON backup/import and automatic local snapshots
- Match history editing, deletion, and deterministic full recomputation
- GitHub Pages deployment and Capacitor iOS project
- Automated scoring, storage, cloud synchronization, and event tests

[Unreleased]: https://github.com/kobo046/kobo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/kobo046/kobo/releases/tag/v1.0.0
