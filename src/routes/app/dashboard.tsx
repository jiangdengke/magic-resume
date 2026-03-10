import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import DashboardLayout from "@/app/app/dashboard/client";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }]
  }),
  beforeLoad: async ({ location }) => {
    // Client-side guard. Server-side APIs are protected separately.
    try {
      const res = await fetch("/api/access", {
        method: "GET",
        headers: { Accept: "application/json" }
      });
      if (res.ok) return;
    } catch {
      // fall through
    }

    const redirectTo =
      typeof (location as any)?.href === "string"
        ? (location as any).href
        : location.pathname;
    throw redirect({ to: "/access", search: { redirect: redirectTo } });
  },
  ssr: false,
  component: DashboardRouteLayout
});

function DashboardRouteLayout() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
