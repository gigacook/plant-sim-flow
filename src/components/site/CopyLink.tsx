"use client";
import { useState } from "react";

/** Copies an absolute link (origin + base path + path) for sharing with students. */
export default function CopyLink({ path, label = "Kopiera länk till studenter" }: { path: string; label?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const copy = async () => {
    const url = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setState("ok");
    } catch {
      window.prompt("Kopiera länken:", url);
      setState("fail");
    }
    setTimeout(() => setState("idle"), 2500);
  };
  return (
    <button type="button" onClick={copy} className="s-btn">
      {state === "ok" ? "✓ Kopierad" : label}
    </button>
  );
}
