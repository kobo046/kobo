# Contributing

Thank you for helping improve Badminton Player Rating. Contributions based on real match-day use are especially useful.

## Before you start

- Search existing issues before opening a new one.
- Use a bug report for incorrect behavior and a feature request for a proposed workflow.
- For scoring changes, describe the fairness problem and provide at least one concrete match example.
- Do not include real participant contact details, private Supabase credentials, or production backups.

## Development setup

Requirements: Node.js 20 or newer.

```bash
git clone https://github.com/kobo046/kobo.git
cd kobo
npm ci
npm run validate
npx serve .
```

## Project conventions

- Keep the application framework-free unless a dependency removes substantial complexity.
- Preserve existing HTML IDs and classes when changing JavaScript behavior.
- Keep scoring logic in `scoring.js`, persistence in `storage.js`, rendering in `render.js`, and DOM events in `events.js`.
- Maintain backward compatibility for exported JSON and existing `localStorage` data.
- Never commit secret keys, service-role credentials, personal match exports, or administrator passwords.
- Prefer small pull requests with one clear purpose.

## Tests

Every behavior change should include a focused test. Run:

```bash
npm test
npm run validate
npm run build:ios-web
```

Scoring changes should cover both the match-day model and the rolling 52-week ranking where relevant. Cloud changes should cover merge, tombstone, retry, and offline recovery behavior.

## Pull requests

1. Create a branch from `main`.
2. Make the smallest coherent change.
3. Update tests and documentation.
4. Complete the pull request template.
5. Wait for CI to pass before requesting review.

By contributing, you agree that your contribution is licensed under the MIT License.
