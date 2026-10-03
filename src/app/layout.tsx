import type { Metadata } from "next";
import "./globals.css";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: `${BRAND.name} – ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: "Visa flaskhalsar, buffertar och köer i produktionsflöden – en gratis simulator i webbläsaren med färdiga övningar för undervisning.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
