import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, MapPin, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Event = { id: string; title: string; description: string | null; location: string | null; start_at: string; end_at: string | null; created_by: string };
type Attendee = { event_id: string; user_id: string; status: string };
type Profile = { id: string; display_name: string; avatar_url: string | null };

const MONTHS = ["Januari","Februari","Mars","April","Maj","Juni","Juli","Augusti","September","Oktober","November","December"];
const WEEKDAYS = ["Mån","Tis","Ons","Tor","Fre","Lör","Sön"];

function dateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function formatDateRange(start: string, end: string | null) {
  const s = new Date(start);
  const sStr = s.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
  const sTime = s.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  if (!end || dateOnly(new Date(end)).getTime() === dateOnly(s).getTime()) {
    return `${sStr} · ${sTime}`;
  }
  const e = new Date(end);
  const eStr = e.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
  return `${sStr} – ${eStr}`;
}

export function CalendarView() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    (async () => {
      const [e, a, p] = await Promise.all([
        supabase.from("events").select("*").order("start_at"),
        supabase.from("event_attendees").select("*"),
        supabase.from("profiles").select("id, display_name, avatar_url"),
      ]);
      if (e.data) setEvents(e.data as Event[]);
      if (a.data) setAttendees(a.data as Attendee[]);
      if (p.data) setProfiles(Object.fromEntries((p.data as Profile[]).map((x) => [x.id, x])));
    })();
    const ch = supabase
      .channel("cal-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, (p) => {
        if (p.eventType === "INSERT") setEvents((v) => [...v, p.new as Event]);
        if (p.eventType === "UPDATE") setEvents((v) => v.map((x) => (x.id === (p.new as Event).id ? p.new as Event : x)));
        if (p.eventType === "DELETE") setEvents((v) => v.filter((x) => x.id !== (p.old as Event).id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_attendees" }, (p) => {
        if (p.eventType === "INSERT") setAttendees((v) => [...v, p.new as Attendee]);
        if (p.eventType === "DELETE") {
          const o = p.old as Attendee;
          setAttendees((v) => v.filter((x) => !(x.event_id === o.event_id && x.user_id === o.user_id)));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const monthGrid = useMemo(() => {
    const first = new Date(cursor);
    const startWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, Event[]> = {};
    for (const e of events) {
      const start = dateOnly(new Date(e.start_at));
      const end = dateOnly(new Date(e.end_at ?? e.start_at));
      const d = new Date(start);
      while (d <= end) {
        const k = d.toDateString();
        (map[k] ||= []).push(e);
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [events]);

  const upcoming = useMemo(
    () => events
      .filter((e) => new Date(e.end_at ?? e.start_at) >= new Date(Date.now() - 86400000))
      .slice(0, 10),
    [events],
  );

  async function toggleAttend(eventId: string) {
    if (!user) return;
    const mine = attendees.find((a) => a.event_id === eventId && a.user_id === user.id);
    if (mine) {
      await supabase.from("event_attendees").delete().eq("event_id", eventId).eq("user_id", user.id);
    } else {
      await supabase.from("event_attendees").insert({ event_id: eventId, user_id: user.id, status: "going" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl tracking-wide">KALENDER</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setSelectedDate(null)}>
              <Plus className="mr-1 h-4 w-4" /> Nytt event
            </Button>
          </DialogTrigger>
          <EventDialog
            userId={user?.id ?? ""}
            initialDate={selectedDate}
            onSaved={() => setOpen(false)}
          />
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card/40 p-4">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-md p-2 hover:bg-secondary">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="font-display text-lg tracking-wide">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-md p-2 hover:bg-secondary">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-2 grid grid-cols-7 text-center text-xs uppercase tracking-wider text-muted-foreground">
          {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthGrid.map((d, i) => {
            const today = d && d.toDateString() === new Date().toDateString();
            const list = d ? eventsByDay[d.toDateString()] ?? [] : [];
            return (
              <button
                key={i}
                disabled={!d}
                onClick={() => { if (d) { setSelectedDate(d); setOpen(true); } }}
                className={cn(
                  "min-h-[64px] rounded-md border border-transparent p-1.5 text-left text-xs transition",
                  d && "hover:border-border hover:bg-secondary/50",
                  today && "border-primary/60 bg-primary/10",
                  !d && "opacity-0",
                )}
              >
                {d && <div className={cn("mb-1 font-medium", today && "text-primary")}>{d.getDate()}</div>}
                <div className="space-y-0.5">
                  {list.slice(0, 2).map((e) => (
                    <div key={e.id} className="truncate rounded bg-primary/80 px-1 py-0.5 text-[10px] text-primary-foreground">
                      {e.title}
                    </div>
                  ))}
                  {list.length > 2 && <div className="text-[10px] text-muted-foreground">+{list.length - 2} mer</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg tracking-wide">KOMMANDE</h2>
        {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Inga kommande events. Skapa ett!</p>}
        <div className="space-y-3">
          {upcoming.map((e) => {
            const list = attendees.filter((a) => a.event_id === e.id);
            const going = !!list.find((a) => a.user_id === user?.id);
            return (
              <div key={e.id} className="rounded-lg border border-border bg-card p-4 transition hover:border-primary/60">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to="/event/$eventId"
                    params={{ eventId: e.id }}
                    className="flex-1"
                  >
                    <div className="text-xs uppercase tracking-wider text-primary">
                      {formatDateRange(e.start_at, e.end_at)}
                    </div>
                    <h3 className="mt-1 font-display text-base tracking-wide hover:text-primary">{e.title}</h3>
                    {e.location && (
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> {e.location}
                      </p>
                    )}
                    {e.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>}
                    {list.length > 0 && (
                      <div className="mt-3 flex -space-x-2">
                        {list.slice(0, 6).map((a) => {
                          const p = profiles[a.user_id];
                          return (
                            <Avatar key={a.user_id} className="h-7 w-7 border-2 border-card">
                              <AvatarImage src={p?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[10px]">{(p?.display_name ?? "?").slice(0,2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                          );
                        })}
                        {list.length > 6 && <div className="flex h-7 items-center pl-3 text-xs text-muted-foreground">+{list.length - 6}</div>}
                      </div>
                    )}
                  </Link>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant={going ? "default" : "outline"} onClick={() => toggleAttend(e.id)}>
                      <Check className="mr-1 h-3.5 w-3.5" /> {going ? "Anmäld" : "Anmäl"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function EventDialog({ userId, initialDate, onSaved }: { userId: string; initialDate: Date | null; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(() => (initialDate ?? new Date()).toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(() => (initialDate ?? new Date()).toISOString().slice(0, 10));
  const [endTime, setEndTime] = useState("17:00");
  const [multiDay, setMultiDay] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialDate) {
      const iso = initialDate.toISOString().slice(0, 10);
      setStartDate(iso);
      setEndDate(iso);
    }
  }, [initialDate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) return toast.error("Ange en titel");
    const start = new Date(`${startDate}T${startTime}:00`);
    const end = multiDay ? new Date(`${endDate}T${endTime}:00`) : null;
    if (end && end < start) return toast.error("Slutdatum måste vara efter startdatum");

    setBusy(true);
    const { data: ev, error } = await supabase
      .from("events")
      .insert({
        title: title.trim(),
        location: location.trim() || null,
        description: description.trim() || null,
        start_at: start.toISOString(),
        end_at: end?.toISOString() ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (!error && ev) {
      await supabase.from("event_attendees").insert({ event_id: ev.id, user_id: userId, status: "going" });
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Event skapat");
    setTitle(""); setLocation(""); setDescription(""); setMultiDay(false);
    onSaved();
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Nytt event</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="ev-title">Titel</Label>
          <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ev-date">Startdatum</Label>
            <Input id="ev-date" type="date" value={startDate} onChange={(e) => {
              setStartDate(e.target.value);
              if (!multiDay || endDate < e.target.value) setEndDate(e.target.value);
            }} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-time">Starttid</Label>
            <Input id="ev-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={multiDay} onChange={(e) => {
            setMultiDay(e.target.checked);
            if (e.target.checked && endDate < startDate) setEndDate(startDate);
          }} className="h-4 w-4 accent-primary" />
          Flera dagar (t.ex. tor–sön)
        </label>

        {multiDay && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-edate">Slutdatum</Label>
              <Input id="ev-edate" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-etime">Sluttid</Label>
              <Input id="ev-etime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="ev-loc">Plats / Bana</Label>
          <Input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-desc">Beskrivning</Label>
          <Textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy}>{busy ? "Sparar…" : "Skapa event"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
