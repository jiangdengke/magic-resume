import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAIConfigStore } from "@/store/useAIConfigStore";
import { useResumeStore } from "@/store/useResumeStore";

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

function waitForHydration(store: any): Promise<void> {
  return new Promise((resolve) => {
    const persist = store?.persist;
    if (!persist) {
      resolve();
      return;
    }

    try {
      if (persist.hasHydrated?.()) {
        resolve();
        return;
      }
    } catch {
      // ignore
    }

    const unsub = persist.onFinishHydration?.(() => {
      try {
        unsub?.();
      } catch {
        // ignore
      }
      resolve();
    });

    // If zustand persist isn't configured the way we expect, just proceed.
    if (typeof unsub !== "function") {
      resolve();
    }
  });
}

function pickResumeSnapshot(): ResumeSnapshot {
  const state = useResumeStore.getState() as any;
  return {
    resumes: state?.resumes && typeof state.resumes === "object" ? state.resumes : {},
    activeResumeId: typeof state?.activeResumeId === "string" ? state.activeResumeId : null
  };
}

function pickAISnapshot(): AISnapshot {
  const state = useAIConfigStore.getState() as any;
  return {
    selectedModel: String(state?.selectedModel ?? "doubao"),
    doubaoApiKey: String(state?.doubaoApiKey ?? ""),
    doubaoModelId: String(state?.doubaoModelId ?? ""),
    deepseekApiKey: String(state?.deepseekApiKey ?? ""),
    deepseekModelId: String(state?.deepseekModelId ?? ""),
    openaiApiKey: String(state?.openaiApiKey ?? ""),
    openaiModelId: String(state?.openaiModelId ?? ""),
    openaiApiEndpoint: String(state?.openaiApiEndpoint ?? ""),
    geminiApiKey: String(state?.geminiApiKey ?? ""),
    geminiModelId: String(state?.geminiModelId ?? "gemini-flash-latest")
  };
}

function resumeHasContent(snapshot: ResumeSnapshot): boolean {
  return Object.keys(snapshot.resumes || {}).length > 0;
}

function aiHasMeaningfulConfig(snapshot: AISnapshot): boolean {
  if (snapshot.selectedModel && snapshot.selectedModel !== "doubao") return true;
  if (snapshot.doubaoApiKey || snapshot.doubaoModelId) return true;
  if (snapshot.deepseekApiKey || snapshot.deepseekModelId) return true;
  if (snapshot.openaiApiKey || snapshot.openaiModelId || snapshot.openaiApiEndpoint) return true;
  if (snapshot.geminiApiKey) return true;
  if (snapshot.geminiModelId && snapshot.geminiModelId !== "gemini-flash-latest") return true;
  return false;
}

function applyResumeSnapshot(snapshot: ResumeSnapshot) {
  const resumes = snapshot.resumes || {};
  const activeResumeId = snapshot.activeResumeId || null;
  const activeResume =
    activeResumeId && resumes && typeof resumes === "object" ? resumes[activeResumeId] ?? null : null;

  useResumeStore.setState({
    resumes,
    activeResumeId,
    activeResume
  } as any);
}

function applyAISnapshot(snapshot: AISnapshot) {
  useAIConfigStore.setState(snapshot as any);
}

async function fetchServerState(signal: AbortSignal): Promise<{ exists: boolean; state: PersistedState } | null> {
  const res = await fetch("/api/state", {
    method: "GET",
    headers: { Accept: "application/json" },
    signal
  });

  if (res.status === 401) return null;
  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as
    | { exists?: boolean; state?: PersistedState }
    | null;
  if (!data?.state) return null;
  return { exists: Boolean(data.exists), state: data.state };
}

async function saveServerState(
  payload: { resume: ResumeSnapshot; ai: AISnapshot },
  signal: AbortSignal,
  keepalive?: boolean
): Promise<boolean> {
  const res = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    signal,
    ...(keepalive ? ({ keepalive: true } as any) : {}),
  });
  return res.ok;
}

export function ServerStateSync() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const startedRef = useRef(false);
  const hydrationPromiseRef = useRef<Promise<void> | null>(null);
  const disabledRef = useRef(false);
  const suppressSaveRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const inflightRef = useRef<AbortController | null>(null);
  const hasShownErrorRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (disabledRef.current) return;

    let cancelled = false;
    const unsubscribers: Array<() => void> = [];

    const scheduleSave = (flush?: { keepalive?: boolean }) => {
      if (suppressSaveRef.current) return;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

      const run = async () => {
        if (cancelled) return;

        try {
          inflightRef.current?.abort();
          const controller = new AbortController();
          inflightRef.current = controller;

          const ok = await saveServerState(
            { resume: pickResumeSnapshot(), ai: pickAISnapshot() },
            controller.signal,
            flush?.keepalive
          );

          if (!ok && !hasShownErrorRef.current) {
            hasShownErrorRef.current = true;
            toast.error("保存到服务器失败（将继续尝试）");
          }
        } catch {
          if (!hasShownErrorRef.current) {
            hasShownErrorRef.current = true;
            toast.error("保存到服务器失败（将继续尝试）");
          }
        }
      };

      if (flush?.keepalive) {
        void run();
        return;
      }

      saveTimerRef.current = window.setTimeout(() => void run(), 1000);
    };

    (async () => {
      // Wait for local persisted state, otherwise we might overwrite server with empty defaults.
      if (!hydrationPromiseRef.current) {
        hydrationPromiseRef.current = Promise.all([
          waitForHydration(useResumeStore as any),
          waitForHydration(useAIConfigStore as any),
        ]).then(() => undefined);
      }
      await hydrationPromiseRef.current;
      if (cancelled) return;

      const controller = new AbortController();
      inflightRef.current = controller;

      try {
        const server = await fetchServerState(controller.signal);
        if (cancelled) return;

        // If the access gate is enabled and we are not authorized yet, don't start.
        // We'll retry on the next navigation (e.g. after logging in on `/access`).
        if (!server) return;

        const localResume = pickResumeSnapshot();
        const localAi = pickAISnapshot();

        const serverResume = server?.state?.resume;
        const serverAi = server?.state?.ai;

        const serverHasAnything =
          Boolean(server) &&
          (resumeHasContent(serverResume || { resumes: {}, activeResumeId: null }) ||
            aiHasMeaningfulConfig(serverAi as any));

        const localHasAnything = resumeHasContent(localResume) || aiHasMeaningfulConfig(localAi);

        suppressSaveRef.current = true;
        try {
          if (serverHasAnything && serverResume && serverAi) {
            // Server is the source of truth for multi-device editing.
            applyResumeSnapshot(serverResume);
            applyAISnapshot(serverAi);
          } else if (localHasAnything) {
            // Bootstrap server state from local (first time).
            suppressSaveRef.current = false;
            scheduleSave({ keepalive: false });
            suppressSaveRef.current = true;
          }
        } finally {
          suppressSaveRef.current = false;
        }

        // Subscribe after initial sync.
        unsubscribers.push((useResumeStore as any).subscribe(() => scheduleSave()));
        unsubscribers.push((useAIConfigStore as any).subscribe(() => scheduleSave()));

        const onVisibilityChange = () => {
          if (document.visibilityState === "hidden") {
            scheduleSave({ keepalive: true });
          }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        unsubscribers.push(() => document.removeEventListener("visibilitychange", onVisibilityChange));

        startedRef.current = true;
      } catch {
        // If server persistence isn't available, keep local-only behavior.
        disabledRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      inflightRef.current?.abort();
      unsubscribers.forEach((fn) => {
        try {
          fn();
        } catch {
          // ignore
        }
      });
    };
  }, [pathname]);

  return null;
}
