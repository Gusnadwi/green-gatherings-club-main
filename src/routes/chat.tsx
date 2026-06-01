import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { ChatView } from "@/components/chat-view";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Chatt — Förbundet Inv." }] }),
  component: () => (
    <RequireAuth>
      <ChatView />
    </RequireAuth>
  ),
});
