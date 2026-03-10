import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "@/lib/navigation";
import { useTranslations } from "@/i18n/compat/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/shared/Logo";

type AccessSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/access")({
  validateSearch: (search: Record<string, unknown>): AccessSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined
  }),
  component: AccessPage
});

function normalizeRedirect(value: string | undefined): string {
  if (!value) return "/app/dashboard";
  // If we got an absolute URL, keep only the path part.
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      value = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      // ignore
    }
  }

  // Only allow in-app relative redirects to avoid open redirect.
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/app/dashboard";
}

function AccessPage() {
  const t = useTranslations("accessGate");
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const redirectTo = useMemo(() => normalizeRedirect(redirect), [redirect]);

  const [key, setKey] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/access", {
          method: "GET",
          headers: { Accept: "application/json" }
        });

        if (cancelled) return;

        if (res.ok) {
          const data = (await res.json().catch(() => null)) as
            | { authorized?: boolean }
            | null;
          if (data?.authorized) {
            router.replace(redirectTo);
            return;
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [redirectTo, router]);

  const submit = async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      toast.error(t("errorEmpty"));
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ key: trimmed })
      });

      if (res.ok) {
        toast.success(t("success"));
        router.replace(redirectTo);
        return;
      }

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (data?.error === "Invalid key") {
        toast.error(t("errorInvalid"));
      } else if (data?.error === "Missing key") {
        toast.error(t("errorEmpty"));
      } else {
        toast.error(t("errorInvalid"));
      }
    } catch (e) {
      toast.error(t("errorInvalid"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-[#f8f9fb] to-white dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md shadow-lg border-border/60">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <Logo size={42} />
            <div className="flex flex-col">
              <CardTitle className="text-xl">{t("title")}</CardTitle>
              <CardDescription>{t("description")}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="access-key">{t("inputLabel")}</Label>
            <Input
              id="access-key"
              type="password"
              value={key}
              autoComplete="off"
              placeholder={t("inputPlaceholder")}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              disabled={isSubmitting || isChecking}
            />
          </div>

          <Button
            className="w-full"
            onClick={() => void submit()}
            disabled={isSubmitting || isChecking}
          >
            {isSubmitting ? t("submitting") : t("submit")}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
