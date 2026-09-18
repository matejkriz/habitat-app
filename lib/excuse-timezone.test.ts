// @vitest-environment node
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Prague lunch deadline across server time zones", () => {
  it.each(["UTC", "Europe/Prague"])(
    "uses Czech business time on a %s server",
    (TZ) => {
      const result = execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `
      import { registerHooks } from 'node:module';
      registerHooks({ resolve(specifier, context, nextResolve) {
        try { return nextResolve(specifier, context); }
        catch (error) {
          if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) {
            return nextResolve(specifier + '.ts', context);
          }
          throw error;
        }
      }});
      const { getAutoApprovalDeadline, isAutoApproved, parseExcuseDate } = await import('./lib/excuse-rules.ts');
      const dates = ['2026-09-17', '2026-01-15', '2026-03-30', '2026-10-26'];
      console.log(JSON.stringify(dates.map(value => {
        const day = parseExcuseDate(value);
        const deadline = getAutoApprovalDeadline(day);
        return [deadline.toISOString(), isAutoApproved(new Date(deadline.getTime() - 1), day), isAutoApproved(deadline, day)];
      })));
    `,
        ],
        {
          env: { ...process.env, TZ, NODE_NO_WARNINGS: "1" },
          encoding: "utf8",
        },
      );
      expect(JSON.parse(result)).toEqual([
        ["2026-09-16T07:00:00.000Z", true, false],
        ["2026-01-14T08:00:00.000Z", true, false],
        ["2026-03-27T08:00:00.000Z", true, false],
        ["2026-10-23T07:00:00.000Z", true, false],
      ]);
    },
  );
});
