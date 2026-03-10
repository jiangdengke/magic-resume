import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useLocation
} from "@tanstack/react-router";
import appCss from "../app/globals.css?url";
import appFontCss from "../app/font.css?url";
import { NextIntlClientProvider } from "@/i18n/compat/client";
import { useEffect } from "react";
import zhMessages from "@/i18n/locales/zh.json";
import enMessages from "@/i18n/locales/en.json";
import { Providers } from "@/app/providers";
import { Toaster } from "@/components/ui/sonner";
import { getPreferredLocale } from "@/i18n/runtime";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      },
      { title: "Magic Resume" }
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss
      },
      {
        rel: "stylesheet",
        href: appFontCss
      }
    ]
  }),
  component: RootComponent,
  notFoundComponent: RootNotFound
});

function RootComponent() {
  const { pathname, searchStr, hash } = useLocation({
    select: (location) => {
      const anyLocation = location as any;
      const resolvedSearchStr =
        typeof anyLocation.searchStr === "string"
          ? anyLocation.searchStr
          : typeof anyLocation.search === "string"
            ? anyLocation.search
            : "";

      const resolvedHash = typeof anyLocation.hash === "string" ? anyLocation.hash : "";

      return {
        pathname: location.pathname,
        searchStr: resolvedSearchStr,
        hash: resolvedHash
      };
    }
  });
  const locale = getPreferredLocale(pathname);
  const messages = locale === "en" ? enMessages : zhMessages;

  useEffect(() => {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;
  }, [locale]);

  useEffect(() => {
    // Site-wide access gate. `/access` itself must remain reachable.
    if (pathname === "/access" || pathname.startsWith("/access/")) {
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/access", {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal
        });

        if (controller.signal.aborted) return;

        // `GET /api/access` returns 401 only when the gate is enabled and the user is not authorized.
        if (res.status === 401) {
          const redirectTo = `${pathname}${searchStr}${hash}`;
          window.location.replace(
            `/access?redirect=${encodeURIComponent(redirectTo)}`
          );
        }
      } catch {
        // If the check fails (network error), don't hard-block the UI here.
        // Production Node runtime is protected at the server layer as well.
      }
    })();

    return () => controller.abort();
  }, [pathname, searchStr, hash]);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <HeadContent />
        <link rel="icon" href="/favicon.ico?v=2" />
        <link rel="icon" href="/icon.png" />
      </head>
      <body>
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
          timeZone="Asia/Shanghai"
        >
          <Providers>
            <Outlet />
            <Toaster position="top-center" richColors />
          </Providers>
        </NextIntlClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RootNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">页面不存在</p>
    </main>
  );
}
