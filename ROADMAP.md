# Roadmap

The roadmap favors reliability for real badminton groups over feature count.

## Priority 1: secure shared deployments

- Replace the client-side convenience passcode with Supabase Auth.
- Add admin, editor, and viewer membership roles.
- Restrict all writes with Row Level Security.
- Add documented migration and rollback steps.
- Add authorization tests for anonymous and authenticated clients.

## Priority 2: ranking transparency

- Publish worked examples for match-day and rolling ranking calculations.
- Add simulation fixtures for participation frequency and strength of schedule.
- Publish rating calibration and confidence reports as the dataset grows.
- Collect feedback from additional badminton groups.

## Priority 3: resilient installation

- Add a versioned PWA cache with an explicit update prompt.
- Improve first-run club setup without source edits.
- Add TestFlight distribution and repeatable iOS release notes.
- Document Supabase backup and disaster-recovery procedures.

## Priority 4: community

- Add English interface localization.
- Publish reusable deployment examples.
- Label beginner-friendly issues.
- Establish a small group of independent testers and contributors.
