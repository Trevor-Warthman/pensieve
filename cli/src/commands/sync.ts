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

  for (const file of mdFiles) {
    const rel = path.relative(absDir, file).replace(/\\/g, "/");
    const slug = rel.replace(/\.md$/, "");

    try {
      const { data, content } = matter.read(file);
      const title = (data.title as string) ?? slug.split("/").pop() ?? "Untitled";
      const tags = Array.isArray(data.tags) ? (data.tags as string[]) : [];
      notes.push({ slug, title, tags });

      wikilinkRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = wikilinkRegex.exec(content)) !== null) {
        const target = match[1].trim().toLowerCase();
        if (!backlinks[target]) backlinks[target] = [];
        if (!backlinks[target].includes(slug)) backlinks[target].push(slug);
      }
    } catch {
      // skip unparseable files
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

async function requestUploadUrls(
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
    const body = await res.json() as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<SyncResponse>;
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
      process.exit(1);
    }

    const apiEndpoint = config.get("apiEndpoint");
    let accessToken = config.get("accessToken");

    if (!apiEndpoint) {
      console.error(chalk.red("Not configured. Run `pensieve config init`."));
      process.exit(1);
    }
    if (!accessToken) {
      console.error(chalk.red("Not logged in. Run `pensieve login` first."));
      process.exit(1);
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
        urlSpinner.text = "Session expired — re-authenticating...";
        config.delete("accessToken");
        const { runSetupIfNeeded } = await import("../lib/setup-wizard");
        await runSetupIfNeeded();
        accessToken = config.get("accessToken");
        try {
          syncData = await requestUploadUrls(apiEndpoint, accessToken!, opts.lexicon, fileList);
        } catch (retryErr: unknown) {
          urlSpinner.fail("Failed to get upload URLs");
          console.error(chalk.red(retryErr instanceof Error ? retryErr.message : String(retryErr)));
          process.exit(1);
        }
      } else {
        urlSpinner.fail("Failed to get upload URLs");
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
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
