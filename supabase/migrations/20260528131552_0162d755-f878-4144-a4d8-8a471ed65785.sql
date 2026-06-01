
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  handicap NUMERIC(4,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Invite codes
CREATE TABLE public.invite_codes (
  code TEXT PRIMARY KEY,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invite_codes TO anon, authenticated;
GRANT UPDATE ON public.invite_codes TO authenticated;
GRANT ALL ON public.invite_codes TO service_role;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invite_codes public select" ON public.invite_codes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "invite_codes claim" ON public.invite_codes FOR UPDATE TO authenticated USING (used_by IS NULL) WITH CHECK (used_by = auth.uid());

-- Seed initial invite codes
INSERT INTO public.invite_codes(code) VALUES ('FORBUNDET2026'), ('GOLFCLUB'), ('FAIRWAY99');

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages select" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "messages insert own" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "messages delete own" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Message likes
CREATE TABLE public.message_likes (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.message_likes TO authenticated;
GRANT ALL ON public.message_likes TO service_role;
ALTER TABLE public.message_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes select" ON public.message_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes insert own" ON public.message_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes delete own" ON public.message_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Polls
CREATE TABLE public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID UNIQUE NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.polls TO authenticated;
GRANT ALL ON public.polls TO service_role;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "polls select" ON public.polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "polls insert own" ON public.polls FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "polls delete own" ON public.polls FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Poll options
CREATE TABLE public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT ON public.poll_options TO authenticated;
GRANT ALL ON public.poll_options TO service_role;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_options select" ON public.poll_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_options insert" ON public.poll_options FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.created_by = auth.uid()));

-- Poll votes
CREATE TABLE public.poll_votes (
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes select" ON public.poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "votes insert own" ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes update own" ON public.poll_votes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "votes delete own" ON public.poll_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events select" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events insert own" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "events update own" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "events delete own" ON public.events FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Event attendees
CREATE TABLE public.event_attendees (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_attendees TO authenticated;
GRANT ALL ON public.event_attendees TO service_role;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendees select" ON public.event_attendees FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendees insert own" ON public.event_attendees FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "attendees update own" ON public.event_attendees FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "attendees delete own" ON public.event_attendees FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_attendees;

-- Profile autocreate trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
