import { describe, expect, it } from "vitest";
import { masteryLabel, nextInterval } from "./domain";

describe("spaced repetition", () => {
  it("replans an easy card further away", () => expect(nextInterval("Facile", 4)).toBe(8));
  it("makes an immediate review due today", () => expect(nextInterval("À revoir", 12)).toBe(0));
  it("never schedules a non-immediate review below one day", () => expect(nextInterval("Difficile", 1)).toBe(1));
});

describe("mastery label", () => {
  it("uses stable thresholds", () => {
    expect(masteryLabel(80)).toBe("Solide");
    expect(masteryLabel(60)).toBe("En progression");
    expect(masteryLabel(30)).toBe("À renforcer");
  });
});
