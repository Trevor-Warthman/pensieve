import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import chalk from "chalk";
import ora from "ora";
import { input } from "@inquirer/prompts";
import matter from "gray-matter";
import { config } from "../config";
import { scanVault } from "../lib/publish-filter";

interface SyncResponse {
  uploadUrls: Array<{ path: string; uploadUrl: string; key: string }>;
  existing: Record<string, string>; // relative path -> ETag
}

function md5(buf: Buffer): string {
  return crypto.createHash("md5").update(buf).digest("hex");
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
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

interface ManifestNote {
  slug: string;
  title: string;
  tags: string[];
  content: string; // stripped, truncated body — avoids a per-note S3 fetch to build search indexes
  pin?: boolean;
  pinOrder?: number;
}

/** Strip markdown syntax down to plain text for a search-index excerpt.
 *  Mirrors app/lib/content.ts's stripMarkdown — kept in sync manually since
 *  the CLI and app are separate packages with no shared lib today.
 */
function stripMarkdown(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/[*_~`]{1,3}/g, "")
    .replace(/>\s+/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

interface Manifest {
  version: number;
  generatedAt: string;
  notes: ManifestNote[];
  backlinks: Record<string, string[]>;
  assets: Record<string, string>; // lowercase basename → relative path
}

function buildManifest(mdFiles: string[], assetFiles: string[], absDir: string): Manifest {
  const wikilinkRegex = /\[\[([^\]|#\n]+)(?:[|#][^\]\n]*)?\]\]/g;
  const notes: ManifestNote[] = [];
  const backlinks: Record<string, string[]> = {};
  const parsed: Array<{ slug: string; content: string }> = [];

  for (const file of mdFiles) {
    const rel = path.relative(absDir, file).replace(/\\/g, "/");
    const slug = rel.replace(/\.md$/, "");

    try {
      const { data, content } = matter.read(file);
      const title = (data.title as string) ?? slug.split("/").pop() ?? "Untitled";
      const tags = Array.isArray(data.tags) ? (data.tags as string[]) : [];
      const pin = data.pin === true;
      const pinOrder = typeof data.pinOrder === "number" ? data.pinOrder : undefined;
      notes.push({
        slug, title, tags,
        content: stripMarkdown(content).slice(0, 500),
        ...(pin && { pin }),
        ...(pinOrder !== undefined && { pinOrder }),
      });
      parsed.push({ slug, content });
    } catch {
      // skip unparseable files
    }
  }

  // Obsidian wikilinks are usually bare note names (e.g. [[Hesta]], resolved
  // by unique filename regardless of folder), not full paths — resolve
  // through this basename index before falling back to a literal match, or
  // almost every real-world wikilink misses and backlinks/graph end up
  // nearly empty despite a densely cross-linked vault.
  const basenameToSlug = new Map<string, string>();
  for (const { slug } of parsed) {
    const basename = slug.split("/").pop()!.toLowerCase();
    if (!basenameToSlug.has(basename)) basenameToSlug.set(basename, slug);
  }

  for (const { slug, content } of parsed) {
    wikilinkRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = wikilinkRegex.exec(content)) !== null) {
      const raw = match[1].trim().toLowerCase();
      const resolved = basenameToSlug.get(raw.split("/").pop()!) ?? raw;
      const target = resolved.toLowerCase();
      if (!backlinks[target]) backlinks[target] = [];
      if (!backlinks[target].includes(slug)) backlinks[target].push(slug);
    }
  }

  // Build asset lookup: lowercase basename → relative path
  const assets: Record<string, string> = {};
  for (const file of assetFiles) {
    const rel = path.relative(absDir, file).replace(/\\/g, "/");
    const basename = path.basename(file).toLowerCase();
    assets[basename] = rel;
  }

  return { version: 1, generatedAt: new Date().toISOString(), notes, backlinks, assets };
}

const SYNC_CHUNK_SIZE = 200;

async function requestUploadUrlsChunk(
  apiEndpoint: string,
  accessToken: string,
  lexiconSlug: string,
  fileList: Array<{ path: string; contentType?: string }>,
): Promise<SyncResponse> {
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
    let message: string;
    try {
      const body = JSON.parse(text) as { error?: string };
      message = body.error ?? `HTTP ${res.status}`;
    } catch {
      message = text.trim() || `HTTP ${res.status}`;
    }
    throw new Error(message);
  }
  return res.json() as Promise<SyncResponse>;
}

async function requestUploadUrls(
  apiEndpoint: string,
  accessToken: string,
  lexiconSlug: string,
  fileList: Array<{ path: string; contentType?: string }>,
): Promise<SyncResponse> {
  if (fileList.length <= SYNC_CHUNK_SIZE) {
    return requestUploadUrlsChunk(apiEndpoint, accessToken, lexiconSlug, fileList);
  }

  const combined: SyncResponse = { uploadUrls: [], existing: {} };
  for (let i = 0; i < fileList.length; i += SYNC_CHUNK_SIZE) {
    const chunk = fileList.slice(i, i + SYNC_CHUNK_SIZE);
    const result = await requestUploadUrlsChunk(apiEndpoint, accessToken, lexiconSlug, chunk);
    combined.uploadUrls.push(...result.uploadUrls);
    Object.assign(combined.existing, result.existing);
  }
  return combined;
}

export const syncCommand = new Command("sync")
  .description("Sync a local directory of markdown files to a Pensieve lexicon.")
  .usage("<dir> --lexicon <slug> [--dry-run]")
  .argument("[dir]", "Local directory of markdown files to sync")
  .option("-l, --lexicon <slug>", "Slug of the target lexicon (from /dashboard)")
  .option("--dry-run", "List files that would be uploaded without uploading anything")
  .addHelpText("after", `
Examples:
  pensieve sync ./notes --lexicon my-lexicon
  pensieve sync /Users/you/notes --lexicon my-lexicon --dry-run`)
  .action(async (dir: string | undefined, opts: { lexicon?: string; dryRun?: boolean }) => {
    if (!dir) {
      dir = await input({ message: "Directory to sync (e.g. ./notes or /Users/you/notes):" });
    }
    if (!opts.lexicon) {
      opts.lexicon = await input({ message: "Lexicon slug (lowercase, hyphens only, e.g. my-lexicon):" });
    }
    const absDir = path.resolve(dir);
    if (!fs.existsSync(absDir)) {
      console.error(chalk.red(`Directory not found: ${absDir}`));
      process.exitCode = 1; return;
    }

    const apiEndpoint = config.get("apiEndpoint");
    let accessToken = config.get("accessToken");

    if (!apiEndpoint) {
      console.error(chalk.red("Not configured. Run `pensieve config init`."));
      process.exitCode = 1; return;
    }
    if (!accessToken) {
      console.error(chalk.red("Not logged in. Run `pensieve login` first."));
      process.exitCode = 1; return;
    }

    // ── Verify auth before scanning ──────────────────────────────────────────
    const authCheck = await fetch(`${apiEndpoint}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => null);
    if (!authCheck || authCheck.status === 401) {
      console.error(chalk.red("Not logged in or session expired. Run `pensieve login` first."));
      process.exitCode = 1; return;
    }

    // ── Scan vault ──────────────────────────────────────────────────────────
    const scanSpinner = ora("Scanning vault...").start();
    const { mdFiles, assetFiles } = scanVault(absDir);
    scanSpinner.succeed(`Found ${mdFiles.length} notes, ${assetFiles.length} assets`);

    if (mdFiles.length === 0) {
      console.log("Nothing to sync.");
      return;
    }

    // ── Build manifest ───────────────────────────────────────────────────────
    const manifestSpinner = ora("Building manifest...").start();
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
      console.log(chalk.cyan(`\nWould sync to lexicon "${opts.lexicon}":`));
      for (const f of allFiles.filter(f => f.path !== "_manifest.json")) {
        console.log(`  ${f.path}`);
      }
      return;
    }

    // ── Request presigned URLs ───────────────────────────────────────────────
    const urlSpinner = ora("Requesting upload URLs...").start();
    let syncData: SyncResponse;
    try {
      syncData = await requestUploadUrls(apiEndpoint, accessToken!, opts.lexicon, fileList);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "UNAUTHORIZED") {
        urlSpinner.stop();
        console.log(chalk.yellow("Session expired — please log in again."));
        config.delete("accessToken");
        const { runSetupIfNeeded } = await import("../lib/setup-wizard");
        await runSetupIfNeeded();
        accessToken = config.get("accessToken");
        try {
          syncData = await requestUploadUrls(apiEndpoint, accessToken!, opts.lexicon, fileList);
        } catch (retryErr: unknown) {
          urlSpinner.fail("Failed to get upload URLs");
          console.error(chalk.red(retryErr instanceof Error ? retryErr.message : String(retryErr)));
          process.exitCode = 1; return;
        }
      } else {
        urlSpinner.fail("Failed to get upload URLs");
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("fetch failed") || msg.toLowerCase().includes("econnrefused") || msg.toLowerCase().includes("enotfound")) {
          console.error(chalk.red("Could not reach the Pensieve server. Check your internet connection or run `pensieve config init` to verify your API endpoint."));
        } else {
          console.error(chalk.red(msg));
        }
        process.exitCode = 1; return;
      }
    }
    urlSpinner.succeed("Ready to upload");

    const urlMap = new Map(syncData.uploadUrls.map((u) => [u.path, u.uploadUrl]));
    let uploaded = 0;
    let skipped = 0;

    // ── Upload files ─────────────────────────────────────────────────────────
    for (const file of allFiles) {
      const uploadUrl = urlMap.get(file.path);
      if (!uploadUrl) continue;

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
        console.error(chalk.red(`  ✗ ${file.path} (HTTP ${putRes.status})`));
      } else {
        if (file.path !== "_manifest.json") {
          console.log(chalk.green(`  ↑ ${file.path}`));
        }
        uploaded++;
      }
    }

    console.log(chalk.bold(`\nSync complete: ${uploaded} uploaded, ${skipped} unchanged.`));
  });
