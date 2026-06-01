import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { ProfileView } from "@/components/profile-view";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profil — Förbundet Inv." }] }),
  component: () => (
    <RequireAuth>
      <ProfileView />
    </RequireAuth>
  ),
});
