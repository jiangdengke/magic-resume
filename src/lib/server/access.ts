const ACCESS_COOKIE_NAME = "mr_access";
const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getEnv(name: string): string | undefined {
  // Works in Node and won't crash in non-Node runtimes (e.g. workers).
  const env = (globalThis as any).process?.env as Record<string, string> | undefined;
  return env?.[name];
}

export function getAccessKey(): string {
  // Primary: MAGIC_RESUME_ACCESS_KEY
  // Fallback: ACCESS_KEY (for convenience)
  return (
    getEnv("MAGIC_RESUME_ACCESS_KEY") ||
    getEnv("ACCESS_KEY") ||
    ""
  ).trim();
}

export function isAccessGateEnabled(): boolean {
  return getAccessKey().length > 0;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawVal] = part.trim().split("=");
    if (!rawKey) continue;
    out[rawKey] = decodeURIComponent(rawVal.join("=") || "");
  }
  return out;
}

function shouldUseSecureCookie(requestUrl: string): boolean {
  try {
    const url = new URL(requestUrl);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function isAuthorizedRequest(request: Request): Promise<boolean> {
  const accessKey = getAccessKey();
  if (!accessKey) return true; // gate disabled

  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const cookieValue = cookies[ACCESS_COOKIE_NAME];
  if (!cookieValue) return false;

  const expected = await sha256Hex(accessKey);
  return cookieValue === expected;
}

export async function buildAccessCookie(request: Request): Promise<string | null> {
  const accessKey = getAccessKey();
  if (!accessKey) return null;

  const expected = await sha256Hex(accessKey);
  const secure = shouldUseSecureCookie(request.url);

  const parts = [
    `${ACCESS_COOKIE_NAME}=${encodeURIComponent(expected)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${ACCESS_COOKIE_MAX_AGE_SECONDS}`,
  ];

  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearAccessCookie(request: Request): string {
  const secure = shouldUseSecureCookie(request.url);
  const parts = [
    `${ACCESS_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function requireAccess(request: Request): Promise<Response | null> {
  if (await isAuthorizedRequest(request)) return null;
  return Response.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

