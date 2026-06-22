import { describe, it, expect, vi } from "vitest";
import { registerServiceWorker } from "@/lib/pwa/register";

function fakeReg() {
  const listeners: Record<string, () => void> = {};
  const installing = {
    state: "installing",
    addEventListener: (e: string, cb: () => void) =>
      (listeners["state:" + e] = cb),
  };
  return {
    installing,
    addEventListener: (e: string, cb: () => void) => (listeners[e] = cb),
    fire: (e: string) => listeners[e]?.(),
    fireState: () => listeners["state:statechange"]?.(),
  };
}

function fakeNavigator(reg: ReturnType<typeof fakeReg>, hasController = true) {
  return {
    serviceWorker: {
      register: vi.fn().mockResolvedValue(reg),
      controller: hasController ? {} : null,
    },
  } as unknown as Navigator;
}

describe("registerServiceWorker", () => {
  it("no-ops when not production", async () => {
    const reg = fakeReg();
    const nav = fakeNavigator(reg);
    await registerServiceWorker({
      navigator: nav,
      isProduction: false,
      onUpdateReady: () => {},
    });
    expect(
      nav.serviceWorker.register as ReturnType<typeof vi.fn>
    ).not.toHaveBeenCalled();
  });

  it("registers /sw.js in production", async () => {
    const reg = fakeReg();
    const nav = fakeNavigator(reg);
    await registerServiceWorker({
      navigator: nav,
      isProduction: true,
      onUpdateReady: () => {},
    });
    expect(nav.serviceWorker.register).toHaveBeenCalledWith("/sw.js");
  });

  it("fires onUpdateReady when a new worker installs with a controller present", async () => {
    const reg = fakeReg();
    const nav = fakeNavigator(reg, true);
    const onUpdateReady = vi.fn();
    await registerServiceWorker({
      navigator: nav,
      isProduction: true,
      onUpdateReady,
    });
    reg.fire("updatefound");
    reg.installing.state = "installed";
    reg.fireState();
    expect(onUpdateReady).toHaveBeenCalledTimes(1);
  });
});
