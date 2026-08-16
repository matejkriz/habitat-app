# Convex Index Fix

## Summary

- Renamed reserved Convex index names from `by_id` to `by_app_id` across all tables.
- Updated Convex CRUD queries to use the new index name.

## Review

- [x] Schema updated without reserved index names
- [x] Convex functions updated to use new indexes
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] `pnpm test:run` passes
- [ ] `pnpm convex:dev` shows no schema errors (fails here due to telemetry DNS error)
