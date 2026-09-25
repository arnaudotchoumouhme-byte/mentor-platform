import { describe, expect, it, vi } from "vitest";
import type { CourseTraining } from "@/application/mcq/course-training";
import { AppError } from "@/shared/errors/app-error";
import { courseHandlers } from "./route";

const context = { params: Promise.resolve({ documentId: "1" }) };
const caller = { accountId: "account", learnerId: "owner" };
describe("course training API", () => {
  it("requires identity before loading business infrastructure", async () => {
    const load = vi.fn(); const meter = vi.fn();
    const handlers = courseHandlers(async () => { throw new AppError({ code: "UNAUTHORIZED", userMessage: "Authentification requise." }); }, load, meter);
    expect((await handlers.GET(new Request("http://local/api/courses/1/training"), context)).status).toBe(401);
    expect(load).not.toHaveBeenCalled(); expect(meter).not.toHaveBeenCalled();
  });
  it("checks ownership before metering, without disclosing another learner", async () => {
    const execute = vi.fn(); const meter = vi.fn();
    const service = { read: () => { throw new AppError({ code: "FORBIDDEN", userMessage: "Accès refusé." }); }, execute } as unknown as CourseTraining;
    const handlers = courseHandlers(async () => caller, async () => service, meter);
    const response = await handlers.POST(new Request("http://local/api/courses/1/training", { method: "POST", body: JSON.stringify({ action: "generate" }) }), context);
    expect(response.status).toBe(403); expect(execute).not.toHaveBeenCalled(); expect(meter).not.toHaveBeenCalled();
  });
  it("rejects client identity and publication without explicit reviewed confirmation", async () => {
    const load = vi.fn();
    const handlers = courseHandlers(async () => caller, load, vi.fn());
    for (const body of [{ action: "generate", learnerId: "forged" }, { action: "publish", approvals: [] }]) {
      expect((await handlers.POST(new Request("http://local/api/courses/1/training", { method: "POST", body: JSON.stringify(body) }), context)).status).toBe(400);
    }
    expect(load).not.toHaveBeenCalled();
  });
});
