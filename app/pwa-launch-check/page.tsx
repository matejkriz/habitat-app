import type { Metadata } from "next";
import { LaunchDiagnostics } from "./diagnostics";

// This route belongs only to the diagnostic preview branch.
export const metadata: Metadata = {
  title: "Habitat výběr JS",
  manifest: "/pwa-launch-check.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: "Habitat výběr JS",
    statusBarStyle: "default",
  },
};

export default function LaunchCheckPage() {
  return (
    <main
      style={{
        background: "#186546",
        color: "white",
        minHeight: "100svh",
        padding: "calc(28px + env(safe-area-inset-top)) 24px 28px",
      }}
    >
      <h1 className="text-2xl font-bold">Habitat — automatický výběr obrázku</h1>
      <p className="my-6">
        Přidej tuto stránku v Safari na plochu jako „Habitat výběr JS“.
        Po otevření nové ikony by se před zelenou stránkou měl objevit
        krémový obrázek s logem Habitatu.
      </p>
      <LaunchDiagnostics />
      <p className="mt-6">Údaje zůstávají na tomto zařízení.</p>
    </main>
  );
}
