# Todo

- [x] Investigate Convex index naming error (reserved index name)
- [x] Update Convex schema index names to non-reserved values
- [x] Update Convex query usage to match new index names
- [x] Run verification: `pnpm typecheck`, `pnpm lint`, `pnpm test:run`
- [ ] Run Convex schema validation (via `pnpm convex:dev`) and capture result
- [x] Document results in `docs/tasks/convex-index-fix.md`

## Remove ts-nocheck

- [x] Remove all `@ts-nocheck` usages
- [x] Add explicit types to server actions and pages to satisfy `noImplicitAny`
- [x] Verify `pnpm typecheck`, `pnpm lint`, `pnpm test:run`
- [x] Document results in `docs/tasks/remove-ts-nocheck.md`
- [x] Ban `@ts-nocheck` in LESSONS.md

## Convex Typed API

- [x] Update Convex functions to new syntax with validators
- [ ] Run `pnpm convex:codegen` and confirm generated API references (fails: Sentry DNS)
- [x] Update Convex client wrapper to use typed `api` references
- [x] Run `pnpm typecheck`, `pnpm lint`, `pnpm test:run`
- [x] Document results in `docs/tasks/convex-typed-api.md`

## DB Naming Cleanup

- [x] Rename legacy DB export to `db` and update all imports/usages
- [x] Rename legacy ORM-style API to domain names (`users.get`, `attendance.list`, `attendance.save`, `excuses.remove`, etc.)
- [x] Remove default export from `/lib/db.ts`
- [x] Run `pnpm typecheck`, `pnpm lint`, `pnpm test:run`
- [x] Document results in `docs/tasks/db-cleanup.md`
