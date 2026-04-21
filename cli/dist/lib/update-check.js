"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkForUpdate = checkForUpdate;
const chalk_1 = __importDefault(require("chalk"));
const config_1 = require("../config");
// resolveJsonModule is enabled — TypeScript resolves this at compile time
const package_json_1 = __importDefault(require("../../package.json"));
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GITHUB_PKG_URL = "https://raw.githubusercontent.com/Trevor-Warthman/pensieve/main/package.json";
const INSTALL_CMD = "npm install -g Trevor-Warthman/pensieve";
function getInstalledVersion() {
    return package_json_1.default.version ?? "0.0.0";
}
async function fetchLatestVersion() {
    try {
        const res = await fetch(GITHUB_PKG_URL, { signal: AbortSignal.timeout(5000) });
        if (!res.ok)
            return null;
        const body = (await res.json());
        return typeof body.version === "string" ? body.version : null;
    }
    catch {
        return null;
    }
}
function isNewer(latest, installed) {
    const parse = (v) => v.replace(/^v/, "").split(".").map(Number);
    const [lMaj, lMin, lPat] = parse(latest);
    const [iMaj, iMin, iPat] = parse(installed);
    if (lMaj !== iMaj)
        return lMaj > iMaj;
    if (lMin !== iMin)
        return lMin > iMin;
    return lPat > iPat;
}
/**
 * Fire-and-forget update check. Returns a Promise that resolves to a warning
 * string if an update is available, or null otherwise. The caller should await
 * this only after the command has already printed its own output.
 */
async function checkForUpdate() {
    const installed = getInstalledVersion();
    // Check the cache first
    const cachedVersion = config_1.config.get("updateCheckCachedVersion");
    const cachedAt = config_1.config.get("updateCheckCachedAt");
    const now = Date.now();
    let latest = null;
    if (cachedVersion &&
        cachedAt &&
        now - Number(cachedAt) < CACHE_TTL_MS) {
        latest = cachedVersion;
    }
    else {
        latest = await fetchLatestVersion();
        if (latest) {
            config_1.config.set("updateCheckCachedVersion", latest);
            config_1.config.set("updateCheckCachedAt", String(now));
        }
    }
    if (!latest || !isNewer(latest, installed))
        return null;
    return (chalk_1.default.yellow(`\n⚠  Pensieve update available: ${installed} → ${latest}`) +
        "\n" +
        chalk_1.default.dim(`   Run ${INSTALL_CMD} to update`));
}
