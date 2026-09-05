// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const diagnostic = vi.hoisted(() => ({ current: { status: "loading" } as { status: string; message?: string; traceId?: string } }));
vi.mock("@/hooks/use-state", () => ({
  getAppStateDiagnostic: () => diagnostic.current,
  subscribeAppStateDiagnostic: () => () => undefined,
}));

import { Loading } from "./ui";

describe("Loading diagnostic states", () => {
  afterEach(cleanup);

  it.each([
    ["network-error", "Serveur injoignable"],
    ["server-error", "Service indisponible"],
    ["conflict", "Conflit détecté"],
  ])("replaces loading with an actionable %s state", (status, title) => {
    diagnostic.current = { status, traceId: "trace_safe_123" };
    render(React.createElement(Loading));
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(screen.queryByText("Chargement")).toBeNull();
    expect(screen.getByText("trace_safe_123")).toBeTruthy();
  });

  it("offers a safe exit when pilot access is denied", () => {
    diagnostic.current = { status: "access-denied" };
    render(React.createElement(Loading));
    expect(screen.getByRole("link", { name: "Se déconnecter" }).getAttribute("href")).toBe("/auth/logout");
    expect(screen.queryByText("Chargement")).toBeNull();
  });
});
