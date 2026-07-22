"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "~/lib/auth-context";
import { createClient } from "~/lib/supabase/client";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Video, Calendar, Bot, FileText, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "~/lib/utils";

const navItems = [
  { href: "/", label: "New Meeting", icon: Video },
  { href: "/active", label: "Active Bots", icon: Bot },
  { href: "/recordings", label: "Recordings", icon: Calendar },
  { href: "/transcripts", label: "Transcripts", icon: FileText },
];

export function NavigationBar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();

  if (loading) {
    return (
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-14 items-center px-4">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
      </header>
    );
  }

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  if (isAuthPage || !user) return null;

  const initials = user.email?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Video className="size-5 text-primary" />
            <span className="text-sm font-semibold">Meeting Assistant</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full outline-none">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user.email}</p>
              </div>
              <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="border-t md:hidden">
          <div className="container mx-auto flex flex-col px-4 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
