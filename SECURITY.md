# Security Policy

## Supported version

Security fixes are applied to the latest commit on `main`. The hosted GitHub Pages build and the current iOS source bundle are the supported versions.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could expose or modify club data.

Use GitHub's private vulnerability reporting for this repository. If that option is unavailable, contact the maintainer through the GitHub profile and include:

- affected version or commit;
- reproduction steps;
- expected impact;
- suggested mitigation, if known.

Do not access, alter, or download data belonging to another deployment while testing.

## Credential policy

- Supabase publishable keys may be used by browser clients and are not secret credentials.
- Supabase secret keys, legacy `service_role` keys, personal access tokens, private backups, and Apple signing material must never be committed.
- Rotate any privileged credential immediately if it appears in Git history, logs, screenshots, or an issue.

`npm run validate` scans public release files for common privileged credential formats.

## Current authorization limitation

The default hosted deployment uses a client-side passcode as a convenience UI gate. It does **not** provide database-level authorization because a browser client can inspect front-end code and call a public-write API directly.

Deployments containing sensitive or untrusted multi-user data must use Supabase Auth and restrictive Row Level Security policies before going into production. Until that migration is complete:

- treat the hosted instance as a small trusted-group tool;
- keep frequent JSON backups;
- do not store private contact or identity data;
- monitor Supabase records for unexpected changes;
- use a separate Supabase project for development.

The secure Auth/RLS migration is tracked in the project roadmap and is the highest-priority security item.
