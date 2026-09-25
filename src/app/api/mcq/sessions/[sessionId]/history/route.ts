import { createSessionGet } from "../route";

const read = createSessionGet(
  async () => (await import("@/infrastructure/mcq/server-mcq")).mcqServices.history,
  async () => (await import("@/infrastructure/pilot/server-pilot")).requirePilotIdentity(),
  async (sessionId, learnerId) => (await import("@/infrastructure/pilot/server-pilot")).pilotOwnership.assertMcqSession(sessionId, learnerId),
);

export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const response = await read(request, context);
  response.headers.set("cache-control", "private, no-store");
  return response;
}
