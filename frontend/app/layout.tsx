import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "AI/ML Public Health Surveillance Assistant",
  description: "Research-grade syndromic surveillance, anomaly detection, and public health knowledge retrieval."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Sidebar />
        <main className="min-h-screen lg:pl-72">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
