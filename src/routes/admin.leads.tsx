import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/leads")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bookings", search: { tab: "leads" } });
  },
});
