import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import WorkbenchPage from "@/app/app/workbench/[id]/page";
import { useResumeStore } from "@/store/useResumeStore";

export const Route = createFileRoute("/app/workbench/$id")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }]
  }),
  beforeLoad: async ({ location }) => {
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
  component: WorkbenchRoutePage
});

function WorkbenchRoutePage() {
  const { id } = Route.useParams();
  const setActiveResume = useResumeStore((state) => state.setActiveResume);

  useEffect(() => {
    setActiveResume(id);
  }, [id, setActiveResume]);

  return <WorkbenchPage />;
}
