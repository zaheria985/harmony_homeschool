import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/ui/Sidebar";
import Providers from "@/components/Providers";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const stored = localStorage.getItem("theme"); const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches; const dark = stored ? stored ==="dark" : prefersDark; document.documentElement.classList.toggle("dark", dark); } catch (_) {}
})();`,
          }}
        />
      </head>
      <body className="bg-grain min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] antialiased transition-colors">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto p-6 transition-colors md:p-10">
              <div className="mx-auto">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
