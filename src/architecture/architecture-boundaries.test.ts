import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")
      ? [target]
      : [];
  });
}

function violations(directory: string, forbidden: RegExp): string[] {
  return sourceFiles(directory).filter((file) => forbidden.test(readFileSync(file, "utf8")));
}

describe("architecture boundaries", () => {
  const sourceRoot = path.resolve("src");

  it("keeps domain independent from frameworks and infrastructure", () => {
    const forbidden = /(?:from\s+["'](?:next|react|node:|@\/infrastructure|@\/app)|process\.env|node:sqlite)/;
    expect(violations(path.join(sourceRoot, "domain"), forbidden)).toEqual([]);
  });

  it("keeps application independent from Next.js and SQLite", () => {
    const forbidden = /(?:from\s+["'](?:next|@\/app(?:\/|["'])|@\/infrastructure)|NextResponse|node:sqlite|\bSQLite\b)/;
    expect(violations(path.join(sourceRoot, "application"), forbidden)).toEqual([]);
  });

  it("prevents shared contracts from depending on the app layer", () => {
    expect(
      violations(path.join(sourceRoot, "shared"), /from\s+["']@\/app/),
    ).toEqual([]);
  });

  it("keeps SQL and moved business algorithms out of route handlers", () => {
    const routes = [
      path.join(sourceRoot, "app", "api", "actions", "route.ts"),
      path.join(sourceRoot, "app", "api", "ai", "route.ts"),
    ];
    const forbidden = /\b(?:SELECT|INSERT|UPDATE|DELETE)\s+(?:FROM|INTO|\w+\s+SET)|function\s+(?:nextInterval|masteryLabel)/i;
    expect(
      routes.filter((file) => forbidden.test(readFileSync(file, "utf8"))),
    ).toEqual([]);
  });
});
