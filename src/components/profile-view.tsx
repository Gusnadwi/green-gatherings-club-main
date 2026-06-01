import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Bell, BellOff, Camera, LogOut, Upload } from "lucide-react";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushSubscription,
  supportsPushNotifications,
} from "@/lib/push-notifications";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ProfileView() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [handicap, setHandicap] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
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

  useEffect(() => {
    getPushSubscription().then((subscription) => setPushEnabled(Boolean(subscription)));
  }, []);

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

  async function uploadAvatar(file: File) {
    if (!user) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Välj en bild i JPG, PNG eller WebP");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("Bilden får vara max 5 MB");
      return;
    }

    setUploadingAvatar(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      setUploadingAvatar(false);
      toast.error(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const publicUrl = data.publicUrl;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setUploadingAvatar(false);
    if (profileError) return toast.error(profileError.message);
    setAvatarUrl(publicUrl);
    toast.success("Profilbild uppladdad");
  }

  async function removeAvatar() {
    if (!user) return;
    setUploadingAvatar(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setUploadingAvatar(false);
    if (error) return toast.error(error.message);
    setAvatarUrl("");
    toast.success("Profilbild borttagen");
  }

  async function togglePushNotifications() {
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await disablePushNotifications();
        setPushEnabled(false);
        toast.success("Notiser avstängda");
      } else {
        await enablePushNotifications();
        setPushEnabled(true);
        toast.success("Notiser aktiverade");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte ändra notiser");
    } finally {
      setPushBusy(false);
    }
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
              <Label htmlFor="pf-avatar">Profilbild</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="pf-avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadAvatar(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("pf-avatar")?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Upload className="mr-1 h-4 w-4 animate-pulse" />
                  ) : (
                    <Camera className="mr-1 h-4 w-4" />
                  )}
                  {uploadingAvatar ? "Laddar upp..." : "Ladda upp foto"}
                </Button>
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void removeAvatar()}
                    disabled={uploadingAvatar}
                  >
                    Ta bort
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG eller WebP. Max 5 MB.</p>
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

          <div className="rounded-lg border border-border/70 bg-background/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Label>iPhone-notiser</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Få notiser när någon skriver i chatten.
                </p>
              </div>
              <Button
                type="button"
                variant={pushEnabled ? "default" : "outline"}
                onClick={() => void togglePushNotifications()}
                disabled={pushBusy || !supportsPushNotifications()}
              >
                {pushEnabled ? (
                  <BellOff className="mr-1 h-4 w-4" />
                ) : (
                  <Bell className="mr-1 h-4 w-4" />
                )}
                {pushBusy ? "Uppdaterar..." : pushEnabled ? "Stäng av" : "Aktivera"}
              </Button>
            </div>
            {!supportsPushNotifications() && (
              <p className="mt-3 text-xs text-muted-foreground">
                Notiser kräver att appen öppnas från hemskärmen och att VAPID-nycklar finns i Vercel.
              </p>
            )}
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
