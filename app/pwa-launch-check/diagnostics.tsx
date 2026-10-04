"use client";

import { useEffect, useRef } from "react";

export function LaunchDiagnostics() {
  const output = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const link = document.querySelector('link[rel="apple-touch-startup-image"]');
    if (!output.current) return;
    output.current.textContent = [
      `Rozměry: ${screen.width} × ${screen.height}, DPR ${devicePixelRatio}`,
      `Z plochy: ${matchMedia("(display-mode: standalone)").matches ? "ano" : "ne"}`,
      `Obrázek: ${link?.getAttribute("href") ?? "žádný pro tento model"}`,
      `Podmínka media: ${link?.getAttribute("media") ?? "bez podmínky"}`,
      `Počet obrázků: ${document.querySelectorAll('link[rel="apple-touch-startup-image"]').length}`,
    ].join("\n");
  }, []);

  return <pre ref={output} className="whitespace-pre-wrap break-all rounded-xl bg-black/20 p-4 text-sm">Ověřuji vybraný obrázek…</pre>;
}
