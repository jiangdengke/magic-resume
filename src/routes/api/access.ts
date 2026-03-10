import { createFileRoute } from "@tanstack/react-router";
import {
  buildAccessCookie,
  buildClearAccessCookie,
  getAccessHash,
  isAccessGateEnabled,
  isAuthorizedRequest,
  persistAccessKey,
  verifyAccessKey
} from "@/lib/server/access";

export const Route = createFileRoute("/api/access")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const enabled = await isAccessGateEnabled();
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
        const enabled = await isAccessGateEnabled();
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

        const ok = await verifyAccessKey(key);
        if (!ok) {
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

      PUT: async ({ request }) => {
        // Rotate / set access key in-server (persists to data dir).
        // If a gate is currently enabled, you must already be authorized.
        const enabled = await isAccessGateEnabled();
        if (enabled) {
          const authorized = await isAuthorizedRequest(request);
          if (!authorized) {
            return Response.json(
              { error: "Unauthorized" },
              { status: 401, headers: { "Cache-Control": "no-store" } }
            );
          }
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

        const newKey =
          payload && typeof payload === "object" && "newKey" in payload
            ? String((payload as any).newKey ?? "").trim()
            : "";

        if (!newKey) {
          return Response.json(
            { error: "Missing newKey" },
            { status: 400, headers: { "Cache-Control": "no-store" } }
          );
        }

        const accessHash = await persistAccessKey(newKey);
        const cookie = await buildAccessCookie(request);

        return Response.json(
          { enabled: true, authorized: true, accessHash },
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
