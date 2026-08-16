# Remove ts-nocheck

## Summary

- Removed all `@ts-nocheck` comments.
- Added explicit types/casts for action returns and client state updates.
- Fixed JSX guard in audit log and normalized readonly arrays in state setters.
- Cleaned up `lib/db.ts` types to pass `tsc` and ESLint without `@ts-nocheck`.

## Review

- [x] All `@ts-nocheck` comments removed
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] `pnpm test:run` passes
