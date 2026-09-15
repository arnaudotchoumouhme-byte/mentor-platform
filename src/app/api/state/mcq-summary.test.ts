import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/shared/errors/app-error";
vi.mock("@/lib/db", () => ({all: vi.fn(() => [])}));
vi.mock("@/infrastructure/database/sqlite/server-sqlite-executor", () => ({sqliteExecutor: {all: vi.fn(() => []), run: vi.fn()}}));
import { createStateGet } from "./route";
describe("learner QCM dashboard projection", () => {
  it("passes only the authenticated learner to the summary and preserves its signals", async () => {
    const summary = vi.fn(async () => ({available: true, resumableSessionId: "owned"}));
    const response = await createStateGet(async () => ({accountId: "a", learnerId: "learner-a"}), summary)();
    expect(response.status).toBe(200);
    expect(summary).toHaveBeenCalledWith("learner-a");
    expect(await response.json()).toMatchObject({mcq: {available: true, resumableSessionId: "owned"}});
  });
  it("does not load any QCM signal before authorization", async () => {
    const summary = vi.fn();
    const response = await createStateGet(async () => {throw new AppError({code: "PILOT_ACCESS_DENIED", userMessage: "Refus"});}, summary)();
    expect(response.status).toBe(403); expect(summary).not.toHaveBeenCalled();
  });
});
