import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarDays, MapPin, MessagesSquare, ArrowRight } from "lucide-react";

type Event = { id: string; title: string; start_at: string; end_at: string | null; location: string | null };
type Message = { id: string; user_id: string; content: string; created_at: string };
type Profile = { id: string; display_name: string; avatar_url: string | null };

function formatRange(start: string, end: string | null) {
  const s = new Date(start);
  const sStr = s.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
  if (!end) return sStr;
  const e = new Date(end);
  if (s.toDateString() === e.toDateString()) return sStr;
  const eStr = e.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
  return `${sStr} – ${eStr}`;
}

export function HomeView() {
  const [events, setEvents] = useState<Event[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  useEffect(() => {
    (async () => {
      const [ev, ms, pf] = await Promise.all([
        supabase
          .from("events")
          .select("id, title, start_at, end_at, location")
          .gte("start_at", new Date(Date.now() - 86400000).toISOString())
          .order("start_at", { ascending: true })
          .limit(5),
        supabase
          .from("messages")
          .select("id, user_id, content, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("profiles").select("id, display_name, avatar_url"),
      ]);
      if (ev.data) setEvents(ev.data as Event[]);
      if (ms.data) setMessages(ms.data as Message[]);
      if (pf.data) setProfiles(Object.fromEntries((pf.data as Profile[]).map((x) => [x.id, x])));
    })();

    const ch = supabase
      .channel("home-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        supabase
          .from("messages")
          .select("id, user_id, content, created_at")
          .order("created_at", { ascending: false })
          .limit(5)
          .then(({ data }) => data && setMessages(data as Message[]));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        supabase
          .from("events")
          .select("id, title, start_at, end_at, location")
          .gte("start_at", new Date(Date.now() - 86400000).toISOString())
          .order("start_at", { ascending: true })
          .limit(5)
          .then(({ data }) => data && setEvents(data as Event[]));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-wide">HEM</h1>
        <p className="text-sm text-muted-foreground">Översikt över klubbens senaste aktivitet</p>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg tracking-wide">KOMMANDE EVENT</h2>
          </div>
          <Link to="/calendar" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            Visa alla <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            Inga kommande event. <Link to="/calendar" className="text-primary underline">Skapa ett</Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {events.map((e) => (
              <Link
                key={e.id}
                to="/event/$eventId"
                params={{ eventId: e.id }}
                className="group rounded-lg border border-border bg-card p-4 transition hover:border-primary/60 hover:bg-card/80"
              >
                <div className="text-xs uppercase tracking-wider text-primary">{formatRange(e.start_at, e.end_at)}</div>
                <h3 className="mt-1 font-display text-base tracking-wide group-hover:text-primary">{e.title}</h3>
                {e.location && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {e.location}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg tracking-wide">SENASTE MEDDELANDEN</h2>
          </div>
          <Link to="/chat" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            Öppna chatten <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            Inga meddelanden än
          </div>
        ) : (
          <Link to="/chat" className="block divide-y divide-border rounded-lg border border-border bg-card">
            {messages.map((m) => {
              const author = profiles[m.user_id];
              return (
                <div key={m.id} className="flex items-start gap-3 p-3 transition hover:bg-secondary/40">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={author?.avatar_url ?? undefined} />
                    <AvatarFallback>{(author?.display_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{author?.display_name ?? "Okänd"}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleString("sv-SE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{m.content}</p>
                  </div>
                </div>
              );
            })}
          </Link>
        )}
      </section>
    </div>
  );
}
