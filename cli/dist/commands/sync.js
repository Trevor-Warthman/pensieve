"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCommand = void 0;
const commander_1 = require("commander");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const prompts_1 = require("@inquirer/prompts");
const gray_matter_1 = __importDefault(require("gray-matter"));
const config_1 = require("../config");
const publish_filter_1 = require("../lib/publish-filter");
function md5(buf) {
    return crypto.createHash("md5").update(buf).digest("hex");
}
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const types = {
        ".md": "text/markdown; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".avif": "image/avif",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".aac": "audio/aac",
        ".weba": "audio/webm",
        ".opus": "audio/ogg; codecs=opus",
    };
    return types[ext] ?? "application/octet-stream";
}
function buildManifest(mdFiles, assetFiles, absDir) {
    const wikilinkRegex = /\[\[([^\]|#\n]+)(?:[|#][^\]\n]*)?\]\]/g;
    const notes = [];
    const backlinks = {};
    for (const file of mdFiles) {
        const rel = path.relative(absDir, file).replace(/\\/g, "/");
        const slug = rel.replace(/\.md$/, "");
        try {
            const { data, content } = gray_matter_1.default.read(file);
            const title = data.title ?? slug.split("/").pop() ?? "Untitled";
            const tags = Array.isArray(data.tags) ? data.tags : [];
            notes.push({ slug, title, tags });
            wikilinkRegex.lastIndex = 0;
            let match;
            while ((match = wikilinkRegex.exec(content)) !== null) {
                const target = match[1].trim().toLowerCase();
                if (!backlinks[target])
                    backlinks[target] = [];
                if (!backlinks[target].includes(slug))
                    backlinks[target].push(slug);
            }
        }
        catch {
            // skip unparseable files
        }
    }
    // Build asset lookup: lowercase basename → relative path
    const assets = {};
    for (const file of assetFiles) {
        const rel = path.relative(absDir, file).replace(/\\/g, "/");
        const basename = path.basename(file).toLowerCase();
        assets[basename] = rel;
    }
    return { version: 1, generatedAt: new Date().toISOString(), notes, backlinks, assets };
}
const SYNC_CHUNK_SIZE = 200;
async function requestUploadUrlsChunk(apiEndpoint, accessToken, lexiconSlug, fileList) {
    const res = await fetch(`${apiEndpoint}/sync`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ lexiconSlug, files: fileList }),
    });
    if (res.status === 401) {
        throw new Error("UNAUTHORIZED");
    }
    if (!res.ok) {
        const text = await res.text();
        let message;
        try {
            const body = JSON.parse(text);
            message = body.error ?? `HTTP ${res.status}`;
        }
        catch {
            message = text.trim() || `HTTP ${res.status}`;
        }
        throw new Error(message);
    }
    return res.json();
}
async function requestUploadUrls(apiEndpoint, accessToken, lexiconSlug, fileList) {
    if (fileList.length <= SYNC_CHUNK_SIZE) {
        return requestUploadUrlsChunk(apiEndpoint, accessToken, lexiconSlug, fileList);
    }
    const combined = { uploadUrls: [], existing: {} };
    for (let i = 0; i < fileList.length; i += SYNC_CHUNK_SIZE) {
        const chunk = fileList.slice(i, i + SYNC_CHUNK_SIZE);
        const result = await requestUploadUrlsChunk(apiEndpoint, accessToken, lexiconSlug, chunk);
        combined.uploadUrls.push(...result.uploadUrls);
        Object.assign(combined.existing, result.existing);
    }
    return combined;
}
exports.syncCommand = new commander_1.Command("sync")
    .description("Sync a local directory of markdown files to a Pensieve lexicon.")
    .usage("<dir> --lexicon <slug> [--dry-run]")
    .argument("[dir]", "Local directory of markdown files to sync")
    .option("-l, --lexicon <slug>", "Slug of the target lexicon (from /dashboard)")
    .option("--dry-run", "List files that would be uploaded without uploading anything")
    .addHelpText("after", `
Examples:
  pensieve sync ./notes --lexicon my-lexicon
  pensieve sync /Users/you/notes --lexicon my-lexicon --dry-run`)
    .action(async (dir, opts) => {
    if (!dir) {
        dir = await (0, prompts_1.input)({ message: "Directory to sync (e.g. ./notes or /Users/you/notes):" });
    }
    if (!opts.lexicon) {
        opts.lexicon = await (0, prompts_1.input)({ message: "Lexicon slug (lowercase, hyphens only, e.g. my-lexicon):" });
    }
    const absDir = path.resolve(dir);
    if (!fs.existsSync(absDir)) {
        console.error(chalk_1.default.red(`Directory not found: ${absDir}`));
        process.exitCode = 1;
        return;
    }
    const apiEndpoint = config_1.config.get("apiEndpoint");
    let accessToken = config_1.config.get("accessToken");
    if (!apiEndpoint) {
        console.error(chalk_1.default.red("Not configured. Run `pensieve config init`."));
        process.exitCode = 1;
        return;
    }
    if (!accessToken) {
        console.error(chalk_1.default.red("Not logged in. Run `pensieve login` first."));
        process.exitCode = 1;
        return;
    }
    // ── Verify auth before scanning ──────────────────────────────────────────
    const authCheck = await fetch(`${apiEndpoint}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => null);
    if (!authCheck || authCheck.status === 401) {
        console.error(chalk_1.default.red("Not logged in or session expired. Run `pensieve login` first."));
        process.exitCode = 1;
        return;
    }
    // ── Scan vault ──────────────────────────────────────────────────────────
    const scanSpinner = (0, ora_1.default)("Scanning vault...").start();
    const { mdFiles, assetFiles } = (0, publish_filter_1.scanVault)(absDir);
    scanSpinner.succeed(`Found ${mdFiles.length} notes, ${assetFiles.length} assets`);
    if (mdFiles.length === 0) {
        console.log("Nothing to sync.");
        return;
    }
    // ── Build manifest ───────────────────────────────────────────────────────
    const manifestSpinner = (0, ora_1.default)("Building manifest...").start();
    const manifest = buildManifest(mdFiles, assetFiles, absDir);
    const manifestBuf = Buffer.from(JSON.stringify(manifest));
    manifestSpinner.succeed("Manifest ready");
    const allFiles = [
        ...mdFiles.map((f) => ({ path: path.relative(absDir, f).replace(/\\/g, "/"), abs: f })),
        ...assetFiles.map((f) => ({ path: path.relative(absDir, f).replace(/\\/g, "/"), abs: f })),
        { path: "_manifest.json", abs: "" }, // synthetic — content is manifestBuf
    ];
    const fileList = allFiles.map((f) => ({
        path: f.path,
        contentType: f.path === "_manifest.json" ? "application/json" : getContentType(f.abs),
    }));
    if (opts.dryRun) {
        console.log(chalk_1.default.cyan(`\nWould sync to lexicon "${opts.lexicon}":`));
        for (const f of allFiles.filter(f => f.path !== "_manifest.json")) {
            console.log(`  ${f.path}`);
        }
        return;
    }
    // ── Request presigned URLs ───────────────────────────────────────────────
    const urlSpinner = (0, ora_1.default)("Requesting upload URLs...").start();
    let syncData;
    try {
        syncData = await requestUploadUrls(apiEndpoint, accessToken, opts.lexicon, fileList);
    }
    catch (err) {
        if (err instanceof Error && err.message === "UNAUTHORIZED") {
            urlSpinner.stop();
            console.log(chalk_1.default.yellow("Session expired — please log in again."));
            config_1.config.delete("accessToken");
            const { runSetupIfNeeded } = await Promise.resolve().then(() => __importStar(require("../lib/setup-wizard")));
            await runSetupIfNeeded();
            accessToken = config_1.config.get("accessToken");
            try {
                syncData = await requestUploadUrls(apiEndpoint, accessToken, opts.lexicon, fileList);
            }
            catch (retryErr) {
                urlSpinner.fail("Failed to get upload URLs");
                console.error(chalk_1.default.red(retryErr instanceof Error ? retryErr.message : String(retryErr)));
                process.exitCode = 1;
                return;
            }
        }
        else {
            urlSpinner.fail("Failed to get upload URLs");
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.toLowerCase().includes("fetch failed") || msg.toLowerCase().includes("econnrefused") || msg.toLowerCase().includes("enotfound")) {
                console.error(chalk_1.default.red("Could not reach the Pensieve server. Check your internet connection or run `pensieve config init` to verify your API endpoint."));
            }
            else {
                console.error(chalk_1.default.red(msg));
            }
            process.exitCode = 1;
            return;
        }
    }
    urlSpinner.succeed("Ready to upload");
    const urlMap = new Map(syncData.uploadUrls.map((u) => [u.path, u.uploadUrl]));
    let uploaded = 0;
    let skipped = 0;
    // ── Upload files ─────────────────────────────────────────────────────────
    for (const file of allFiles) {
        const uploadUrl = urlMap.get(file.path);
        if (!uploadUrl)
            continue;
        const buf = file.path === "_manifest.json" ? manifestBuf : fs.readFileSync(file.abs);
        // Skip unchanged files (S3 ETag = MD5 of content for single-part uploads)
        const remoteEtag = syncData.existing[file.path];
        if (remoteEtag && md5(buf) === remoteEtag.replace(/"/g, "")) {
            skipped++;
            continue;
        }
        const contentType = file.path === "_manifest.json"
            ? "application/json"
            : getContentType(file.abs);
        const putRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: buf,
        });
        if (!putRes.ok) {
            console.error(chalk_1.default.red(`  ✗ ${file.path} (HTTP ${putRes.status})`));
        }
        else {
            if (file.path !== "_manifest.json") {
                console.log(chalk_1.default.green(`  ↑ ${file.path}`));
            }
            uploaded++;
        }
    }
    console.log(chalk_1.default.bold(`\nSync complete: ${uploaded} uploaded, ${skipped} unchanged.`));
});
