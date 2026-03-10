type JsonValue = any;

const DEFAULT_DATA_DIR = "data";

function getEnv(name: string): string | undefined {
  const env = (globalThis as any).process?.env as Record<string, string> | undefined;
  return env?.[name];
}

function sanitizeRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) throw new Error("Invalid path");
  if (normalized.includes("..")) throw new Error("Invalid path");
  return normalized;
}

async function getNodeFs() {
  // Node-only. If your deployment is an edge runtime, these endpoints should be replaced
  // by KV/D1/etc. We keep it here for the Docker/Node runtime.
  return await import("node:fs/promises");
}

async function getNodePath() {
  return await import("node:path");
}

export async function getDataDir(): Promise<string> {
  const raw = (getEnv("MAGIC_RESUME_DATA_DIR") || getEnv("DATA_DIR") || DEFAULT_DATA_DIR).trim();
  const path = await getNodePath();
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

export async function ensureDataDir(): Promise<string> {
  const fs = await getNodeFs();
  const dir = await getDataDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function readJsonFile<T>(
  relativePath: string,
  fallback: T
): Promise<{ exists: boolean; data: T }> {
  const fs = await getNodeFs();
  const path = await getNodePath();
  const dir = await ensureDataDir();
  const safePath = sanitizeRelativePath(relativePath);
  const filePath = path.join(dir, safePath);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    return { exists: true, data: JSON.parse(raw) as T };
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return { exists: false, data: fallback };
    }
    // Corrupted file or other error: fall back but keep the error visible in logs.
    console.error(`Failed to read ${filePath}:`, error);
    return { exists: true, data: fallback };
  }
}

export async function writeJsonFile(
  relativePath: string,
  data: JsonValue
): Promise<void> {
  const fs = await getNodeFs();
  const path = await getNodePath();
  const dir = await ensureDataDir();
  const safePath = sanitizeRelativePath(relativePath);
  const filePath = path.join(dir, safePath);

  const json = JSON.stringify(data, null, 2);
  const tmpPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    await fs.writeFile(tmpPath, json, "utf8");
    try {
      await fs.rename(tmpPath, filePath);
    } catch (renameError: any) {
      // Windows can be finicky replacing existing files; fall back to direct write.
      if (renameError?.code === "EPERM" || renameError?.code === "EEXIST") {
        await fs.writeFile(filePath, json, "utf8");
        await fs.rm(tmpPath, { force: true });
      } else {
        throw renameError;
      }
    }
  } catch (error) {
    console.error(`Failed to write ${filePath}:`, error);
    throw error;
  }
}

