import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Förbundet Inv. — Logga in" },
      { name: "description", content: "Logga in eller skapa konto." },
    ],
  }),
  component: Index,
});

const signupSchema = z.object({
  email: z.string().trim().email("Ogiltig e-post").max(255),
  password: z.string().min(8, "Minst 8 tecken").max(72),
  displayName: z.string().trim().min(2, "Minst 2 tecken").max(50),
});
const loginSchema = z.object({
  email: z.string().trim().email("Ogiltig e-post").max(255),
  password: z.string().min(1, "Lösenord krävs").max(72),
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Laddar…</div>;
  }
  if (user) return <Navigate to="/home" />;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{
        background: "radial-gradient(60% 50% at 50% 0%, oklch(0.62 0.13 150 / 0.4) 0%, transparent 70%)",
      }} />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <Trophy className="h-7 w-7" />
          </div>
          <h1 className="font-display text-3xl tracking-wide">FÖRBUNDET INV.</h1>
          <p className="mt-1 text-sm text-muted-foreground">Golfsällskapets klubbhus</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Välkommen</CardTitle>
            <CardDescription>Logga in eller skapa ett konto</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Logga in</TabsTrigger>
                <TabsTrigger value="signup">Skapa konto</TabsTrigger>
              </TabsList>
              <TabsContent value="login"><LoginForm /></TabsContent>
              <TabsContent value="signup"><SignupForm /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="li-email">E-post</Label>
        <Input id="li-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="li-pw">Lösenord</Label>
        <Input id="li-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Loggar in…" : "Logga in"}</Button>
    </form>
  );
}

function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ email, password, displayName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName.trim() },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Välkommen till Förbundet Inv!");
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="su-name">Visningsnamn</Label>
        <Input id="su-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={50} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">E-post</Label>
        <Input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-pw">Lösenord</Label>
        <Input id="su-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Skapar konto…" : "Skapa konto"}</Button>
    </form>
  );
}
