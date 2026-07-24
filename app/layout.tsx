import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import ParentShell from "@/components/ui/ParentShell";
import KidShell from "@/components/ui/KidShell";
import { getCurrentUser } from "@/lib/session";
import { getChildRoster } from "@/lib/queries/students";
import { kidColorFor } from "@/lib/utils/kid-colors";

export const metadata: Metadata = {
  title: "Harmony - Homeschool Tracker",
  description: "Track and manage your homeschool activities",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#3d6641",
};

/** Kid sessions get their own chrome; everyone else gets the parent shell. */
async function resolveKidChrome() {
  const user = await getCurrentUser();
  if (user.role !== "kid" || !user.childId) return null;

  try {
    const roster = await getChildRoster();
    const index = roster.findIndex((child) => child.id === user.childId);
    if (index === -1) return null;
    return { name: roster[index].name, color: kidColorFor(index) };
  } catch {
    // A database hiccup should not lock a kid out of the page entirely.
    return { name: user.name || "friend", color: kidColorFor(0) };
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const kid = await resolveKidChrome();

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
          {kid ? (
            <KidShell name={kid.name} color={kid.color}>
              {children}
            </KidShell>
          ) : (
            <ParentShell>{children}</ParentShell>
          )}
        </Providers>
      </body>
    </html>
  );
}
