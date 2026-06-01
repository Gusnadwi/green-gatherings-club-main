import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { EventDetailView } from "@/components/event-detail-view";

export const Route = createFileRoute("/event/$eventId")({
  head: () => ({ meta: [{ title: "Event — Förbundet Inv." }] }),
  component: EventRoute,
});

function EventRoute() {
  const { eventId } = Route.useParams();
  return (
    <RequireAuth>
      <EventDetailView eventId={eventId} />
    </RequireAuth>
  );
}
