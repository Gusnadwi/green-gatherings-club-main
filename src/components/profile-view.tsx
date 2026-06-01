import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

export function ProfileView() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [handicap, setHandicap] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setDisplayName(data.display_name ?? "");
        setAvatarUrl(data.avatar_url ?? "");
        setHandicap(data.handicap?.toString() ?? "");
      }
      setLoading(false);
    });
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (displayName.trim().length < 2) return toast.error("Ange ett namn");
    setBusy(true);
    const hcp = handicap.trim() === "" ? null : Number(handicap);
    if (hcp !== null && (Number.isNaN(hcp) || hcp < -10 || hcp > 54)) {
      setBusy(false);
      return toast.error("Handicap måste vara mellan -10 och 54");
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        avatar_url: avatarUrl.trim() || null,
        handicap: hcp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profil sparad");
  }

  if (loading) return <p className="text-muted-foreground">Laddar…</p>;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="font-display text-2xl tracking-wide">PROFIL</h1>

      <div className="rounded-lg border border-border bg-card p-6">
        <form onSubmit={save} className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-xl">{(displayName || "?").slice(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="pf-avatar">Avatar URL</Label>
              <Input id="pf-avatar" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-name">Visningsnamn</Label>
            <Input id="pf-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-hcp">Handicap</Label>
            <Input id="pf-hcp" type="number" step="0.1" value={handicap} onChange={(e) => setHandicap(e.target.value)} placeholder="t.ex. 18.4" />
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button type="submit" disabled={busy}>{busy ? "Sparar…" : "Spara"}</Button>
            <Button type="button" variant="outline" onClick={() => supabase.auth.signOut()}>
              <LogOut className="mr-1 h-4 w-4" /> Logga ut
            </Button>
          </div>
        </form>
      </div>

      <p className="text-center text-xs text-muted-foreground">{user?.email}</p>
    </div>
  );
}
