"use client";

import { useEffect } from "react";
import { useStore } from "@/store";
import { pushToast } from "@/store/slices/ui-slice";
import { registerServiceWorker } from "@/lib/pwa/register";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerServiceWorker({
      navigator,
      isProduction: process.env.NODE_ENV === "production",
      onUpdateReady: () => {
        useStore.setState((s) => ({
          ui: pushToast(s.ui, {
            tone: "info",
            title: "New version available",
            description: "Refresh the page to update.",
            ttlMs: 10000,
          }),
        }));
      },
    });
  }, []);
  return null;
}
