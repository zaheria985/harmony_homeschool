import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/ui/Sidebar";

export const metadata: Metadata = {
  title: "Harmony - Homeschool Tracker",
  description: "Track and manage your homeschool activities",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6 md:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
