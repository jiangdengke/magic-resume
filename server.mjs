import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, normalize, resolve } from "node:path";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import serverEntry from "./dist/server/server.js";

const clientDir = resolve(process.cwd(), "dist/client");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOSTNAME || "0.0.0.0";

const ACCESS_COOKIE_NAME = "mr_access";
const ACCESS_HASH_FILE = "access.json";
const DEFAULT_DATA_DIR = "data";
// Keep this at 0 to reflect key rotations immediately after `/api/access` updates the file.
// (Performance impact is negligible for typical self-hosted usage.)
const ACCESS_HASH_CACHE_TTL_MS = 0;

function getAccessKey() {
  return String(process.env.MAGIC_RESUME_ACCESS_KEY || "").trim();
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

let cachedAccessHash = null;
let cachedAccessHashAt = 0;

function getDataDir() {
  const raw = String(
    (process.env.MAGIC_RESUME_DATA_DIR || process.env.DATA_DIR || DEFAULT_DATA_DIR) ?? DEFAULT_DATA_DIR
  ).trim();
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

function readAccessHashFromFile() {
  try {
    const filePath = resolve(getDataDir(), ACCESS_HASH_FILE);
    if (!existsSync(filePath)) return "";

    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const hash =
      parsed && typeof parsed === "object" && typeof parsed.accessHash === "string"
        ? String(parsed.accessHash).trim()
        : "";
    return hash;
  } catch (error) {
    // Don't crash the server; fall back to env hashing.
    console.error("Failed to read access hash file:", error);
    return "";
  }
}

function getAccessHash() {
  const now = Date.now();
  if (cachedAccessHash !== null && now - cachedAccessHashAt < ACCESS_HASH_CACHE_TTL_MS) {
    return cachedAccessHash;
  }

  cachedAccessHashAt = now;

  const fromFile = readAccessHashFromFile();
  if (fromFile) {
    cachedAccessHash = fromFile;
    return fromFile;
  }

  const key = getAccessKey();
  if (!key) {
    cachedAccessHash = "";
    return "";
  }

  cachedAccessHash = sha256Hex(key);
  return cachedAccessHash;
}

function parseCookieHeader(cookieHeader) {
  if (!cookieHeader) return {};
  const out = {};
  for (const part of String(cookieHeader).split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) continue;
    out[rawKey] = decodeURIComponent(rawValue.join("=") || "");
  }
  return out;
}

function isAuthorized(nodeHeaders) {
  const accessHash = getAccessHash();
  if (!accessHash) return true; // gate disabled

  const cookies = parseCookieHeader(nodeHeaders.cookie || nodeHeaders.Cookie);
  const cookieValue = cookies[ACCESS_COOKIE_NAME];
  if (!cookieValue) return false;

  return cookieValue === accessHash;
}

function isBypassPath(pathname) {
  if (!pathname) return true;
  if (pathname === "/access" || pathname.startsWith("/access/")) return true;
  if (pathname === "/api/access" || pathname.startsWith("/api/access/")) return true;
  return false;
}

function deriveLocaleFromPathname(pathname) {
  const first = String(pathname || "")
    .split("/")
    .filter(Boolean)[0];
  return first === "en" || first === "zh" ? first : null;
}

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8"
};

function getContentType(filePath) {
  const extension = extname(filePath).toLowerCase();
  return MIME_TYPES[extension] || "application/octet-stream";
}

function toHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (typeof value === "undefined") continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

function resolveStaticFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const normalized = normalize(decoded).replace(/^[/\\]+/, "");
  const absolutePath = resolve(clientDir, normalized);
  if (!absolutePath.startsWith(clientDir)) return null;
  if (!existsSync(absolutePath)) return null;
  const stats = statSync(absolutePath);
  if (!stats.isFile()) return null;
  return absolutePath;
}

function tryServeStatic(req, res, url) {
  if (!url.pathname || url.pathname.endsWith("/")) return false;
  const filePath = resolveStaticFile(url.pathname);
  if (!filePath) return false;

  res.statusCode = 200;
  res.setHeader("Content-Type", getContentType(filePath));
  if (url.pathname.startsWith("/assets/")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    res.setHeader("Cache-Control", "public, max-age=3600");
  }

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  createReadStream(filePath).pipe(res);
  return true;
}

function appendSetCookie(res, value) {
  const existing = res.getHeader("set-cookie");
  if (!existing) {
    res.setHeader("set-cookie", value);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader("set-cookie", [...existing, value]);
    return;
  }
  res.setHeader("set-cookie", [String(existing), value]);
}

createServer(async (req, res) => {
  try {
    const hostHeader = req.headers.host || `localhost:${port}`;
    const protocol = (req.headers["x-forwarded-proto"] || "http").toString().split(",")[0].trim();
    const url = new URL(req.url || "/", `${protocol}://${hostHeader}`);

    if (tryServeStatic(req, res, url)) return;

    // Site-wide access gate for Node/Docker runtime.
    // Static assets are already served above, so this only affects routed pages + APIs.
    const accessHash = getAccessHash();
    if (accessHash && !isBypassPath(url.pathname)) {
      const authorized = isAuthorized(req.headers);
      if (!authorized) {
        res.setHeader("Cache-Control", "no-store");

        if (url.pathname && url.pathname.startsWith("/api/")) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }

        const redirectTarget = `/access?redirect=${encodeURIComponent(
          `${url.pathname || "/"}${url.search || ""}`
        )}`;
        res.statusCode = 302;
        const locale = deriveLocaleFromPathname(url.pathname);
        if (locale) {
          res.setHeader(
            "Set-Cookie",
            `NEXT_LOCALE=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000`
          );
        }
        res.setHeader("Location", redirectTarget);
        res.end();
        return;
      }
    }

    const method = (req.method || "GET").toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD";
    const init = {
      method,
      headers: toHeaders(req.headers)
    };

    if (hasBody) {
      init.body = Readable.toWeb(req);
      init.duplex = "half";
    }

    const request = new Request(url, init);
    const response = await serverEntry.fetch(request);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        appendSetCookie(res, value);
      } else {
        res.setHeader(key, value);
      }
    });

    if (method === "HEAD" || !response.body) {
      res.end();
      return;
    }

    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error("Server error:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
}).listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});
