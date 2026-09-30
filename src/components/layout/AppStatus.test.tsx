import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppStatus } from "./AppStatus";
import { usePwaStore, type BeforeInstallPromptEvent } from "@/pwa/pwaStore";

beforeEach(() => {
  usePwaStore.setState({
    updateReady: false, applyUpdate: null, updatedElsewhere: false, installEvent: null, online: true,
  });
});

describe("AppStatus", () => {
  it("shows nothing when there is nothing to say", () => {
    render(<AppStatus />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says when the device is offline", () => {
    usePwaStore.setState({ online: false });
    render(<AppStatus />);
    expect(screen.getByRole("status")).toHaveTextContent("Offline");
  });

  it("applies a waiting update on request", async () => {
    const applyUpdate = vi.fn();
    usePwaStore.setState({ updateReady: true, applyUpdate });
    render(<AppStatus />);
    await userEvent.click(screen.getByRole("button", { name: /update/i }));
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it("reloads a tab whose update was applied in another tab", async () => {
    const reload = vi.fn();
    usePwaStore.setState({ updatedElsewhere: true });
    render(<AppStatus reload={reload} />);
    await userEvent.click(screen.getByRole("button", { name: /update/i }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("offers to install, and forgets the single-use prompt afterwards", async () => {
    const prompt = vi.fn(async () => {});
    usePwaStore.setState({
      installEvent: { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) } as unknown as BeforeInstallPromptEvent,
    });
    render(<AppStatus />);
    await userEvent.click(screen.getByRole("button", { name: /install app/i }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(usePwaStore.getState().installEvent).toBeNull();
  });
});
