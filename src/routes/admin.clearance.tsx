import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/clearance")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/payments", search: { tab: "clearance" } });
  },
});
