// @vitest-environment node
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("attendance start across server time zones", () => {
  it.each(["UTC", "Europe/Prague"])("uses Prague calendar days on a %s server", TZ => {
    const result = execFileSync(process.execPath, ["--input-type=module", "-e", `
      import { registerHooks } from 'node:module';
      registerHooks({ resolve(specifier, context, nextResolve) {
        try { return nextResolve(specifier, context); }
        catch (error) {
          if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) return nextResolve(specifier + '.ts', context);
          throw error;
        }
      }});
      const { hasStartedAttendance } = await import('./lib/attendance-start.ts');
      console.log(JSON.stringify([
        hasStartedAttendance({}, new Date('2026-08-31T21:59:59.999Z')),
        hasStartedAttendance({}, new Date('2026-08-31T22:00:00.000Z')),
        hasStartedAttendance({}, new Date(2026, 8, 1)),
        hasStartedAttendance({ attendanceStartDate: '2026-11-02' }, new Date('2026-11-01T22:59:59.999Z')),
        hasStartedAttendance({ attendanceStartDate: '2026-11-02' }, new Date('2026-11-01T23:00:00.000Z')),
        hasStartedAttendance({ attendanceStartDate: '2026-11-02' }, new Date(2026, 10, 2)),
      ]));
    `], { env: { ...process.env, TZ, NODE_NO_WARNINGS: "1" }, encoding: "utf8" });
    expect(JSON.parse(result)).toEqual([false, true, true, false, true, true]);
  });
});
