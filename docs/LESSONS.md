# Lessons

## 2026-02-09
- Correction: Convex index name `by_id` is reserved and causes `convex:dev` to fail.
- Rule: Avoid reserved index names (`by_id`, `by_creation_time`, or names starting with `_`) when defining Convex indexes.
- Correction: Avoided `@ts-nocheck` and fixed types explicitly instead.
- Rule: Never use `@ts-nocheck`; add proper types/casts or refactor so `tsc` passes cleanly.
