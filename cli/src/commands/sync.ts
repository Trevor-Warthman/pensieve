import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import chalk from "chalk";
import ora from "ora";
import { input } from "@inquirer/prompts";
import { config } from "../config";
import { getPublishableFiles } from "../lib/publish-filter";

interface SyncResponse {
  uploadUrls: Array<{ path: string; uploadUrl: string; key: string }>;
  existing: Record<string, string>; // relative path -> ETag
}

function md5(filePath: string): string {
  return crypto.createHash("md5").update(fs.readFileSync(filePath)).digest("hex");
}

export const syncCommand = new Command("sync")
  .description("Sync a local directory of markdown files to a Pensieve lexicon. The lexicon must already exist (create it at /dashboard). Re-runs skip unchanged files.")
  .usage("<dir> --lexicon <slug> [--dry-run]")
  .argument("[dir]", "Local directory of markdown files to sync")
  .option("-l, --lexicon <slug>", "Slug of the target lexicon (from /dashboard)")
  .option("--dry-run", "List files that would be uploaded without uploading anything")
  .addHelpText("after", `
Examples:
  pensieve sync ./notes --lexicon my-lexicon
  pensieve sync ./notes --lexicon my-lexicon --dry-run`)
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
    const accessToken = config.get("accessToken");

    if (!apiEndpoint) {
      console.error(chalk.red("Not configured. Run `pensieve config init` after deploying infrastructure."));
      process.exit(1);
    }
    if (!accessToken) {
      console.error(chalk.red("Not logged in. Run `pensieve login` first."));
      process.exit(1);
    }

    const spinner = ora("Scanning files...").start();
    const files = getPublishableFiles(absDir);
    spinner.succeed(`Found ${files.length} publishable files`);

    if (files.length === 0) {
      console.log("Nothing to sync.");
      return;
    }

    const fileList = files.map((f) => ({
      path: path.relative(absDir, f).replace(/\\/g, "/"),
      contentType: f.endsWith(".md") ? "text/markdown; charset=utf-8" : undefined,
    }));

    if (opts.dryRun) {
      console.log(chalk.cyan(`\nWould sync ${files.length} files to lexicon "${opts.lexicon}":`));
      for (const f of fileList) console.log(`  ${f.path}`);
      return;
    }

    // Request presigned upload URLs + existing object list from Lambda
    const urlSpinner = ora("Requesting upload URLs...").start();
    let syncData: SyncResponse;
    try {
      const res = await fetch(`${apiEndpoint}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ lexiconSlug: opts.lexicon, files: fileList }),
      });

      if (res.status === 401) {
        urlSpinner.fail("Session expired — re-authenticating...");
        config.delete("accessToken");
        const { runSetupIfNeeded } = await import("../lib/setup-wizard");
        await runSetupIfNeeded();
        const retryRes = await fetch(`${apiEndpoint}/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.get("accessToken")}`,
          },
          body: JSON.stringify({ lexiconSlug: opts.lexicon, files: fileList }),
        });
        if (!retryRes.ok) {
          const body = await retryRes.json() as { error?: string };
          throw new Error(body.error ?? `HTTP ${retryRes.status}`);
        }
        syncData = await retryRes.json() as SyncResponse;
      } else if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      } else {
        syncData = await res.json() as SyncResponse;
      }
    } catch (err: unknown) {
      urlSpinner.fail("Failed to get upload URLs");
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
    urlSpinner.succeed("Ready to upload");

    const urlMap = new Map(syncData.uploadUrls.map((u) => [u.path, u.uploadUrl]));
    let uploaded = 0;
    let skipped = 0;

    for (const file of fileList) {
      const absPath = path.join(absDir, file.path);
      const uploadUrl = urlMap.get(file.path);
      if (!uploadUrl) continue;

      // Skip if content is unchanged (S3 ETag for single-part upload = MD5 of content)
      const remoteEtag = syncData.existing[file.path];
      if (remoteEtag && md5(absPath) === remoteEtag.replace(/"/g, "")) {
        skipped++;
        continue;
      }

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.contentType ?? "application/octet-stream" },
        body: fs.readFileSync(absPath),
      });

      if (!putRes.ok) {
        console.error(chalk.red(`  ✗ ${file.path} (HTTP ${putRes.status})`));
      } else {
        console.log(chalk.green(`  ↑ ${file.path}`));
        uploaded++;
      }
    }

    console.log(chalk.bold(`\nSync complete: ${uploaded} uploaded, ${skipped} unchanged.`));
  });
