import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Plus, Send, Trash2, BarChart3, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { notifyNewMessage } from "@/lib/push-notifications";

type Profile = { id: string; display_name: string; avatar_url: string | null; handicap: number | null };
type Message = { id: string; user_id: string; content: string; created_at: string };
type Like = { message_id: string; user_id: string };
type Poll = { id: string; message_id: string; question: string };
type PollOption = { id: string; poll_id: string; text: string; position: number };
type Vote = { poll_id: string; user_id: string; option_id: string };

export function ChatView() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [likes, setLikes] = useState<Like[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollOptions, setPollOptions] = useState<PollOption[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [text, setText] = useState("");
  const [showPoll, setShowPoll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // initial load
  useEffect(() => {
    (async () => {
      const [m, p, l, po, opt, v] = await Promise.all([
        supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(500),
        supabase.from("profiles").select("*"),
        supabase.from("message_likes").select("*"),
        supabase.from("polls").select("*"),
        supabase.from("poll_options").select("*").order("position"),
        supabase.from("poll_votes").select("*"),
      ]);
      if (m.data) setMessages(m.data as Message[]);
      if (p.data) setProfiles(Object.fromEntries((p.data as Profile[]).map((x) => [x.id, x])));
      if (l.data) setLikes(l.data as Like[]);
      if (po.data) setPolls(po.data as Poll[]);
      if (opt.data) setPollOptions(opt.data as PollOption[]);
      if (v.data) setVotes(v.data as Vote[]);
    })();
  }, []);

  // realtime
  useEffect(() => {
    const ch = supabase
      .channel("chat-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => {
        if (p.eventType === "INSERT") setMessages((m) => [...m, p.new as Message]);
        if (p.eventType === "DELETE") setMessages((m) => m.filter((x) => x.id !== (p.old as Message).id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_likes" }, (p) => {
        if (p.eventType === "INSERT") setLikes((l) => [...l, p.new as Like]);
        if (p.eventType === "DELETE") {
          const o = p.old as Like;
          setLikes((l) => l.filter((x) => !(x.message_id === o.message_id && x.user_id === o.user_id)));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, (p) => {
        if (p.eventType === "INSERT") setVotes((v) => [...v, p.new as Vote]);
        if (p.eventType === "UPDATE") {
          const n = p.new as Vote;
          setVotes((v) => v.map((x) => (x.poll_id === n.poll_id && x.user_id === n.user_id ? n : x)));
        }
        if (p.eventType === "DELETE") {
          const o = p.old as Vote;
          setVotes((v) => v.filter((x) => !(x.poll_id === o.poll_id && x.user_id === o.user_id)));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // refresh profile when new message author unknown
  useEffect(() => {
    const missing = messages.map((m) => m.user_id).filter((id) => !profiles[id]);
    if (missing.length === 0) return;
    supabase.from("profiles").select("*").in("id", missing).then(({ data }) => {
      if (data) setProfiles((p) => ({ ...p, ...Object.fromEntries((data as Profile[]).map((x) => [x.id, x])) }));
    });
  }, [messages, profiles]);

  async function sendMessage() {
    const content = text.trim();
    if (!content || !user) return;
    setText("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ user_id: user.id, content })
      .select("id")
      .single();
    if (error) toast.error(error.message);
    if (data?.id) {
      notifyNewMessage(data.id).catch((err) => console.warn("Push notification failed", err));
    }
  }

  async function toggleLike(messageId: string) {
    if (!user) return;
    const mine = likes.find((l) => l.message_id === messageId && l.user_id === user.id);
    if (mine) {
      await supabase.from("message_likes").delete().eq("message_id", messageId).eq("user_id", user.id);
    } else {
      await supabase.from("message_likes").insert({ message_id: messageId, user_id: user.id });
    }
  }

  async function deleteMessage(id: string) {
    await supabase.from("messages").delete().eq("id", id);
  }

  const pollByMsg = useMemo(() => Object.fromEntries(polls.map((p) => [p.message_id, p])), [polls]);

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col gap-3 md:h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-wide">CHATT</h1>
        <span className="text-xs text-muted-foreground">{messages.length} meddelanden</span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-border/60 bg-card/40 p-4">
        {messages.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Inga meddelanden än — säg hej!</p>
        )}
        {messages.map((m) => {
          const author = profiles[m.user_id];
          const mine = m.user_id === user?.id;
          const msgLikes = likes.filter((l) => l.message_id === m.id);
          const liked = !!msgLikes.find((l) => l.user_id === user?.id);
          const poll = pollByMsg[m.id];
          return (
            <div key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={author?.avatar_url ?? undefined} />
                <AvatarFallback>{(author?.display_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className={cn("max-w-[80%] space-y-1", mine && "items-end text-right")}>
                <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{author?.display_name ?? "Okänd"}</span>
                  <span>{new Date(m.created_at).toLocaleString("sv-SE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</span>
                </div>
                <div className={cn(
                  "inline-block rounded-2xl px-4 py-2 text-sm",
                  mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                )}>
                  {m.content}
                </div>
                {poll && (
                  <PollWidget
                    poll={poll}
                    options={pollOptions.filter((o) => o.poll_id === poll.id)}
                    votes={votes.filter((v) => v.poll_id === poll.id)}
                    userId={user!.id}
                    profiles={profiles}
                  />
                )}
                <div className={cn("flex items-center gap-2 text-xs", mine && "justify-end")}>
                  <button
                    onClick={() => toggleLike(m.id)}
                    className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 transition", liked ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}
                  >
                    <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
                    {msgLikes.length > 0 && <span>{msgLikes.length}</span>}
                  </button>
                  {mine && (
                    <button onClick={() => deleteMessage(m.id)} className="text-muted-foreground hover:text-destructive" aria-label="Ta bort">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showPoll ? (
        <PollComposer onClose={() => setShowPoll(false)} userId={user!.id} />
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="flex items-center gap-2"
        >
          <Button type="button" size="icon" variant="outline" onClick={() => setShowPoll(true)} aria-label="Skapa omröstning">
            <BarChart3 className="h-4 w-4" />
          </Button>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Skriv ett meddelande…"
            maxLength={2000}
          />
          <Button type="submit" size="icon" disabled={!text.trim()} aria-label="Skicka">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}

function PollComposer({ onClose, userId }: { onClose: () => void; userId: string }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (q.length < 3) return toast.error("Skriv en fråga");
    if (opts.length < 2) return toast.error("Minst två alternativ");
    setBusy(true);

    const { data: msg, error: mErr } = await supabase
      .from("messages")
      .insert({ user_id: userId, content: `📊 Omröstning: ${q}` })
      .select()
      .single();
    if (mErr || !msg) { setBusy(false); return toast.error(mErr?.message ?? "Fel"); }

    const { data: poll, error: pErr } = await supabase
      .from("polls")
      .insert({ message_id: msg.id, question: q, created_by: userId })
      .select()
      .single();
    if (pErr || !poll) { setBusy(false); return toast.error(pErr?.message ?? "Fel"); }

    const { error: oErr } = await supabase
      .from("poll_options")
      .insert(opts.map((text, i) => ({ poll_id: poll.id, text, position: i })));
    setBusy(false);
    if (oErr) return toast.error(oErr.message);
    onClose();
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm tracking-wide">SKAPA OMRÖSTNING</span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Fråga…" maxLength={200} />
      {options.map((o, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={o}
            onChange={(e) => setOptions((arr) => arr.map((x, idx) => (idx === i ? e.target.value : x)))}
            placeholder={`Alternativ ${i + 1}`}
            maxLength={100}
          />
          {options.length > 2 && (
            <Button type="button" variant="outline" size="icon" onClick={() => setOptions((arr) => arr.filter((_, idx) => idx !== i))}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOptions((arr) => [...arr, ""])} disabled={options.length >= 8}>
          <Plus className="mr-1 h-3 w-3" /> Alternativ
        </Button>
        <Button type="submit" size="sm" disabled={busy} className="ml-auto">
          {busy ? "Skapar…" : "Skicka omröstning"}
        </Button>
      </div>
    </form>
  );
}

function PollWidget({
  poll, options, votes, userId, profiles,
}: {
  poll: Poll;
  options: PollOption[];
  votes: Vote[];
  userId: string;
  profiles: Record<string, Profile>;
}) {
  const myVote = votes.find((v) => v.user_id === userId);
  const total = votes.length || 1;

  async function vote(optionId: string) {
    if (myVote) {
      await supabase.from("poll_votes").update({ option_id: optionId }).eq("poll_id", poll.id).eq("user_id", userId);
    } else {
      await supabase.from("poll_votes").insert({ poll_id: poll.id, option_id: optionId, user_id: userId });
    }
  }

  return (
    <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-card/60 p-3 text-left">
      <div className="font-display text-sm tracking-wide">{poll.question}</div>
      {options.map((o) => {
        const count = votes.filter((v) => v.option_id === o.id).length;
        const pct = Math.round((count / total) * 100);
        const mine = myVote?.option_id === o.id;
        return (
          <button
            key={o.id}
            onClick={() => vote(o.id)}
            className={cn(
              "relative w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition",
              mine ? "border-primary" : "border-border hover:bg-secondary",
            )}
          >
            <div className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${pct}%` }} />
            <div className="relative flex items-center justify-between gap-2">
              <span>{o.text}</span>
              <span className="text-xs text-muted-foreground">{count} • {pct}%</span>
            </div>
          </button>
        );
      })}
      <div className="text-xs text-muted-foreground">
        {votes.length} röst{votes.length === 1 ? "" : "er"}
        {votes.length > 0 && " · " + votes.map((v) => profiles[v.user_id]?.display_name).filter(Boolean).slice(0, 3).join(", ")}
        {votes.length > 3 && "…"}
      </div>
    </div>
  );
}
