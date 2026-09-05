"use client";

import { useEffect, useState } from "react";
import {
  registerDirectorPushSubscription,
  unregisterDirectorPushSubscription,
} from "@/app/actions/push-notifications";
import { Toggle } from "@/components/ui";
import { getActiveHabitatServiceWorker } from "@/lib/service-worker";

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function PushNotificationToggle() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isBusy, setIsBusy] = useState(true);
  const [message, setMessage] = useState("Zjišťuji stav…");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const isSupported = isPushSupported() && Boolean(publicKey);

  useEffect(() => {
    let active = true;
    if (!isSupported) {
      setIsBusy(false);
      setMessage("Na tomto zařízení nejsou dostupné");
      return () => {
        active = false;
      };
    }

    void getActiveHabitatServiceWorker()
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (!active) return;
        setIsEnabled(Boolean(subscription));
        setMessage(subscription ? "Zapnuto pro toto zařízení" : "Vypnuto");

        // Repair a missing server-side record without asking the director to
        // toggle notifications off and on again.
        if (subscription) {
          const serialized = subscription.toJSON();
          if (serialized.endpoint && serialized.keys?.p256dh && serialized.keys.auth) {
            await registerDirectorPushSubscription({
              endpoint: serialized.endpoint,
              keys: {
                p256dh: serialized.keys.p256dh,
                auth: serialized.keys.auth,
              },
            });
          }
        }
      })
      .catch(() => {
        if (active) setMessage("Stav se nepodařilo načíst");
      })
      .finally(() => {
        if (active) setIsBusy(false);
      });

    return () => {
      active = false;
    };
  }, [isSupported]);

  const enable = async () => {
    if (!publicKey) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setMessage("Povolení bylo zamítnuto v prohlížeči");
      return;
    }

    const registration = await getActiveHabitatServiceWorker();
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));
    const serialized = subscription.toJSON();
    if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
      throw new Error("Prohlížeč neposkytl platný push odběr");
    }

    await registerDirectorPushSubscription({
      endpoint: serialized.endpoint,
      keys: {
        p256dh: serialized.keys.p256dh,
        auth: serialized.keys.auth,
      },
    });
    setIsEnabled(true);
    setMessage("Zapnuto pro toto zařízení");
  };

  const disable = async () => {
    const registration = await getActiveHabitatServiceWorker();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await unregisterDirectorPushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setIsEnabled(false);
    setMessage("Vypnuto");
  };

  const handleChange = async (checked: boolean) => {
    setIsBusy(true);
    setMessage(checked ? "Zapínám…" : "Vypínám…");
    try {
      if (checked) await enable();
      else await disable();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Změna se nezdařila");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div role="none" className="border-b border-cream-dark px-3 py-3">
      <Toggle
        id="director-excuse-push"
        role="menuitemcheckbox"
        aria-label="Notifikace"
        aria-checked={isEnabled}
        label="Notifikace"
        description={message}
        checked={isEnabled}
        disabled={!isSupported || isBusy}
        onChange={(event) => void handleChange(event.currentTarget.checked)}
      />
    </div>
  );
}
