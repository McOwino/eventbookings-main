import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/contracts")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bookings", search: { tab: "contracts" } });
    },
  });
