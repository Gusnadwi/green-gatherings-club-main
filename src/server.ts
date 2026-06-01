import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { supabaseAdmin } from "./integrations/supabase/client.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

type ApiUser = {
  id: string;
  email?: string;
};

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init?.headers,
    },
  });
}

function readBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : null;
}

async function requireApiUser(request: Request): Promise<ApiUser | Response> {
  const token = readBearerToken(request);
  if (!token) return json({ error: "Missing bearer token" }, { status: 401 });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return json({ error: "Invalid session" }, { status: 401 });
  return { id: data.user.id, email: data.user.email ?? undefined };
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function handleApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  if (url.pathname === "/api/health" && request.method === "GET") {
    const env = typeof process !== "undefined" ? process.env : {};
    return json({
      ok: true,
      app: "forbundet-inv",
      services: {
        api: "ready",
        database: env.SUPABASE_URL ? "configured" : "missing_env",
      },
      time: new Date().toISOString(),
    });
  }

  const user = await requireApiUser(request);
  if (user instanceof Response) return user;

  if (url.pathname === "/api/bootstrap" && request.method === "GET") {
    const [profile, events, attendees, messages, profiles] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabaseAdmin.from("events").select("*").order("start_at", { ascending: true }).limit(50),
      supabaseAdmin.from("event_attendees").select("*").limit(500),
      supabaseAdmin.from("messages").select("*").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("profiles").select("id, display_name, avatar_url, handicap"),
    ]);

    const firstError = profile.error ?? events.error ?? attendees.error ?? messages.error ?? profiles.error;
    if (firstError) return json({ error: firstError.message }, { status: 500 });

    return json({
      user,
      profile: profile.data,
      events: events.data ?? [],
      attendees: attendees.data ?? [],
      messages: messages.data ?? [],
      profiles: profiles.data ?? [],
    });
  }

  if (url.pathname === "/api/events" && request.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("*")
      .order("start_at", { ascending: true })
      .limit(100);
    if (error) return json({ error: error.message }, { status: 500 });
    return json({ events: data ?? [] });
  }

  if (url.pathname === "/api/events" && request.method === "POST") {
    const body = await readJson(request);
    if (!body?.title || !body?.start_at) {
      return json({ error: "title and start_at are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("events")
      .insert({
        title: String(body.title).trim(),
        description: body.description ? String(body.description).trim() : null,
        location: body.location ? String(body.location).trim() : null,
        start_at: String(body.start_at),
        end_at: body.end_at ? String(body.end_at) : null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) return json({ error: error.message }, { status: 500 });
    return json({ event: data }, { status: 201 });
  }

  if (url.pathname === "/api/messages" && request.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return json({ error: error.message }, { status: 500 });
    return json({ messages: data ?? [] });
  }

  if (url.pathname === "/api/messages" && request.method === "POST") {
    const body = await readJson(request);
    const content = String(body?.content ?? "").trim();
    if (content.length < 1 || content.length > 2000) {
      return json({ error: "content must be 1-2000 characters" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert({ user_id: user.id, content })
      .select()
      .single();
    if (error) return json({ error: error.message }, { status: 500 });
    return json({ message: data }, { status: 201 });
  }

  return json({ error: "Not found" }, { status: 404 });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const apiResponse = await handleApi(request);
      if (apiResponse) return apiResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
