"use client";
// Checkout return status. Access is decided by the (mock) backend's entitlement store – which only changes
// through verified webhooks – never by the fact that the browser reached this page.
import { useEffect, useState } from "react";
import Link from "next/link";
import { accessStatus, load } from "@/lib/billing/mock";
import { isMock } from "@/lib/brand";

type View = { kind: "none" } | { kind: "unknown" } | { kind: "status"; email: string; status: string; until: string | null };

export default function PurchaseStatus() {
  const [view, setView] = useState<View>({ kind: "none" });
  useEffect(() => {
    if (!isMock) return;
    const id = new URL(window.location.href).searchParams.get("session");
    if (!id) return;
    const s = load();
    const session = s.sessions[id];
    if (!session) return setView({ kind: "unknown" });
    const ent = s.store.entitlements[`${session.email}::${session.product}`];
    setView({ kind: "status", email: session.email, status: accessStatus(session.email, session.product), until: ent?.periodEnd ?? null });
  }, []);

  if (view.kind === "none") return null;
  if (view.kind === "unknown")
    return <p className="rounded-md bg-[var(--paper-2)] p-3 text-[14px]">Ingen kassasession hittades. Om du betalade i en annan webbläsare syns köpet där (demoläge).</p>;
  const ok = view.status === "active";
  return (
    <div role="status" className={`rounded-md p-4 text-[14.5px] ${ok ? "bg-[#ecfdf3] text-[#14532d]" : "bg-[#fff7ed] text-[#7c2d12]"}`}>
      {ok ? (
        <>
          <strong>Betalningen är bekräftad.</strong> Åtkomst för {view.email} gäller till {view.until?.slice(0, 10) ?? "–"}.
        </>
      ) : view.status === "pending" ? (
        <>
          <strong>Ingen bekräftad betalning ännu.</strong> Kassan öppnades men betalningen är inte bekräftad – inget har debiterats.
        </>
      ) : (
        <>Status för {view.email}: {view.status}.</>
      )}{" "}
      <Link href="/demo/" className="underline">
        Se kvitto och mejl i demoinkorgen
      </Link>
      .
    </div>
  );
}
