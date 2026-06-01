# Förbundet Inv. deployment

## Public hosting

The app is a TanStack Start app and builds through Vite/Nitro. A production host must expose these environment variables:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Use the `VITE_` variables in the browser client and the non-public `SUPABASE_SERVICE_ROLE_KEY` only on the server. Never expose the service role key in client code.

## Database

Apply the SQL files in `supabase/migrations` to the Supabase project. They create:

- `profiles` for member profiles
- `messages`, `message_likes`, `polls`, `poll_options`, `poll_votes` for chat and polls
- `events`, `event_attendees` for calendar and signup
- realtime publication entries for chat, polls and events
- row level security policies so signed-in members can read shared club data and only write their own rows

## API routes

Server JSON routes are available under `/api/*`.

- `GET /api/health` checks that the app server is responding
- `GET /api/bootstrap` returns the signed-in user's profile, events, attendees, recent messages and profiles
- `GET /api/events` lists events
- `POST /api/events` creates an event for the signed-in user
- `GET /api/messages` lists recent chat messages
- `POST /api/messages` creates a chat message for the signed-in user

All routes except `/api/health` require `Authorization: Bearer <supabase-access-token>`.

## iPhone shortcut / PWA

The app includes `public/manifest.webmanifest`, `public/sw.js`, an app icon and Apple mobile web app metadata. On iPhone, open the public URL in Safari and choose Share -> Add to Home Screen.
