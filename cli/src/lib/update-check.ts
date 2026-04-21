import chalk from "chalk";
import { config } from "../config";
// resolveJsonModule is enabled — TypeScript resolves this at compile time
import pkg from "../../package.json";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GITHUB_PKG_URL =
  "https://raw.githubusercontent.com/Trevor-Warthman/pensieve/main/package.json";
const INSTALL_CMD = "npm install -g Trevor-Warthman/pensieve";

function getInstalledVersion(): string {
  return pkg.version ?? "0.0.0";
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(GITHUB_PKG_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: string };
    return typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  }
}

function isNewer(latest: string, installed: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [lMaj, lMin, lPat] = parse(latest);
  const [iMaj, iMin, iPat] = parse(installed);
  if (lMaj !== iMaj) return lMaj > iMaj;
  if (lMin !== iMin) return lMin > iMin;
  return lPat > iPat;
}

/**
 * Fire-and-forget update check. Returns a Promise that resolves to a warning
 * string if an update is available, or null otherwise. The caller should await
 * this only after the command has already printed its own output.
 */
export async function checkForUpdate(): Promise<string | null> {
  const installed = getInstalledVersion();

  // Check the cache first
  const cachedVersion = config.get("updateCheckCachedVersion");
  const cachedAt = config.get("updateCheckCachedAt");
  const now = Date.now();

  let latest: string | null = null;

  if (
    cachedVersion &&
    cachedAt &&
    now - Number(cachedAt) < CACHE_TTL_MS
  ) {
    latest = cachedVersion;
  } else {
    latest = await fetchLatestVersion();
    if (latest) {
      config.set("updateCheckCachedVersion", latest);
      config.set("updateCheckCachedAt", String(now));
    }
  }

  if (!latest || !isNewer(latest, installed)) return null;

  return (
    chalk.yellow(`\n⚠  Pensieve update available: ${installed} → ${latest}`) +
    "\n" +
    chalk.dim(`   Run ${INSTALL_CMD} to update`)
  );
}
