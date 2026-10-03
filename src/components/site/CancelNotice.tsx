"use client";
import { useEffect, useState } from "react";

/** Shown after returning from an abandoned checkout (?avbrutet=1). */
export default function CancelNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(new URL(window.location.href).searchParams.get("avbrutet") === "1"), []);
  if (!show) return null;
  return (
    <div role="status" className="mb-6 rounded-md bg-[var(--paper-2)] p-3 text-[14px] text-[var(--ink-s2)]">
      Köpet avbröts – inget har debiterats. Du kan försöka igen när du vill.
    </div>
  );
}
