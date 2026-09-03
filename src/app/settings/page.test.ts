// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsForm } from "./page";

describe("SettingsForm", () => {
  afterEach(cleanup);

  it("confirms a successful save and clears stale confirmation after editing", async () => {
    const act = vi.fn().mockResolvedValue(undefined);
    render(React.createElement(SettingsForm, { initial: { displayName: "Mentor" }, act }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les paramètres" }));
    expect((await screen.findByRole("status")).textContent).toContain("Paramètres enregistrés");
    fireEvent.change(screen.getByLabelText("Nom affiché"), { target: { value: "Nouveau nom" } });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows an actionable terminal error and restores the submit button", async () => {
    const act = vi.fn().mockRejectedValue(new Error("private detail"));
    render(React.createElement(SettingsForm, { initial: {}, act }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les paramètres" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Enregistrement impossible");
    expect(screen.getByRole("button", { name: "Enregistrer les paramètres" })).toBeTruthy();
    expect(screen.queryByText("private detail")).toBeNull();
  });

  it("prevents synchronous duplicate saves", async () => {
    let finish: () => void = () => undefined;
    const act = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(React.createElement(SettingsForm, { initial: {}, act }));
    const button = screen.getByRole("button", { name: "Enregistrer les paramètres" });
    fireEvent.click(button); fireEvent.click(button);
    expect(act).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
  });

  it("locks editing during a pending save so stale success cannot be shown", async () => {
    let finish: () => void = () => undefined;
    const act = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(React.createElement(SettingsForm, { initial: { displayName: "Mentor" }, act }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les paramètres" }));
    const input = screen.getByLabelText("Nom affiché") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    finish();
    await screen.findByRole("status");
    expect(input.disabled).toBe(false);
  });

  it("confirms a new save only after a post-success edit is submitted", async () => {
    const act = vi.fn().mockResolvedValue(undefined);
    render(React.createElement(SettingsForm, { initial: { displayName: "Mentor" }, act }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les paramètres" }));
    await screen.findByRole("status");
    fireEvent.change(screen.getByLabelText("Nom affiché"), { target: { value: "Nouveau nom" } });
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les paramètres" }));
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(act).toHaveBeenCalledTimes(2);
  });
});
