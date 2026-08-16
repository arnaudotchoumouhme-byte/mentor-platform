import { describe, expect, it, vi } from "vitest";
import type { OsceRepository } from "./osce-ports";
import { OsceService } from "./osce-use-cases";
import { station } from "@/domain/osce/osce.test";
import type { OsceAssessment, OsceDebrief, OsceInteraction, OsceRemediationLink, OsceSession, OsceStationVersion } from "@/domain/osce";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const otherStation = (): OsceStationVersion => ({
  ...station(), id: id(101), stationId: id(102), code: "OTHER_FIXTURE",
  disclosures: [{ ...station().disclosures[0]!, id: id(106) }],
  rubric: { ...station().rubric, id: id(107), criteria: [{ ...station().rubric.criteria[0]!, id: id(108) }] },
});

const setup = () => {
  let sequence = 20;
  const sessions = new Map<string, OsceSession>();
  const interactions = new Map<string, OsceInteraction[]>();
  const revealed = new Map<string, { disclosureId: string; revealedAt: string }[]>();
  let assessment: OsceAssessment | null = null;
  let debrief: OsceDebrief | null = null;
  const links: OsceRemediationLink[] = [];
  const repository: OsceRepository = {
    saveStationVersion: async () => undefined,
    findStationVersion: async (value) => value === id(1) ? station() : value === id(101) ? otherStation() : null,
    saveSession: async (value) => { sessions.set(value.id, value); },
    findSession: async (value) => sessions.get(value) ?? null,
    appendInteraction: async (value) => { interactions.set(value.sessionId, [...(interactions.get(value.sessionId) ?? []), value]); },
    listInteractions: async (value) => interactions.get(value) ?? [],
    revealDisclosure: async (sessionId, disclosureId, revealedAt) => { revealed.set(sessionId, [...(revealed.get(sessionId) ?? []), { disclosureId, revealedAt }]); },
    listRevealedDisclosures: async (value) => revealed.get(value) ?? [],
    saveAssessment: async (value) => { assessment = value; }, findAssessment: async () => assessment,
    saveDebrief: async (value) => { debrief = value; }, findDebrief: async () => debrief,
    saveRemediationLink: async (value) => { links.push(value); }, listRemediationLinks: async () => links,
    getReplay: async (sessionId) => { const session = sessions.get(sessionId); return session ? { session, stationVersionId: session.stationVersionId, rubricVersion: "v1", interactions: interactions.get(sessionId) ?? [], disclosures: revealed.get(sessionId) ?? [], assessment, debrief, remediationLinks: links } : null; },
  };
  let now = "2026-01-01T00:00:00.000Z";
  const remediation = { record: vi.fn() };
  const service = new OsceService({ repository, ids: { next: () => id(sequence++) }, clock: { now: () => now }, logger: { event: vi.fn() }, policy: { ruleVersion: "v1", assess: (value, observed) => value.rubric.criteria.map((criterion) => ({ criterionId: criterion.id, passed: observed.length > 0, justification: "fixture", evidence: "fixture", critical: criterion.critical && observed.length === 0 })) }, remediation });
  return { service, repository, remediation, sessions, interactions, setNow: (value: string) => { now = value; } };
};

describe("OSCE application security", () => {
  it("fails closed for another learner on every session operation without mutation", async () => {
    const context = setup();
    const owner = id(11); const intruder = id(12);
    const session = await context.service.start({ learnerId: owner, stationVersionId: id(1), traceId: "trace_osce" });
    const attempts = [
      () => context.service.state(session.id, intruder),
      () => context.service.interact({ sessionId: session.id, callerLearnerId: intruder, roleId: id(4), text: "forbidden", traceId: "trace_osce" }),
      () => context.service.reveal({ sessionId: session.id, callerLearnerId: intruder, disclosureId: id(6), traceId: "trace_osce" }),
      () => context.service.complete({ sessionId: session.id, callerLearnerId: intruder, traceId: "trace_osce" }),
      () => context.service.replay(session.id, intruder),
    ];
    for (const attempt of attempts) await expect(attempt()).rejects.toMatchObject({ code: "OSCE_SESSION_NOT_FOUND" });
    expect(context.sessions.get(session.id)?.state).toBe("ACTIVE");
    expect(context.interactions.get(session.id) ?? []).toHaveLength(0);
  });

  it("accepts a disclosure context only when it belongs to and was revealed in this session", async () => {
    const context = setup(); const learner = id(11);
    const session = await context.service.start({ learnerId: learner, stationVersionId: id(1), traceId: "trace_osce" });
    const base = { sessionId: session.id, callerLearnerId: learner, roleId: id(4), text: "TEST_FIXTURE", traceId: "trace_osce" };
    await expect(context.service.interact({ ...base, disclosureId: id(106) })).rejects.toMatchObject({ code: "OSCE_DISCLOSURE_FORBIDDEN" });
    await expect(context.service.interact({ ...base, disclosureId: id(6) })).rejects.toMatchObject({ code: "OSCE_DISCLOSURE_FORBIDDEN" });
    await context.repository.revealDisclosure(id(99), id(6), "now");
    await expect(context.service.interact({ ...base, disclosureId: id(6) })).rejects.toMatchObject({ code: "OSCE_DISCLOSURE_FORBIDDEN" });
    await context.service.interact(base);
    await context.service.reveal({ sessionId: session.id, callerLearnerId: learner, disclosureId: id(6), traceId: "trace_osce" });
    await expect(context.service.interact({ ...base, disclosureId: id(6) })).resolves.toMatchObject({ disclosureId: id(6) });
  });
});

describe("OSCE application behavior", () => {
  it("hides future disclosure and persists expiration", async () => { const context = setup(); const session = await context.service.start({ learnerId: id(11), stationVersionId: id(1), traceId: "trace_osce" }); expect(JSON.stringify(await context.service.state(session.id, id(11)))).not.toContain("hidden"); context.setNow("2026-01-01T00:02:00.000Z"); await expect(context.service.interact({ sessionId: session.id, callerLearnerId: id(11), roleId: id(4), text: "late", traceId: "trace_osce" })).rejects.toThrow(); expect((await context.repository.findSession(session.id))?.state).toBe("EXPIRED"); });
  it("persists assessment, debrief, replay and remediation", async () => { const context = setup(); const learner = id(11); const session = await context.service.start({ learnerId: learner, stationVersionId: id(1), traceId: "trace_osce" }); const done = await context.service.complete({ sessionId: session.id, callerLearnerId: learner, traceId: "trace_osce" }); expect(done.debrief.criticalErrors).toEqual([id(8)]); expect((await context.service.replay(session.id, learner)).stationVersionId).toBe(id(1)); expect(context.remediation.record).toHaveBeenCalledWith(expect.objectContaining({ sessionId: session.id, critical: true })); });

  it("refuses interaction after completion without changing history", async () => {
    const context = setup();
    const learner = id(11);
    const session = await context.service.start({ learnerId: learner, stationVersionId: id(1), traceId: "trace_osce" });
    await context.service.interact({ sessionId: session.id, callerLearnerId: learner, roleId: id(4), text: "before close", traceId: "trace_osce" });
    await context.service.complete({ sessionId: session.id, callerLearnerId: learner, traceId: "trace_osce" });
    const historyBefore = await context.repository.listInteractions(session.id);

    await expect(context.service.interact({ sessionId: session.id, callerLearnerId: learner, roleId: id(4), text: "after close", traceId: "trace_osce" }))
      .rejects.toMatchObject({ code: "OSCE_INVALID_TRANSITION" });

    expect((await context.repository.findSession(session.id))?.state).toBe("COMPLETED");
    expect(await context.repository.listInteractions(session.id)).toEqual(historyBefore);
  });

  it("persists and replays a satisfactory assessment without recalculation", async () => {
    const context = setup();
    const learner = id(11);
    const session = await context.service.start({ learnerId: learner, stationVersionId: id(1), traceId: "trace_osce" });
    await context.service.interact({ sessionId: session.id, callerLearnerId: learner, roleId: id(4), text: "criterion evidence", traceId: "trace_osce" });

    const completed = await context.service.complete({ sessionId: session.id, callerLearnerId: learner, traceId: "trace_osce" });
    const persisted = await context.repository.findAssessment(session.id);
    const replay = await context.service.replay(session.id, learner);

    expect(completed.session.state).toBe("COMPLETED");
    expect(completed.assessment.result).toBe("SATISFACTORY");
    expect(persisted?.result).toBe("SATISFACTORY");
    expect(replay.assessment).toEqual(persisted);
    expect(replay.debrief).toEqual(completed.debrief);
  });
});
