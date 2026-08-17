# Project Impact

## Real-world use

Badminton Player Rating began as a tool for a real recreational doubles group rather than a demonstration dataset. As of 17 August 2026, the reference deployment contains:

- 16 active players;
- 64 recorded doubles matches;
- 6 separate match days;
- synchronized use across the public web app and an iOS build.

Only aggregate counts are published. Player names, match exports, and device information are not used as project metrics.

## Problem addressed

Recreational doubles groups frequently rotate partners. Fixed-team tables and simple win percentages can reward a player for one favorable partnership or a small number of matches. This project keeps stable player identities across changing teams, considers opponent strength and score margin for each day, and uses a rolling best-result model for longer-term ranking.

## Maintenance evidence

The project includes active work in several maintenance areas:

- deterministic score recomputation after historical edits;
- backward-compatible data normalization;
- conflict-aware Supabase merge and deletion tombstones;
- local recovery snapshots to avoid data loss during outages;
- shared web/iOS release assets;
- automated scoring, storage, synchronization, and event tests;
- public deployment and repeatable iOS preparation scripts.

## Current scope

This is an early community project with one primary maintainer and one reference badminton group. It does not yet claim broad ecosystem adoption. The next milestone is making secure, self-service deployment practical for additional groups and gathering independent ranking feedback.

## Useful open-source direction

The project aims to become a small, understandable reference implementation for local sports groups that need:

- partner-independent doubles rankings;
- local-first recovery with optional cloud synchronization;
- a static deployment without a custom application server;
- one codebase shared by the browser and Capacitor iOS.

External deployment reports, fairness examples, translations, accessibility fixes, and security contributions are welcome.
