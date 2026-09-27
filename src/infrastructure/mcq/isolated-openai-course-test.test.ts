import { describe, expect, it, vi } from "vitest";
import { runIsolatedCourseTest, TEST_MODEL } from "../../../scripts/test-openai-course-isolated";
import { generatedCourseItems } from "@/application/mcq/course-generation";

vi.mock("node:crypto", async importOriginal => ({ ...await importOriginal<typeof import("node:crypto")>(), createHash: () => ({ update: () => ({ digest: () => "f6e0e6a5c46a9504719974cf979c18924b612f79bc96697d069e88774aa34bd7" }) }) }));
const quote = "Texte documentaire synthétique réservé au test.";
const dependencies = () => ({ read: vi.fn(async () => new Uint8Array([1])), extract: vi.fn(async () => ({ text: quote, pages: 1 })), generator: vi.fn(() => ({ generate: vi.fn() })) });
describe("isolated OpenAI test safety", () => {
  it("prepares without authorization without accessing a generator or requiring a key", async () => {
    const deps = dependencies();
    expect(await runIsolatedCourseTest(["--pdf=fixture.pdf"], {}, deps)).toMatchObject({ status: "PREPARED_ONLY", realCallExecuted: false, databaseOpened: false, filesWritten: 0 });
    expect(deps.generator).not.toHaveBeenCalled();
  });
  it("rejects extra arguments and missing server configuration before reading or generating", async () => {
    const deps = dependencies();
    await expect(runIsolatedCourseTest(["--pdf=x", "--database=production"], {}, deps)).rejects.toThrow("TEST_ARGUMENTS_INVALID");
    await expect(runIsolatedCourseTest(["--pdf=x", "--authorize-openai-test"], {}, deps)).rejects.toThrow("TEST_SERVER_CONFIGURATION_MISSING");
    await expect(runIsolatedCourseTest(["--pdf=x", "--authorize-openai-test"], { OPENAI_API_KEY: "synthetic", OPENAI_MCQ_MODEL: "other", AI_DAILY_BUDGET_CAD: "1" }, deps)).rejects.toThrow("TEST_SERVER_CONFIGURATION_MISSING");
    expect(deps.read).not.toHaveBeenCalled(); expect(deps.generator).not.toHaveBeenCalled();
  });
  it("validates two drafts in memory without outputting content or credentials", async () => {
    const deps = dependencies();
    deps.generator.mockReturnValue({ generate: vi.fn(async source => generatedCourseItems({ questions: [1, 2].map(n => ({ stem: `Question synthétique ${n} ?`, options: ["Un", "Deux", "Trois", "Quatre"], correct: "a", explanation: quote, simple: quote, analogy: "NOT_SUPPORTED_BY_SOURCE", mechanism: quote, reasoning: quote, clue: quote, justifications: [quote, quote, quote, quote], trap: quote, takeaway: quote, transfer: quote, quote, competency: "1.1" })) }, source)) });
    const result = await runIsolatedCourseTest(["--pdf=x", "--authorize-openai-test"], { OPENAI_API_KEY: "synthetic", OPENAI_MCQ_MODEL: TEST_MODEL, AI_DAILY_BUDGET_CAD: "1" }, deps);
    expect(result).toMatchObject({ status: "PASS", draftCandidates: 2, published: 0, filesWritten: 0, databaseOpened: false });
    expect(JSON.stringify(result)).not.toContain(quote); expect(JSON.stringify(result)).not.toContain("synthetic");
  });
});
