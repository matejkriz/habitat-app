import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GRADIENT_PATTERN = /(?:bg-gradient-|(?:linear|radial|conic)-gradient\s*\()/;

function findGradientFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return findGradientFiles(path);
    if (!/\.(?:css|tsx?)$/.test(entry.name) || entry.name.includes(".test.")) return [];

    return GRADIENT_PATTERN.test(readFileSync(path, "utf8")) ? [path] : [];
  });
}

describe("application UI style invariants", () => {
  it("does not use gradient backgrounds", () => {
    const uiRoots = ["app", "components"];
    const gradientFiles = uiRoots.flatMap((root) =>
      findGradientFiles(join(process.cwd(), root)),
    );

    expect(gradientFiles).toEqual([]);
  });
});
