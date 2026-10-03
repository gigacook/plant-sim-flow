import Link from "next/link";
import { isMock } from "@/lib/brand";

/** Shown on every purchase-related page while billing runs in mock mode. */
export default function MockBanner() {
  if (!isMock) return null;
  return (
    <div role="note" className="mb-6 rounded-md border-2 border-[#1d4ed8] bg-[#eef4ff] p-3 text-[14px] text-[#1e3a8a]">
      <strong>Demoläge:</strong> betalning, kvitton och e-post är simulerade. Inga pengar dras och inga mejl skickas.{" "}
      <Link href="/demo/" className="underline">
        Se vad som händer bakom kulisserna
      </Link>
      .
    </div>
  );
}
