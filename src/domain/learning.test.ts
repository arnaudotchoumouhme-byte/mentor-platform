import { describe, expect, it } from "vitest";
import { masteryLabel, nextInterval } from "./learning";

describe("nextInterval", () => {
  it("replans an easy card further away", () =>
    expect(nextInterval("Facile", 4)).toBe(8));
  it("makes an immediate review due today", () =>
    expect(nextInterval("À revoir", 12)).toBe(0));
  it("never schedules a non-immediate review below one day", () =>
    expect(nextInterval("Difficile", 1)).toBe(1));
  it.each([
    ["Très facile", 10, 28],
    ["Facile", 10, 21],
    ["Moyen", 10, 15],
    ["Difficile", 10, 8],
    ["À revoir", 0, 0],
    ["Inconnu", 10, 10],
  ])("preserves the historical result for %s", (rating, current, expected) => {
    expect(nextInterval(rating, current)).toBe(expected);
  });
  it("is deterministic for identical inputs", () => {
    expect(nextInterval("Facile", 7)).toBe(nextInterval("Facile", 7));
  });
});

describe("masteryLabel", () => {
  it("uses stable thresholds", () => {
    expect(masteryLabel(80)).toBe("Solide");
    expect(masteryLabel(60)).toBe("En progression");
    expect(masteryLabel(30)).toBe("À renforcer");
  });
  it.each([
    [0, "À renforcer"],
    [54, "À renforcer"],
    [55, "En progression"],
    [56, "En progression"],
    [74, "En progression"],
    [75, "Solide"],
    [76, "Solide"],
    [100, "Solide"],
  ])("preserves the label at boundary %i", (score, expected) => {
    expect(masteryLabel(score)).toBe(expected);
  });
});
