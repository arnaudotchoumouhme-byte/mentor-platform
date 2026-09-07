// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MockExams from "./page";

vi.mock("@/components/mcq-session-runner", () => ({ McqSessionRunner: ({ sessionKind }: { sessionKind: string }) => React.createElement("div", { "data-testid": "mcq-runner" }, sessionKind) }));

describe("MockExams", () => {
  afterEach(cleanup);

  it("uses the specialized MCQ Core runner instead of the legacy QuizRunner", () => {
    render(React.createElement(MockExams));
    expect(screen.getByRole("heading", { name: "Examen blanc" })).toBeTruthy();
    expect(screen.getByTestId("mcq-runner").textContent).toBe("MOCK_EXAM");
  });
});
