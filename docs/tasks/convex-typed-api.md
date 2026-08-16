# Convex Typed API

## Summary

- Migrated Convex CRUD functions to the new `query`/`mutation` syntax with validators.
- Updated the Convex client wrapper to use generated `api` function references instead of string names.

## Review

- [x] Convex functions use new syntax with `args` and `returns` validators
- [x] Client wrapper uses typed `api` references
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] `pnpm test:run` passes
- [ ] `pnpm convex:codegen` completes (fails: `getaddrinfo ENOTFOUND o1192621.ingest.sentry.io`)
