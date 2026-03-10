import { createFileRoute } from "@tanstack/react-router";
import {
  buildAccessCookie,
  buildClearAccessCookie,
  getAccessKey,
  isAccessGateEnabled,
  isAuthorizedRequest
} from "@/lib/server/access";

export const Route = createFileRoute("/api/access")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const enabled = isAccessGateEnabled();
        const authorized = await isAuthorizedRequest(request);

        if (!enabled) {
          return Response.json(
            { enabled: false, authorized: true },
            { headers: { "Cache-Control": "no-store" } }
          );
        }

        if (!authorized) {
          return Response.json(
            { enabled: true, authorized: false },
            { status: 401, headers: { "Cache-Control": "no-store" } }
          );
        }

        return Response.json(
          { enabled: true, authorized: true },
          { headers: { "Cache-Control": "no-store" } }
        );
      },

      POST: async ({ request }) => {
        const enabled = isAccessGateEnabled();
        if (!enabled) {
          return Response.json(
            { enabled: false, authorized: true },
            { headers: { "Cache-Control": "no-store" } }
          );
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid JSON body" },
            { status: 400, headers: { "Cache-Control": "no-store" } }
          );
        }

        const key =
          payload && typeof payload === "object" && "key" in payload
            ? String((payload as any).key ?? "").trim()
            : "";

        if (!key) {
          return Response.json(
            { error: "Missing key" },
            { status: 400, headers: { "Cache-Control": "no-store" } }
          );
        }

        const expected = getAccessKey();
        if (key !== expected) {
          return Response.json(
            { error: "Invalid key" },
            { status: 401, headers: { "Cache-Control": "no-store" } }
          );
        }

        const cookie = await buildAccessCookie(request);
        return Response.json(
          { enabled: true, authorized: true },
          {
            headers: {
              "Cache-Control": "no-store",
              ...(cookie ? { "Set-Cookie": cookie } : {}),
            },
          }
        );
      },

      DELETE: async ({ request }) => {
        // Logout / revoke cookie.
        const cookie = buildClearAccessCookie(request);
        return Response.json(
          { ok: true },
          {
            headers: {
              "Cache-Control": "no-store",
              "Set-Cookie": cookie,
            },
          }
        );
      },
    },
  },
});

