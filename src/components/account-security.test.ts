// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUser } from "@auth0/nextjs-auth0";
import Settings from "@/app/settings/page";
import { AccountSecurity } from "./account-security";

vi.mock("@auth0/nextjs-auth0", () => ({ useUser: vi.fn() }));
vi.mock("@/hooks/use-state", () => ({ useAppState: () => ({ data: null }), subscribeAppStateDiagnostic: () => () => {}, getAppStateDiagnostic: () => ({ status: "loading" }) }));
vi.mock("@/components/ui", () => ({ Loading: () => null, Notice: () => null, PageHeader: () => null }));
function session(user: Record<string, unknown> | null, isLoading = false, error: Error | null = null) {
  vi.mocked(useUser).mockReturnValue({ user, isLoading, error, invalidate: vi.fn() } as ReturnType<typeof useUser>);
}
afterEach(cleanup);
describe("AccountSecurity", () => {
  it("offers normal Auth0 logout, showing only a friendly name", () => {
    session({ sub: "private-subject", nickname: "Pilote", token: "private-token", cookie: "private-cookie", secret: "private-secret" });
    render(React.createElement(AccountSecurity));
    expect(screen.getByText("Connecté · Pilote")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Se déconnecter" }).getAttribute("href")).toBe("/auth/logout");
    expect(document.body.textContent).not.toContain("private-");
    expect(screen.queryByRole("link", { name: "Se connecter" })).toBeNull();
  });
  it("keeps login visible on settings even without business state", () => {
    session(null);
    render(React.createElement(Settings));
    expect(screen.getByRole("link", { name: "Se connecter" }).getAttribute("href")).toBe("/auth/login");
  });
  it("keeps logout visible when business state is unavailable", () => {
    session({ sub: "private-subject" });
    render(React.createElement(Settings));
    expect(screen.getByRole("link", { name: "Se déconnecter" })).toBeTruthy();
  });
  it("does not guess authentication while loading", () => {
    session(null, true);
    render(React.createElement(AccountSecurity));
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("offers login on profile failure without exposing diagnostics", () => {
    session(null, false, new Error("private-secret"));
    render(React.createElement(AccountSecurity));
    expect(screen.getByRole("link", { name: "Se connecter" })).toBeTruthy();
    expect(document.body.textContent).not.toContain("private-secret");
  });
});
