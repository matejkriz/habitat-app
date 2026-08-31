import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const CONVEX_DIR = join(process.cwd(), "convex");

/**
 * Convex serves `query`/`mutation`/`action` exports and `httpAction` routes as
 * public endpoints. Unlike their `internal*` counterparts, they are reachable
 * by anyone who knows the deployment URL. Auth in the Next.js layer does not
 * protect them, so each one has to prove the caller is our own server.
 */
const PUBLIC_WRAPPER =
  /^export\s+const\s+(\w+)\s*=\s*(query|mutation|action|httpAction)\s*\(/;

function readConvexModules(
  directory = CONVEX_DIR,
): ReadonlyArray<{ file: string; source: string }> {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name.startsWith("_") ? [] : readConvexModules(path);
    }

    if (!entry.name.endsWith(".ts") || entry.name.includes(".test.")) {
      return [];
    }

    return [{
      file: relative(CONVEX_DIR, path),
      source: readFileSync(path, "utf8"),
    }];
  });
}

function findUnguardedPublicFunctions(): string[] {
  return readConvexModules().flatMap(({ file, source }) =>
    // Splitting on top-level exports keeps each function's args and handler
    // together, so a guard found here belongs to this function.
    source.split(/\n(?=export\s+const\s+)/).flatMap((chunk) => {
      const match = PUBLIC_WRAPPER.exec(chunk);
      if (!match) return [];

      const wrapper = match[2];
      const guarded =
        wrapper === "httpAction"
          ? /requireServerSecret\(/.test(chunk)
          : /secret:\s*v\.string\(\)/.test(chunk) &&
            /requireServerSecret\(args\.secret\)/.test(chunk);

      return guarded ? [] : [`${file}:${match[1]}`];
    }),
  );
}

describe("convex public function authorization", () => {
  it("guards every publicly callable function with the server secret", () => {
    expect(findUnguardedPublicFunctions()).toEqual([]);
  });
});
