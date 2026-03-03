import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cerebro Command Center",
  description: "Advanced analytics and automation panel for Helium10 data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-neutral-950 text-neutral-50 flex selection:bg-indigo-500/30`}>
        {/* Glow effect in background */}
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-neutral-950 to-neutral-950"></div>

        <Sidebar />
        <main className="flex-1 p-8 h-screen overflow-y-auto w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
