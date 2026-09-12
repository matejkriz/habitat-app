"use client";

import { useEffect } from "react";
import { registerHabitatServiceWorker } from "@/lib/service-worker";

export function ServiceWorkerRegistration() {
  useEffect(() => {
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
