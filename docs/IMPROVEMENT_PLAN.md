# Improvement plan

Reviewed on 26 October 2026 against `main` at `1ecc855`. This is a sequenced plan, not an implementation. It does not replace the product direction in [ROADMAP.md](../ROADMAP.md).

Effort means focused implementation size, not a calendar estimate:

| Size | Meaning |
| --- | --- |
| S | One small pull request: a lockfile bump, a doc correction, or a single module plus a test |
| M | One coherent change across schema, CI, or several UI call sites, with tests |
| L | A migration that changes how the club signs in and how the database authorizes writes |

## What this repository is

Badminton Player Rating is a framework-free, mobile-first doubles tracker. The browser loads plain scripts from [index.html](../index.html). Ratings are derived in [scoring.js](../scoring.js) and rebuilt from match history. [storage.js](../storage.js) keeps a local snapshot and merges cloud rows. [cloud-storage.js](../cloud-storage.js) talks to Supabase PostgREST. The same files are copied into an `ios-web` bundle for a Capacitor iOS shell.

The reference club data lives in the Supabase project committed in [supabase-config.js](../supabase-config.js). The publishable key is expected to be public. The database policies are not.

Unit tests were run during this review and passed: scoring, storage, cloud merge, events, and app-improvement checks. Playwright UI tests were not run here because they require Google Chrome (`channel: "chrome"` in [playwright.config.mjs](../playwright.config.mjs)).

## What is already in good shape

- Scoring is isolated, documented with worked formulas in [SCORING.md](SCORING.md), and covered by deterministic tests (margin, upset, cap, 52-week window, provisional thresholds, edit/delete recomputation).
- Cloud merge behavior has tests for local-only rows, tombstones, queued saves, and partial uploads.
- Release validation checks required files, relative Markdown links, and a few privileged-credential patterns.
- Security limitations are disclosed in [SECURITY.md](../SECURITY.md), [SUPABASE_SETUP.md](../SUPABASE_SETUP.md), and the README. Private vulnerability reporting is the requested path.
- The iOS prepare script checks Node, Xcode, and CocoaPods before syncing.
- Issue and pull-request templates already ask people not to attach secrets or private backups.

## P0 — do these before more features

### 1. Stop treating the passcode as authorization

**Why.** [auth.js](../auth.js) compares the typed password with a string constant and then stores `badmintonAdminAccess.v2=unlocked` in `localStorage`. `currentAccessToken()` always returns an empty string, so every REST call in [cloud-storage.js](../cloud-storage.js) sends the publishable key as both `apikey` and `Authorization`. [supabase-schema.sql](../supabase-schema.sql) enables RLS and then allows `select` and `all` to everyone (`using (true)` / `with check (true)`) on clubs, players, and matches. [supabase-simple-passcode.sql](../supabase-simple-passcode.sql) re-applies those policies on purpose.

GitHub Pages is published from the `main` branch root (see item 3), so `auth.js` is a public URL as well as a public source file. Changing the constant does not protect the database. Anyone who can read the site can read, edit, and delete the live club.

This is already the top item in [ROADMAP.md](../ROADMAP.md) and [SECURITY.md](../SECURITY.md). It is P0 because the hosted project is a real club dataset, not a demo, and writes do not check the passcode at all.

**Effort.** L for the real fix. S for a temporary lock-down.

**Approach.**

1. Export a JSON backup from a trusted device before changing policies.
2. Add Supabase Auth and a `club_members` table (`club_id`, `user_id`, `role`) with roles `viewer`, `editor`, and `admin`.
3. Replace the public write policies with policies that allow anonymous `select` only if the club should stay publicly readable, and allow `insert` / `update` only for members whose role can edit. Deletes should stay soft-deletes (`is_active`, `deleted_at`) issued by editors.
4. Send the user access token from `currentAccessToken()` and stop unlocking editor UI from a shared password. Keep the viewer UI.
5. Add a SQL migration and a rollback script. Do not leave [supabase-simple-passcode.sql](../supabase-simple-passcode.sql) as the recommended production path.
6. Add tests that an anonymous client cannot upsert players or matches, and that an editor can. A local Supabase or policy-level SQL test is enough; do not point tests at the production project.
7. Until that migration is ready, the useful interim step is to drop the public write policies on the live project after the backup, and accept that cloud saves fail closed. The passcode UI will still look unlocked. Say that clearly in the app status line so the club does not think a save succeeded.

Do not commit a new shared password, a service-role key, or a production backup.

### 2. Patch Capacitor iOS on the 7.x line and make CI green again

**Why.** `npm audit --audit-level=high` against the current lockfile reports three issues:

| Package | Severity | Where it runs | Notes |
| --- | --- | --- | --- |
| `@capacitor/ios` 7.6.2 | Critical | Native iOS WebView | [GHSA-rvm3-566m-v7fv](https://github.com/advisories/GHSA-rvm3-566m-v7fv). Navigation checks host and scheme, not path, so a frame can load the internal HTTP proxy at the app origin. Patched in 7.6.9 and in 8.5.1. The Pages site does not load Capacitor, so this is an installed-app bug. Exploitation needs a navigation inside the WebView; unsanitized `innerHTML` (P1 item 4) makes that easier. |
| `@xmldom/xmldom` 0.9.10 | High | Dev only, via `plist` → `@capacitor/cli` | Not shipped in the browser bundle. The vulnerable range reported by npm currently includes 0.9.10 through 0.9.11. Several fixes are opt-in (`requireWellFormed: true`) inside a CLI XML parser. |
| `brace-expansion` 5.0.9 | High | Dev only, via `minimatch` | Not shipped in the browser bundle. |

The 14 September 2026 CI run on `main` (`34831032816`) and the Pages workflow (`34831032780`) both failed in `npm run audit` after the unit tests passed. At that date the log showed only the xmldom high. The critical Capacitor advisory is what `npm audit` reports now. Red CI hides real regressions, and the custom Pages workflow never uploads an artifact.

The open Dependabot PRs that move Capacitor to 8.5.1 are the wrong vehicle for this patch. See the triage section.

**Effort.** S for the npm bump and audit-gate change. Rebuilding and reinstalling the iOS app is a separate Mac/Xcode pass.

**Approach.**

1. Bump `@capacitor/core`, `@capacitor/ios`, and `@capacitor/cli` together to the latest 7.6.x that includes 7.6.9 or newer. Keep them on the same minor. Run `npm test` and `npm run build:ios-web`.
2. On a Mac, run `npm run cap:sync:ios` and reinstall the app. An old binary stays vulnerable until it is replaced. The Podfile already points at `node_modules/@capacitor/ios`.
3. Run `npm audit fix` without `--force`, then read the lockfile diff. Accept transitive dev bumps that stay inside the current major. Reject a jump to Capacitor 8.
4. Change the blocking audit to production dependencies: `npm audit --omit=dev --audit-level=high`. Keep a second, non-blocking `npm audit` step so dev-tool advisories stay visible without failing every unrelated pull request. The critical iOS package must remain in the blocking check because `@capacitor/ios` is a production dependency.
5. Re-run CI on `main` and confirm the badge is green before merging anything else.

### 3. Publish the site from a built bundle, and only after CI passes

**Why.** The Pages API reports a legacy deploy from branch `main`, path `/`. [pages.yml](../.github/workflows/pages.yml) instead builds `ios-web` and deploys with `actions/deploy-pages`, but that job currently dies in the audit step before upload. The README says Pages deploys only after validation succeeds. The branch source publishes every file on `main` even when CI is red, including [auth.js](../auth.js), SQL, tests, and scripts.

[scripts/build-ios-web.mjs](../scripts/build-ios-web.mjs) already lists the files the app needs. That list is the right Pages artifact.

**Effort.** S, after item 2 so the workflow can get past the audit step.

**Approach.**

1. In the repository Pages settings, switch the source to GitHub Actions.
2. Keep [pages.yml](../.github/workflows/pages.yml) as the only publisher. Upload `ios-web` only.
3. Add a check that the artifact does not contain `tests/`, `scripts/`, `*.sql`, or `scoring-v10.js`.
4. Correct the README sentence so it matches the setting that is actually in use.
5. Confirm `https://kobo046.github.io/kobo/` still loads, and confirm `auth.js` is no longer fetchable as a raw extra file beyond the bundle the app itself requests. The passcode constant remains inside the bundle until item 1 removes it. The bundle change is not a substitute for RLS.

## P1 — next, still before new product work

### 4. Escape every string interpolated into HTML

**Why.** Some views use `escapeHtml` (leaderboard names, `<select>` options, the home cards in [app-shell.js](../app-shell.js)). Others put player names, locations, notes, and activity-log text straight into `innerHTML`. Examples in [render.js](../render.js): player cards, the day-overview location line, history location/note/team labels, and the activity log. Team labels call `playerName()` and are then concatenated into HTML. Edit and delete buttons also embed ids inside `onclick="..."` strings.

Player ids created by the app look like `p-${Date.now()}`, but the public write policies accept any id. A stored name, note, location, or id can run script in every visitor's browser. On the iOS shell that also widens [GHSA-rvm3-566m-v7fv](https://github.com/advisories/GHSA-rvm3-566m-v7fv) until the native binary is rebuilt.

**Effort.** S.

**Approach.** Use one `escapeHtml` for every text node written with `innerHTML`. Put ids in `data-*` attributes and handle clicks with a delegated listener instead of building `onclick` strings. Add a unit test whose player name is `<img src=x onerror=alert(1)>` and whose note contains `<script>`, and assert the rendered string contains the escaped text. Cover history, player cards, and the day overview, not only the leaderboard.

### 5. Make cloud sync match the code that actually runs

**Why.** [index.html](../index.html) never loads `@supabase/supabase-js`. `loadStateFromCloud` and `persistStateToCloud` set `supabaseClient` to `null` and use REST. `subscribe()` still calls `getClient()`, which returns null without that global, so `postgres_changes` never starts. Two devices see each other only after a reload or an explicit sync. The dead client branches are easy to "fix" later by flipping the null check and silently changing behavior.

There is a second data hazard: when the cloud returns zero players and zero matches, an editor session uploads local state automatically, including the built-in seed players. A public passcode makes that easy to trigger. An error already falls back to local data; an empty-but-successful response does not.

**Effort.** M.

**Approach.**

1. Delete the unused `supabaseClient` branches, or load the SDK on purpose and enable Realtime only after RLS exists. Do not do both.
2. Document REST-only sync in [ARCHITECTURE.md](ARCHITECTURE.md), including that [app-shell.js](../app-shell.js) is part of startup.
3. Require an explicit confirm before the first upload of local data. Never auto-upload when the local state is still the seed roster.
4. Keep the existing merge and tombstone tests. Add one test that an empty cloud does not call upsert unless the caller opted in.

PostgREST filters in `restUpdate` interpolate ids into `in.(...)`. Once writes require auth this is less exposed, but ids should still be encoded or sent in the request body rather than concatenated.

### 6. Run the UI tests in CI

**Why.** `npm test` does not run `tests/ui/app.spec.mjs`. That file is what locks the tab shell, match draft, 320–1440px overflow, and the save confirmation. [playwright.config.mjs](../playwright.config.mjs) sets `channel: "chrome"`, so `npm run test:ui` needs a system Chrome. GitHub-hosted Ubuntu images do not satisfy that unless Chrome is installed. A green unit-test job can still ship a broken mobile dock.

**Effort.** S.

**Approach.** Install Playwright's Chromium in CI and remove the Chrome channel so the test uses the browser Playwright downloaded. Run `npm run test:ui` on pull requests. Keep `workers: 1`. Store screenshots as an artifact on failure only.

### 7. Clear the Dependabot queue without merging the risky bumps

Ten dependency pull requests were open on 26 October 2026. None were merged for this plan. CI on the npm bumps is red for the same audit failure as `main`, except the split Capacitor major bumps, which fail earlier at `npm ci`. The `dependencies` label in [dependabot.yml](../.github/dependabot.yml) does not exist in the repository, so those PRs are unlabeled. The npm open-pull-request limit is 5, and it is full, so Dependabot cannot open a 7.6.9 security pull request until some of these close.

| PR | Change | Verdict |
| --- | --- | --- |
| [#9](https://github.com/kobo046/kobo/pull/9) | `@capacitor/cli` 7.6.2 → 8.5.1 | Do not merge alone. CLI 8 against core/ios 7 is an unsupported mix. This was the only Capacitor PR whose install succeeded. |
| [#10](https://github.com/kobo046/kobo/pull/10) | `@capacitor/core` 7.6.2 → 8.5.1 | Do not merge. `npm ci` fails: `@capacitor/ios@7.6.2` requires `@capacitor/core@^7.6.0`. |
| [#11](https://github.com/kobo046/kobo/pull/11) | `@capacitor/ios` 7.6.2 → 8.5.1 | Do not merge. Same peer failure in reverse. 8.5.1 does contain the proxy-path fix, but it is a major migration. |
| [#12](https://github.com/kobo046/kobo/pull/12) | `lucide` 0.468.0 → 1.45.0 | Do not merge as a lockfile-only bump. The browser loads the vendored [assets/lucide.min.js](../assets/lucide.min.js) copied by [scripts/sync-icons.mjs](../scripts/sync-icons.mjs) from `node_modules/lucide/dist/umd/lucide.min.js`. A 1.x package can move that path or rename icons. CI failed on the audit, not on an icon test. |
| [#13](https://github.com/kobo046/kobo/pull/13) | `@playwright/test` 1.58.2 → 1.63.0 | Safe to take after CI is green and `npm run test:ui` passes. It stays on 1.x. The PR failed on the pre-existing audit, the same way `main` fails. UI tests are not in CI yet. |
| [#4](https://github.com/kobo046/kobo/pull/4) | `actions/checkout` v4 → v7 | Likely safe here. v5+ runs on Node 24, which these runners already force. v7 blocks fork checkout for `pull_request_target` and `workflow_run`; this repo uses neither. The workflows also use a normal `contents: read` checkout. |
| [#3](https://github.com/kobo046/kobo/pull/3) | `actions/setup-node` v4 → v7 | Likely safe. The workflows pass `node-version: 20` and `cache: npm`. There is no `packageManager` field, so the v5/v6 automatic-cache behavior should not replace the explicit npm cache. Read the diff once before merging. |
| [#2](https://github.com/kobo046/kobo/pull/2) | `actions/configure-pages` v5 → v6 | Low risk, and unused while Pages is deployed from the branch. Merge only when item 3 makes this workflow the real publisher, or merge it with the other Actions bumps after CI is green to clear the queue. |
| [#1](https://github.com/kobo046/kobo/pull/1) | `actions/deploy-pages` v4 → v5 | Same as configure-pages. No effect on the current branch deploy. |
| [#5](https://github.com/kobo046/kobo/pull/5) | `actions/upload-pages-artifact` v3 → v5 | v5 updates the underlying upload-artifact major and adds `include-hidden-files`. This workflow only sets `path: ios-web`. Likely safe once the workflow is the publisher. Do not merge it while expecting it to fix the red audit. |

**Capacitor 8, when you actually want it.** The 8.0 upgrade requires Xcode 26 and iOS deployment target 15.0. CocoaPods still works; new apps default to Swift Package Manager. 8.5 also adopts the UIScene lifecycle (`SceneDelegate.swift` and an `Info.plist` scene manifest) for Xcode 27 builds. [scripts/prepare-ios-mac.sh](../scripts/prepare-ios-mac.sh) currently requires Xcode 16, and [ios/App/Podfile](../ios/App/Podfile) pins iOS 14.0. `bundledWebRuntime` in [capacitor.config.json](../capacitor.config.json) is already obsolete and should be removed during that migration. Do it as one pull request with `npx cap migrate`, all three packages, a Mac sync, and a device smoke test. Close PRs 9–11 after the 7.6.9 patch lands so they are not merged by mistake.

**Dependabot config, after the patch.**

- Create the `dependencies` label the config already requests.
- Group `@capacitor/*` so core, cli, and ios cannot update separately.
- Ignore semver-major updates for `@capacitor/*` until the Xcode 26 migration is scheduled.
- Group `actions/*` into one pull request.
- After PRs 9–12 are closed, confirm a 7.x security update can open. The limit of 5 is why it may be missing today.

### 8. Correct ranking and release docs that still describe the old model

**Why.** The running code, [README.md](../README.md), [README.zh-HK.md](../README.zh-HK.md), and [SCORING.md](SCORING.md) describe a rolling 52-week skill rating. Provisional status needs 10 matches, 3 match days, and 5 opponents. Attendance does not add points. [CHANGELOG.md](../CHANGELOG.md) marks that change as unreleased, while the 1.0.0 section and [.github/workflows/project-profile.yml](../.github/workflows/project-profile.yml) still say the total ranking uses the best 10 match days. That workflow rewrites the GitHub Release `v1.0.0` whenever the workflow file itself changes. [ROADMAP.md](../ROADMAP.md) still lists "publish worked examples" even though [SCORING.md](SCORING.md) has them. [ARCHITECTURE.md](ARCHITECTURE.md) omits `app-shell.js`.

**Effort.** S.

**Approach.** Update the changelog, the release-note heredoc, and the architecture module table in one docs pull request. Do not run the release workflow until the notes match the code. Either cut a 1.1.0 for the skill-rating change or stop rewriting the 1.0.0 release body. Mark the worked-example roadmap item done.

## P2 — after the club data and the pipeline are safe

### 9. Remove the unused scoring patch and the stacked themes

[scoring-v10.js](../scoring-v10.js) is not loaded by [index.html](../index.html) or copied by the iOS bundle script. If someone adds the script tag later, it replaces `calculateMatchChange` and the rule cards with a different formula than the tests and [SCORING.md](SCORING.md). Delete it, or move it out of the web root.

The page loads six stylesheets: `styles.css`, `cartoon-court-v10.css`, `editorial-theme.css`, `ios-liquid-theme.css`, `human-ui.css`, and `app-shell.css` (about 90KB before the vendored icon script). Cache-busting query strings are edited by hand and already differ per file. After Playwright runs in CI, collapse to one maintained sheet and one version token. Do not start that refactor while layout tests are local-only.

### 10. Trim the iOS binary assets

The repo carries three splash PNGs at about 832KB each under `ios/App/App/Assets.xcassets/Splash.imageset/`, plus a 797KB icon stored both as `assets/app-icon-1024.png` and as the Xcode app icon. Check whether the three splashes are duplicates, then keep one source of each size the asset catalog actually needs.

### 11. Finish the installable-web story from the roadmap

[manifest.webmanifest](../manifest.webmanifest) sets `display: standalone`, and the HTML advertises an Apple web app, but there is no service worker and no cache version. [index.html](../index.html) loads Noto Sans TC from Google Fonts, so a flaky court network delays first paint and the iOS shell depends on that origin. Self-host the font files you use, or fall back to the system UI font. Add a versioned cache and an explicit update prompt only after the Pages artifact is the single deploy path. A service worker in front of today's branch deploy would also cache `auth.js` and the SQL files.

### 12. Club setup without a source edit

A new group still copies [supabase-config.example.js](../supabase-config.example.js) over the committed config and pushes a project URL. That is fine for one maintainer and awkward for a second club. A later settings screen can store URL, publishable key, and `clubId` in `localStorage`, with the committed file as the default for this deployment only. Do that after Auth exists so a second club is not another public-write project.

### 13. Small product and hygiene items

- English UI strings are a roadmap item. Keep zh-Hant as the default; the court UI is already in Traditional Chinese. An English layer is optional and should not block P0.
- Gender is stored as `男` or `女` only. It is display data, not a scoring input. Add an unspecified value only if the club asks, and keep old rows readable.
- The seed roster in [storage.js](../storage.js) uses personal-looking names. If those are real members, replace them with fictional names before encouraging more public forks.
- Viewers can export JSON. That matches public read. Mention it next to the passcode docs so it is not a surprise.
- Activity history is local-only. That is acceptable. Escape it with the other HTML sinks.
- There is no formatter or linter. A small ESLint config that flags browser globals and unused functions is enough. Do not add a bundler just to lint; the no-build layout is a stated constraint in [CONTRIBUTING.md](../CONTRIBUTING.md).
- This review could not read branch protection (the API returned 403). If `main` does not require the CI check, a red audit does not stop publication. Require the validate job once it is green.
- [CODEOWNERS](../.github/CODEOWNERS) already assigns the tree to `@kobo046`. That matches a single maintainer.

## Suggested order of pull requests

1. Capacitor 7.6.9 (all three packages) and an audit gate that blocks on production advisories.
2. Pages source switched to the Actions workflow, artifact limited to `ios-web`, README corrected.
3. HTML escaping and a regression test.
4. Supabase Auth, membership roles, restrictive RLS, and removal of the shared passcode. Take a backup first. Optionally revoke public writes earlier if the club can tolerate failed cloud saves for a while.
5. Dependabot groups, the missing label, and closing PRs 9–12. Merge the Playwright bump and the Actions bumps only after step 1 is green. Merge the Pages action bumps with step 2.
6. Playwright in CI.
7. Changelog, release notes, and architecture doc.
8. P2 cleanup: dead scoring file, CSS, images, fonts, PWA cache.

## Suggested issues

These were not opened with this pull request. File them with the existing templates if you want them tracked separately. Three is enough.

1. **[Feature]: Replace the shared passcode with Supabase Auth and restrictive RLS.** Area: Supabase and permissions. Cover the membership table, anonymous-read versus editor-write policies, a backup-and-rollback note, and tests that do not target production. Link item 1 above.
2. **[Bug]: CI fails on `npm audit` while `@capacitor/ios@7.6.2` is in the critical proxy-path range.** Surface: iOS app and tests. Ask for a 7.6.9 bump of core, ios, and cli together, a rebuilt iOS install, and a production-only blocking audit. Link PRs 9–11 as the major bump not to merge.
3. **[Bug]: GitHub Pages publishes the `main` branch root, so CI failure does not gate the site.** Surface: GitHub Pages website. Ask to switch the source to [pages.yml](../.github/workflows/pages.yml) and to stop serving SQL, tests, and scripts.

## What this review did not do

No application behavior was changed. Dependabot pull requests were not merged or closed. The production Supabase project was not queried or modified. Playwright was not executed in this environment.
