"use client";
// MOCK hosted checkout. In live mode the buyer is sent to the provider's own checkout instead,
// and this page is never used. No card data is collected here – the "test cards" are just buttons.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MockBanner from "./MockBanner";
import { BRAND, isMock } from "@/lib/brand";
import { abandon, createCheckoutSession, pay, PRODUCTS, type MockSession, type ProductKey } from "@/lib/billing/mock";

export default function MockCheckout() {
  const router = useRouter();
  const [product, setProduct] = useState<ProductKey>("teacher-kit");
  const [email, setEmail] = useState("");
  const [session, setSession] = useState<MockSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = new URL(window.location.href).searchParams.get("produkt");
    if (p && p in PRODUCTS) setProduct(p as ProductKey);
  }, []);

  if (!isMock) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <p>Kassan finns hos betalningsleverantören.</p>
        <Link href="/larare/" className="s-btn mt-4">
          Till lärarpaketet
        </Link>
      </div>
    );
  }

  const p = PRODUCTS[product];
  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSession(await createCheckoutSession(product, email));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const payWith = async (card: "success" | "decline") => {
    if (!session) return;
    setBusy(true);
    const s = await pay(session.id, card);
    setSession(s);
    setBusy(false);
    if (s.status === "complete") router.push(`/tack/?session=${encodeURIComponent(s.id)}`);
  };
  const cancel = () => {
    if (session) abandon(session.id);
    router.push("/larare/?avbrutet=1");
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <MockBanner />
      <div className="s-card p-6">
        <div className="s-label">Kassa · {BRAND.paymentProvider} (simulerad)</div>
        <h1 className="mt-2 text-[24px] font-semibold">{p.name}</h1>
        <div className="mt-1 text-[15px] text-[var(--ink-s2)]">
          {p.priceSek} kr inkl. moms · engångsköp · {p.months} månaders uppdateringar
        </div>

        {!session ? (
          <form onSubmit={start} className="mt-6 space-y-3">
            <label className="block">
              <span className="mb-1 block text-[13.5px] font-medium">E-postadress (kvitto och nedladdning skickas hit)</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-[var(--rule)] bg-white px-3 py-2 text-[15px]"
                placeholder="namn@skola.se"
                aria-invalid={!!error}
                aria-describedby={error ? "checkout-error" : undefined}
              />
            </label>
            {error && (
              <p id="checkout-error" role="alert" className="text-[14px] text-[#b91c1c]">
                {error}
              </p>
            )}
            <button type="submit" className="s-btn s-btn-primary w-full justify-center" disabled={busy}>
              {busy ? "Skapar kassa…" : "Fortsätt till betalning"}
            </button>
          </form>
        ) : session.status === "open" ? (
          <div className="mt-6 space-y-3">
            <div className="text-[14px] text-[var(--ink-s2)]">
              Köpare: <strong className="text-[var(--ink-s)]">{session.email}</strong>
            </div>
            {session.lastError && (
              <p role="alert" className="rounded-md bg-[#fef2f2] p-3 text-[14px] text-[#b91c1c]">
                {session.lastError}
              </p>
            )}
            <div className="text-[13.5px] font-medium">Välj ett testkort:</div>
            <button className="s-btn s-btn-primary w-full justify-center" disabled={busy} onClick={() => payWith("success")}>
              Testkort 4242 – betalningen lyckas
            </button>
            <button className="s-btn w-full justify-center" disabled={busy} onClick={() => payWith("decline")}>
              Testkort 0002 – kortet nekas
            </button>
            <button className="w-full py-2 text-[14px] text-[var(--ink-s2)] underline" onClick={cancel}>
              Avbryt köpet
            </button>
          </div>
        ) : (
          <p className="mt-6 text-[14px]">Kassasessionen är avslutad.</p>
        )}
      </div>
      <p className="mt-4 text-[12.5px] text-[var(--muted-s)]">
        I skarpt läge sker betalningen i betalningsleverantörens egen kassa; kortuppgifter når aldrig {BRAND.name}.
      </p>
    </div>
  );
}
