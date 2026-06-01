import { useAuth } from "@/hooks/use-auth";
import { Navigate } from "@tanstack/react-router";
import { AppShell } from "./app-shell";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Laddar…
      </div>
    );
  }
  if (!user) return <Navigate to="/" />;
  return <AppShell>{children}</AppShell>;
}
