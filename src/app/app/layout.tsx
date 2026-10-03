import type { Metadata } from "next";
import Shell from "@/components/Shell";

export const metadata: Metadata = { title: "Simulator" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-theme">
      <Shell>{children}</Shell>
    </div>
  );
}
