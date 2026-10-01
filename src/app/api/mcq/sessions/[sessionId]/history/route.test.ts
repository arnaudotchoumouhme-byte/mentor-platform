import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/shared/errors/app-error";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), authorize: vi.fn(), execute: vi.fn() }));
vi.mock("@/infrastructure/pilot/server-pilot", () => ({ requirePilotIdentity: mocks.identity, pilotOwnership: { assertMcqSession: mocks.authorize } }));
vi.mock("@/infrastructure/mcq/server-mcq", () => ({ mcqServices: { history: { execute: mocks.execute } } }));
const sessionId = "11111111-1111-4111-8111-111111111111";
const request = () => GET(new Request("http://local/history"), { params: Promise.resolve({ sessionId }) });
beforeEach(() => { vi.resetAllMocks(); mocks.identity.mockResolvedValue({ learnerId: "learner" }); mocks.execute.mockResolvedValue({ status: "COMPLETED", score: { percentage: 80 } }); });

it("reads completed history after ownership validation and prevents caching", async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.authorize).toHaveBeenCalledWith(sessionId, "learner");
  expect(mocks.execute).toHaveBeenCalledWith(sessionId);
  expect(mocks.authorize.mock.invocationCallOrder[0]).toBeLessThan(mocks.execute.mock.invocationCallOrder[0]!);
});

it("denies another learner before historical data is loaded", async () => {
  mocks.authorize.mockRejectedValue(new AppError({ code: "PILOT_ACCESS_DENIED", userMessage: "Accès refusé.", category: "security" }));
  expect((await request()).status).toBe(403);
  expect(mocks.execute).not.toHaveBeenCalled();
});
