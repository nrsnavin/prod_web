import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePwaStore } from "./pwaStore";
import {
  UPDATE_CHECK_MS,
  registerServiceWorker,
  watchConnectivityAndInstall,
  type PwaEnv,
} from "./registerServiceWorker";

class FakeWorker extends EventTarget {
  state = "installing";
  postMessage = vi.fn();
  become(state: string) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  update = vi.fn(async () => undefined);
}

function setup(opts: { controlled: boolean; waiting?: boolean }) {
  const reg = new FakeRegistration();
  if (opts.waiting) reg.waiting = new FakeWorker();
  const container = Object.assign(new EventTarget(), {
    controller: opts.controlled ? ({} as ServiceWorker) : null,
    register: vi.fn(async () => reg),
  });
  const win = new EventTarget() as EventTarget & { setInterval: ReturnType<typeof vi.fn> };
  win.setInterval = vi.fn();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const env = {
    window: win,
    navigator: { serviceWorker: container, onLine: true },
    document: doc,
    reload: vi.fn(),
  } as unknown as PwaEnv;
  return { reg, container, win, doc, env };
}

const state = () => usePwaStore.getState();

beforeEach(() => {
  usePwaStore.setState({
    updateReady: false, applyUpdate: null, updatedElsewhere: false, installEvent: null, online: true,
  });
});

describe("service worker updates", () => {
  it("registers at the root, bypassing the HTTP cache for sw.js", async () => {
    const t = setup({ controlled: false });
    await registerServiceWorker(t.env);
    expect(t.container.register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
  });

  it("offers a build that finished installing while nobody was looking", async () => {
    const t = setup({ controlled: true, waiting: true });
    await registerServiceWorker(t.env);
    expect(state().updateReady).toBe(true);
  });

  it("offers a build that installs while the app is open", async () => {
    const t = setup({ controlled: true });
    await registerServiceWorker(t.env);
    t.reg.installing = new FakeWorker();
    t.reg.dispatchEvent(new Event("updatefound"));
    expect(state().updateReady).toBe(false); // still installing
    t.reg.installing.become("installed");
    expect(state().updateReady).toBe(true);
  });

  it("switches and reloads only when the user presses Update", async () => {
    const t = setup({ controlled: true, waiting: true });
    await registerServiceWorker(t.env);
    expect(t.reg.waiting!.postMessage).not.toHaveBeenCalled();
    state().applyUpdate!();
    expect(t.reg.waiting!.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(t.env.reload).not.toHaveBeenCalled(); // not until the new worker is in charge
    t.container.dispatchEvent(new Event("controllerchange"));
    expect(t.env.reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload another tab under its user; tells it instead", async () => {
    const t = setup({ controlled: true });
    await registerServiceWorker(t.env);
    t.container.dispatchEvent(new Event("controllerchange")); // another tab pressed Update
    expect(t.env.reload).not.toHaveBeenCalled();
    expect(state().updatedElsewhere).toBe(true);
  });

  it("treats the very first install as nothing to announce", async () => {
    const t = setup({ controlled: false });
    await registerServiceWorker(t.env);
    t.reg.installing = new FakeWorker();
    t.reg.dispatchEvent(new Event("updatefound"));
    t.reg.installing.become("installed");
    t.container.dispatchEvent(new Event("controllerchange")); // clients.claim()
    expect(state().updateReady).toBe(false);
    expect(state().updatedElsewhere).toBe(false);
    expect(t.env.reload).not.toHaveBeenCalled();
  });

  it("checks for a new build periodically and when the tab comes back into view", async () => {
    const t = setup({ controlled: true });
    await registerServiceWorker(t.env);
    expect(t.win.setInterval).toHaveBeenCalledWith(expect.any(Function), UPDATE_CHECK_MS);
    (t.doc as { visibilityState: string }).visibilityState = "hidden";
    t.doc.dispatchEvent(new Event("visibilitychange"));
    expect(t.reg.update).not.toHaveBeenCalled();
    (t.doc as { visibilityState: string }).visibilityState = "visible";
    t.doc.dispatchEvent(new Event("visibilitychange"));
    expect(t.reg.update).toHaveBeenCalledTimes(1);
  });

  it("does nothing where service workers are unavailable", async () => {
    const t = setup({ controlled: false });
    (t.env.navigator as unknown as { serviceWorker?: unknown }).serviceWorker = undefined;
    await expect(registerServiceWorker(t.env)).resolves.toBeUndefined();
  });
});

describe("connectivity and install prompt", () => {
  it("follows the browser's online state", () => {
    const t = setup({ controlled: false });
    const stop = watchConnectivityAndInstall(t.env);
    t.win.dispatchEvent(new Event("offline"));
    expect(state().online).toBe(false);
    t.win.dispatchEvent(new Event("online"));
    expect(state().online).toBe(true);
    stop();
    t.win.dispatchEvent(new Event("offline"));
    expect(state().online).toBe(true);
  });

  it("holds the install prompt for the Install button instead of the browser's infobar", () => {
    const t = setup({ controlled: false });
    watchConnectivityAndInstall(t.env);
    const e = new Event("beforeinstallprompt", { cancelable: true });
    t.win.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(state().installEvent).toBe(e);
    t.win.dispatchEvent(new Event("appinstalled"));
    expect(state().installEvent).toBeNull();
  });
});
