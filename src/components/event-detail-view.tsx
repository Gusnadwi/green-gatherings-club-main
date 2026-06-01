import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, CalendarDays, MapPin, Check, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

type Event = {
  id: string; title: string; description: string | null; location: string | null;
  start_at: string; end_at: string | null; created_by: string;
};
type Attendee = { event_id: string; user_id: string; status: string };
type Profile = { id: string; display_name: string; avatar_url: string | null; handicap: number | null };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("sv-SE", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}

export function EventDetailView({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [ev, at, pf] = await Promise.all([
        supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
        supabase.from("event_attendees").select("*").eq("event_id", eventId),
        supabase.from("profiles").select("id, display_name, avatar_url, handicap"),
      ]);
      setEvent((ev.data as Event) ?? null);
      setAttendees((at.data as Attendee[]) ?? []);
      if (pf.data) setProfiles(Object.fromEntries((pf.data as Profile[]).map((x) => [x.id, x])));
      setLoading(false);
    })();

    const ch = supabase
      .channel(`event-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_attendees", filter: `event_id=eq.${eventId}` }, (p) => {
        if (p.eventType === "INSERT") setAttendees((v) => [...v, p.new as Attendee]);
        if (p.eventType === "DELETE") {
          const o = p.old as Attendee;
          setAttendees((v) => v.filter((x) => !(x.event_id === o.event_id && x.user_id === o.user_id)));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `id=eq.${eventId}` }, (p) => {
        if (p.eventType === "UPDATE") setEvent(p.new as Event);
        if (p.eventType === "DELETE") setEvent(null);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId]);

  async function toggleAttend() {
    if (!user || !event) return;
    const mine = attendees.find((a) => a.user_id === user.id);
    if (mine) {
      await supabase.from("event_attendees").delete().eq("event_id", event.id).eq("user_id", user.id);
    } else {
      await supabase.from("event_attendees").insert({ event_id: event.id, user_id: user.id, status: "going" });
    }
  }

  async function deleteEvent() {
    if (!event) return;
    if (!confirm("Ta bort eventet?")) return;
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) return toast.error(error.message);
    toast.success("Eventet är borttaget");
    navigate({ to: "/calendar" });
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Laddar event…</p>;
  }
  if (!event) {
    return (
      <div className="space-y-4">
        <Link to="/calendar" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Tillbaka
        </Link>
        <p className="text-sm text-muted-foreground">Eventet hittades inte.</p>
      </div>
    );
  }

  const going = !!attendees.find((a) => a.user_id === user?.id);
  const isMine = event.created_by === user?.id;
  const multiDay = event.end_at && new Date(event.end_at).toDateString() !== new Date(event.start_at).toDateString();

  return (
    <div className="space-y-6">
      <Link to="/calendar" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Tillbaka till kalendern
      </Link>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs uppercase tracking-wider text-primary">
              <CalendarDays className="h-3.5 w-3.5" />
              {multiDay ? "Flera dagar" : "Event"}
            </div>
            <h1 className="font-display text-3xl tracking-wide">{event.title}</h1>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div><span className="text-foreground">Start:</span> {formatDateTime(event.start_at)}</div>
              {event.end_at && (
                <div><span className="text-foreground">Slut:</span> {formatDateTime(event.end_at)}</div>
              )}
              {event.location && (
                <div className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {event.location}</div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={toggleAttend} variant={going ? "default" : "outline"}>
              <Check className="mr-1 h-4 w-4" /> {going ? "Anmäld" : "Anmäl mig"}
            </Button>
            {isMine && (
              <Button onClick={deleteEvent} variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="mr-1 h-4 w-4" /> Ta bort
              </Button>
            )}
          </div>
        </div>

        {event.description && (
          <div className="mt-6 border-t border-border pt-4">
            <h2 className="mb-2 font-display text-sm uppercase tracking-wider text-muted-foreground">Information</h2>
            <p className="whitespace-pre-wrap text-sm">{event.description}</p>
          </div>
        )}
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg tracking-wide">DELTAGARE ({attendees.length})</h2>
        </div>
        {attendees.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            Ingen är anmäld än — bli först!
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {attendees.map((a) => {
              const p = profiles[a.user_id];
              return (
                <li key={a.user_id} className="flex items-center gap-3 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={p?.avatar_url ?? undefined} />
                    <AvatarFallback>{(p?.display_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{p?.display_name ?? "Okänd"}</div>
                    {p?.handicap !== null && p?.handicap !== undefined && (
                      <div className="text-xs text-muted-foreground">HCP {p.handicap}</div>
                    )}
                  </div>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                    {a.status === "going" ? "Anmäld" : a.status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
