import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessagesSquare, CalendarDays, User as UserIcon, LogOut, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const links = [
  { to: "/home", label: "Hem", icon: Home },
  { to: "/chat", label: "Chatt", icon: MessagesSquare },
  { to: "/calendar", label: "Kalender", icon: CalendarDays },
  { to: "/profile", label: "Profil", icon: UserIcon },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link to="/home" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-base tracking-wide">FÖRBUNDET INV.</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Golfsällskapet</div>
            </div>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {links.map((l) => {
              const active = pathname === l.to || (l.to !== "/home" && pathname.startsWith(l.to));
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <l.icon className="h-4 w-4" />
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <button
            onClick={() => supabase.auth.signOut()}
            className="hidden items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground md:flex"
            aria-label="Logga ut"
          >
            <LogOut className="h-4 w-4" />
            Logga ut
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 md:pb-6">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-stretch justify-around">
          {links.map((l) => {
            const active = pathname === l.to || (l.to !== "/home" && pathname.startsWith(l.to));
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <l.icon className="h-5 w-5" />
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
