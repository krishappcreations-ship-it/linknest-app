/**
 * Service worker registration (feature 33). Production-only; injected navigator
 * + onUpdateReady make it unit-testable. Surfaces an update when a new worker
 * reaches "installed" while a controller is already in control.
 */

export interface RegisterDeps {
  navigator: Navigator;
  isProduction: boolean;
  onUpdateReady: () => void;
}

export async function registerServiceWorker(deps: RegisterDeps): Promise<void> {
  const { navigator: nav, isProduction, onUpdateReady } = deps;
  if (!isProduction) return;
  if (!("serviceWorker" in nav)) return;
  try {
    const reg = await nav.serviceWorker.register("/sw.js");
    reg.addEventListener("updatefound", () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && nav.serviceWorker.controller) {
          onUpdateReady();
        }
      });
    });
  } catch {
    // registration failure is non-fatal — the app still works without the SW.
  }
}
