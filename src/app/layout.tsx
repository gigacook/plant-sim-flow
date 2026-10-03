import type { Metadata } from "next";
import "./globals.css";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "PlantFlow – fabrikssimulering",
  description: "Simulera, analysera och optimera materialflöden genom fabrikslinjer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
