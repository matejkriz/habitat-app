const REGISTRATION_OPTIONS: RegistrationOptions = {
  scope: "/",
  updateViaCache: "none",
};

const READY_TIMEOUT_MS = 10_000;

export async function registerHabitatServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  return await navigator.serviceWorker.register("/sw.js", REGISTRATION_OPTIONS);
}

export async function getActiveHabitatServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing?.active) return existing;

  const registered = await registerHabitatServiceWorker();
  if (!registered) {
    throw new Error("Service worker není na tomto zařízení dostupný");
  }
  if (registered.active) return registered;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Notifikace se nepodařilo připravit")),
          READY_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
