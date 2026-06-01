import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { HomeView } from "@/components/home-view";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Hem — Förbundet Inv." }] }),
  component: () => (
    <RequireAuth>
      <HomeView />
    </RequireAuth>
  ),
});
