import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { CalendarView } from "@/components/calendar-view";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Kalender — Förbundet Inv." }] }),
  component: () => (
    <RequireAuth>
      <CalendarView />
    </RequireAuth>
  ),
});
