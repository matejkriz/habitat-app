# DB Naming Cleanup

## Summary

- Removed all remaining legacy DB naming from the codebase.
- Renamed imports/usages to `db`.
- Removed the default export from `lib/db.ts` to keep one explicit named export.
- Replaced old ORM-style API names with domain DB API names:
  - `user` -> `users`, `child` -> `children`, `parentChild` -> `parentLinks`, `excuse` -> `excuses`, `closedDay` -> `closedDays`, `auditLog` -> `auditLogs`
  - `findUnique` -> `get`, `findMany` -> `list`, `findFirst` -> `first`, `upsert` -> `save`, `updateMany` -> `bulkUpdate`, `delete` -> `remove`

## Review

- [x] No legacy DB identifier remains in runtime code
- [x] No old ORM files remain in repository root
- [x] No old ORM-style method names remain in app/lib call sites
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test:run`
