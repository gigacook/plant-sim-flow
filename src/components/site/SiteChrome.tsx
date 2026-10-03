import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${BRAND.name} – startsida`}>
      <span className="grid h-8 w-8 place-items-center rounded-[6px] bg-[var(--ink-s)] text-[15px] font-bold text-[var(--paper)]">
        {BRAND.name[0]}
      </span>
      <span className="text-[17px] font-semibold tracking-tight">{BRAND.name}</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--rule)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <Logo />
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]" aria-label="Huvudmeny">
          <Link href="/ovningar/" className="text-[var(--ink-s2)] hover:text-[var(--ink-s)]">
            Övningar
          </Link>
          <Link href="/larare/" className="text-[var(--ink-s2)] hover:text-[var(--ink-s)]">
            För lärare
          </Link>
          <Link href="/app/" className="s-btn s-btn-primary px-3.5 py-1.5 text-[13.5px]">
            Öppna simulatorn
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--rule)] bg-[var(--paper-2)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-[13.5px] text-[var(--ink-s2)] sm:px-6 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs">{BRAND.founderBio || `${BRAND.name} är ett fristående projekt för undervisning i produktionsflöden.`}</p>
        </div>
        <div>
          <div className="s-label mb-2">Kontakt</div>
          {BRAND.contactEmail ? (
            <a className="underline" href={`mailto:${BRAND.contactEmail}`}>
              {BRAND.contactEmail}
            </a>
          ) : (
            <p>Kontaktadress publiceras inför pilotstarten.</p>
          )}
          
        </div>
        <div>
          <div className="s-label mb-2">Information</div>
          <ul className="space-y-1.5">
            <li>
              <Link className="underline" href="/larare/">
                Lärarpaket och pris
              </Link>
            </li>
            <li>
              <Link className="underline" href="/integritet/">
                Integritet
              </Link>
            </li>
            <li>
              <Link className="underline" href="/villkor/">
                Köpvillkor
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-8 text-[12px] text-[var(--muted-s)] sm:px-6">
        {BRAND.name} är ett fristående undervisningsverktyg och är inte anslutet till Siemens, Bentley, Autodesk eller andra leverantörer av simuleringsprogramvara.
      </div>
    </footer>
  );
}

export function DraftBanner() {
  if (BRAND.policiesApproved) return null;
  return (
    <div role="note" className="mb-6 rounded-md border-2 border-dashed border-[var(--signal)] bg-[#fff4ec] p-4 text-[14px] text-[var(--signal-ink)]">
      <strong>UTKAST – gäller inte ännu.</strong> Texten är ett arbetsutkast som ska granskas innan försäljning startar. Uppgifter inom [hakparenteser] saknas.
    </div>
  );
}
