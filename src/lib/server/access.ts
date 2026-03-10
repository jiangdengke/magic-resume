const ACCESS_COOKIE_NAME = "mr_access";
const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const ACCESS_HASH_FILE = "access.json";
const ACCESS_HASH_VERSION = 1;

import { readJsonFile, writeJsonFile } from "@/lib/server/storage";

function getEnv(name: string): string | undefined {
  // Works in Node and won't crash in non-Node runtimes (e.g. workers).
  const env = (globalThis as any).process?.env as Record<string, string> | undefined;
  return env?.[name];
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type AccessHashRecord = {
  version: number;
  updatedAt: string;
  accessHash: string;
};

function getEnvAccessKey(): string {
  return (getEnv("MAGIC_RESUME_ACCESS_KEY") || "").trim();
}

export async function getAccessHash(): Promise<string> {
  // 1) Prefer persisted hash (supports in-app rotation)
  const fromFile = await readJsonFile<AccessHashRecord | null>(
    ACCESS_HASH_FILE,
    null
  );
  const fileHash =
    fromFile.data &&
    typeof fromFile.data === "object" &&
    typeof (fromFile.data as any).accessHash === "string"
      ? String((fromFile.data as any).accessHash).trim()
      : "";

  if (fileHash) return fileHash;

  // 2) Fallback to env key (bootstrap)
  const envKey = getEnvAccessKey();
  if (!envKey) return "";
  return await sha256Hex(envKey);
}

export async function isAccessGateEnabled(): Promise<boolean> {
  return (await getAccessHash()).length > 0;
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
  const accessHash = await getAccessHash();
  if (!accessHash) return true; // gate disabled

  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const cookieValue = cookies[ACCESS_COOKIE_NAME];
  if (!cookieValue) return false;

  return cookieValue === accessHash;
}

export async function buildAccessCookie(request: Request): Promise<string | null> {
  const accessHash = await getAccessHash();
  if (!accessHash) return null;
  const secure = shouldUseSecureCookie(request.url);

  const parts = [
    `${ACCESS_COOKIE_NAME}=${encodeURIComponent(accessHash)}`,
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

export async function verifyAccessKey(key: string): Promise<boolean> {
  const accessHash = await getAccessHash();
  if (!accessHash) return true; // gate disabled
  const candidate = await sha256Hex(key.trim());
  return candidate === accessHash;
}

export async function persistAccessKey(newKey: string): Promise<string> {
  const accessHash = await sha256Hex(newKey.trim());
  const record: AccessHashRecord = {
    version: ACCESS_HASH_VERSION,
    updatedAt: new Date().toISOString(),
    accessHash
  };
  await writeJsonFile(ACCESS_HASH_FILE, record);
  return accessHash;
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
