"use client";

import { useEffect } from "react";
import { registerHabitatServiceWorker } from "@/lib/service-worker";
import { consumeLaunchTiming } from "@/lib/pwa-launch-timing";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    const timing = consumeLaunchTiming();
    if (timing) console.info("[habitat-launch]", JSON.stringify(timing));

    const register = () => {
      void registerHabitatServiceWorker().catch(() => undefined);
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
