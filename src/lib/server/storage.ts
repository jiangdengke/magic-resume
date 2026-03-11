type JsonValue = any;

const DEFAULT_DATA_DIR = "data";
const DEFAULT_STORAGE_BACKEND = "sqlite";
const DEFAULT_SQLITE_FILE = "magic-resume.sqlite3";
const SQLITE_KV_TABLE = "mr_kv";

function getEnv(name: string): string | undefined {
  const env = (globalThis as any).process?.env as Record<string, string> | undefined;
  return env?.[name];
}

type StorageBackend = "sqlite" | "file";

function normalizeStorageBackend(value: string | undefined): StorageBackend | null {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "sqlite" || raw === "db") return "sqlite";
  if (raw === "file" || raw === "fs" || raw === "json") return "file";
  return null;
}

function getStorageBackend(): { backend: StorageBackend; explicit: boolean } {
  const normalized = normalizeStorageBackend(getEnv("MAGIC_RESUME_STORAGE"));
  if (normalized) return { backend: normalized, explicit: true };
  return { backend: DEFAULT_STORAGE_BACKEND, explicit: false };
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

async function getNodeChildProcess() {
  return await import("node:child_process");
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

async function getJsonFilePath(relativePath: string): Promise<string> {
  const path = await getNodePath();
  const dir = await ensureDataDir();
  const safePath = sanitizeRelativePath(relativePath);
  return path.join(dir, safePath);
}

async function readJsonFromFs<T>(
  relativePath: string,
  fallback: T
): Promise<{ exists: boolean; data: T }> {
  const fs = await getNodeFs();
  const filePath = await getJsonFilePath(relativePath);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    return { exists: true, data: JSON.parse(raw) as T };
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return { exists: false, data: fallback };
    }
    console.error(`Failed to read ${filePath}:`, error);
    return { exists: true, data: fallback };
  }
}

async function writeJsonToFs(relativePath: string, data: JsonValue): Promise<void> {
  const fs = await getNodeFs();
  const filePath = await getJsonFilePath(relativePath);

  const json = JSON.stringify(data, null, 2);
  const tmpPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    await fs.writeFile(tmpPath, json, "utf8");
    try {
      await fs.rename(tmpPath, filePath);
    } catch (renameError: any) {
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

async function getSqliteDbPath(): Promise<string> {
  const raw = (getEnv("MAGIC_RESUME_SQLITE_PATH") || getEnv("SQLITE_PATH") || DEFAULT_SQLITE_FILE).trim();
  const path = await getNodePath();

  if (!raw) {
    const dir = await ensureDataDir();
    return path.join(dir, DEFAULT_SQLITE_FILE);
  }

  if (path.isAbsolute(raw)) return raw;
  const dir = await ensureDataDir();
  const safe = sanitizeRelativePath(raw);
  return path.join(dir, safe);
}

function sqliteStringLiteral(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function execSqlite(
  sql: string,
  params?: Record<string, string>
): Promise<{ stdout: string; stderr: string }> {
  const childProcess = await getNodeChildProcess();
  const dbPath = await getSqliteDbPath();

  const args: string[] = [
    "-batch",
    "-noheader",
    "-bail",
    "-cmd",
    "PRAGMA journal_mode=WAL;",
    "-cmd",
    "PRAGMA busy_timeout=3000;",
    "-cmd",
    `CREATE TABLE IF NOT EXISTS ${SQLITE_KV_TABLE} (key TEXT PRIMARY KEY, json TEXT NOT NULL, updatedAt TEXT NOT NULL);`,
    "-cmd",
    ".parameter init",
  ];

  for (const [param, value] of Object.entries(params || {})) {
    args.push("-cmd", `.parameter set ${param} ${sqliteStringLiteral(value)}`);
  }

  args.push(dbPath, sql);

  return await new Promise((resolve, reject) => {
    childProcess.execFile(
      "sqlite3",
      args,
      { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          (error as any).stderr = stderr;
          reject(error);
          return;
        }
        resolve({ stdout: String(stdout || ""), stderr: String(stderr || "") });
      }
    );
  });
}

async function readJsonFromSqlite<T>(
  relativePath: string,
  fallback: T
): Promise<{ exists: boolean; data: T }> {
  const safeKey = sanitizeRelativePath(relativePath);

  try {
    const { stdout } = await execSqlite(
      `SELECT json FROM ${SQLITE_KV_TABLE} WHERE key=@k LIMIT 1;`,
      { "@k": safeKey }
    );

    const raw = String(stdout || "").trim();
    if (!raw) return { exists: false, data: fallback };

    try {
      return { exists: true, data: JSON.parse(raw) as T };
    } catch (error) {
      console.error(`Failed to parse sqlite value for ${safeKey}:`, error);
      return { exists: true, data: fallback };
    }
  } catch (error: any) {
    // When sqlite isn't available, fall back to file storage unless sqlite was explicitly requested.
    const message = String(error?.message || error);
    const code = String(error?.code || "");
    const { explicit } = getStorageBackend();
    if (!explicit && (code === "ENOENT" || message.includes("ENOENT"))) {
      return await readJsonFromFs(relativePath, fallback);
    }
    throw error;
  }
}

async function writeJsonToSqlite(relativePath: string, data: JsonValue): Promise<void> {
  const safeKey = sanitizeRelativePath(relativePath);
  const json = JSON.stringify(data);
  const updatedAt = new Date().toISOString();

  try {
    await execSqlite(
      `INSERT INTO ${SQLITE_KV_TABLE} (key, json, updatedAt)
       VALUES (@k, @v, @t)
       ON CONFLICT(key) DO UPDATE SET
         json=excluded.json,
         updatedAt=excluded.updatedAt;`,
      { "@k": safeKey, "@v": json, "@t": updatedAt }
    );
  } catch (error: any) {
    const message = String(error?.message || error);
    const code = String(error?.code || "");
    const { explicit } = getStorageBackend();
    if (!explicit && (code === "ENOENT" || message.includes("ENOENT"))) {
      await writeJsonToFs(relativePath, data);
      return;
    }
    throw error;
  }
}

export async function readJsonFile<T>(
  relativePath: string,
  fallback: T
): Promise<{ exists: boolean; data: T }> {
  const { backend } = getStorageBackend();

  if (backend === "file") {
    return await readJsonFromFs(relativePath, fallback);
  }

  const fromDb = await readJsonFromSqlite(relativePath, fallback);
  if (fromDb.exists) return fromDb;

  // One-time migration: if a legacy JSON file exists, import it into sqlite.
  const legacy = await readJsonFromFs(relativePath, fallback);
  if (legacy.exists) {
    try {
      await writeJsonToSqlite(relativePath, legacy.data as any);
    } catch (error) {
      console.error("Failed to migrate legacy JSON to sqlite:", error);
    }
  }
  return legacy;
}

export async function writeJsonFile(
  relativePath: string,
  data: JsonValue
): Promise<void> {
  const { backend } = getStorageBackend();

  if (backend === "file") {
    await writeJsonToFs(relativePath, data);
    return;
  }

  await writeJsonToSqlite(relativePath, data);
}
