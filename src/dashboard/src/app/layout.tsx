import "~/styles/globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "~/lib/auth-context";
import { Toaster } from "~/components/ui/sonner";
import { NavigationBar } from "~/components/navigation-bar";

export const metadata: Metadata = {
  title: "Meeting Assistant Dashboard",
  description: "Schedule, monitor, and review meeting bot recordings",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
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
