import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { AuthProvider } from "~/lib/auth-context";
import { Toaster } from "~/components/ui/sonner";
import { NavigationBar } from "~/components/navigation-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meeting Assistant Dashboard",
  description: "Schedule, monitor, and review meeting bot recordings",
  icons: [{ rel: "icon", url: "/logo.svg" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body className="antialiased">
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <NavigationBar />
            <main className="container mx-auto flex-1 px-4 py-6">
              {children}
            </main>
          </div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
