import { createFileRoute } from "@tanstack/react-router";
import { requireAccess } from "@/lib/server/access";
import { readJsonFile, writeJsonFile } from "@/lib/server/storage";

const STATE_FILE = "state.json";
const STATE_VERSION = 1;

type ResumeSnapshot = {
  resumes: Record<string, any>;
  activeResumeId: string | null;
};

type AISnapshot = {
  selectedModel: string;
  doubaoApiKey: string;
  doubaoModelId: string;
  deepseekApiKey: string;
  deepseekModelId: string;
  openaiApiKey: string;
  openaiModelId: string;
  openaiApiEndpoint: string;
  geminiApiKey: string;
  geminiModelId: string;
};

type PersistedState = {
  version: number;
  updatedAt: string;
  resume: ResumeSnapshot;
  ai: AISnapshot;
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function emptyState(): PersistedState {
  return {
    version: STATE_VERSION,
    updatedAt: new Date(0).toISOString(),
    resume: { resumes: {}, activeResumeId: null },
    ai: {
      selectedModel: "doubao",
      doubaoApiKey: "",
      doubaoModelId: "",
      deepseekApiKey: "",
      deepseekModelId: "",
      openaiApiKey: "",
      openaiModelId: "",
      openaiApiEndpoint: "",
      geminiApiKey: "",
      geminiModelId: "gemini-flash-latest",
    },
  };
}

function mergeSnapshot(
  current: PersistedState,
  patch: { resume?: unknown; ai?: unknown }
): PersistedState {
  const next: PersistedState = {
    ...current,
    version: STATE_VERSION,
    updatedAt: new Date().toISOString(),
    resume: current.resume,
    ai: current.ai,
  };

  if (typeof patch.resume !== "undefined") {
    if (!isPlainObject(patch.resume)) {
      throw new Error("Invalid resume snapshot");
    }
    const resumes = isPlainObject((patch.resume as any).resumes)
      ? (patch.resume as any).resumes
      : {};
    const activeResumeId =
      typeof (patch.resume as any).activeResumeId === "string"
        ? (patch.resume as any).activeResumeId
        : null;
    next.resume = { resumes, activeResumeId };
  }

  if (typeof patch.ai !== "undefined") {
    if (!isPlainObject(patch.ai)) {
      throw new Error("Invalid ai snapshot");
    }
    // Keep this permissive; any missing keys fall back to existing.
    next.ai = {
      ...current.ai,
      ...(patch.ai as any),
    };
  }

  return next;
}

export const Route = createFileRoute("/api/state")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const unauthorized = await requireAccess(request);
        if (unauthorized) return unauthorized;

        try {
          const empty = emptyState();
          const existing = await readJsonFile<PersistedState | null>(
            STATE_FILE,
            null
          );

          if (!existing.exists || !existing.data) {
            return Response.json(
              { exists: false, state: empty },
              { headers: { "Cache-Control": "no-store" } }
            );
          }

          // Guard against corrupted / unexpected formats.
          const data = isPlainObject(existing.data)
            ? (existing.data as PersistedState)
            : empty;

          return Response.json(
            { exists: true, state: data },
            { headers: { "Cache-Control": "no-store" } }
          );
        } catch (error: any) {
          // Likely running on an edge runtime that doesn't support Node fs.
          return Response.json(
            {
              error: "Server storage is not available in this runtime",
              details: String(error?.message || error),
            },
            { status: 501, headers: { "Cache-Control": "no-store" } }
          );
        }
      },

      PUT: async ({ request }) => {
        const unauthorized = await requireAccess(request);
        if (unauthorized) return unauthorized;

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid JSON body" },
            { status: 400, headers: { "Cache-Control": "no-store" } }
          );
        }

        if (!isPlainObject(payload)) {
          return Response.json(
            { error: "Invalid payload" },
            { status: 400, headers: { "Cache-Control": "no-store" } }
          );
        }

        try {
          const empty = emptyState();
          const existing = await readJsonFile<PersistedState | null>(
            STATE_FILE,
            null
          );
          const base = existing.data && isPlainObject(existing.data) ? (existing.data as PersistedState) : empty;
          const next = mergeSnapshot(base, {
            resume: (payload as any).resume,
            ai: (payload as any).ai,
          });

          await writeJsonFile(STATE_FILE, next);

          return Response.json(next, {
            headers: { "Cache-Control": "no-store" },
          });
        } catch (error: any) {
          const message = String(error?.message || error);
          const status =
            message.includes("not available") || message.includes("node:")
              ? 501
              : 500;
          return Response.json(
            { error: "Failed to persist state", details: message },
            { status, headers: { "Cache-Control": "no-store" } }
          );
        }
      },
    },
  },
});

