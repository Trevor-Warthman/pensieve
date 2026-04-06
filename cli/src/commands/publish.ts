import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";
import { input } from "@inquirer/prompts";
import chalk from "chalk";
import { readPensieveConfig, writePensieveConfig } from "../lib/publish-filter";

async function resolveVaultDir(opt: string | undefined): Promise<string> {
  let vaultDir = opt;
  if (!vaultDir) {
    vaultDir = await input({ message: "Vault root directory (e.g. ./notes or /Users/you/notes):" });
  }
  const absDir = path.resolve(vaultDir);
  if (!fs.existsSync(absDir)) {
    console.error(chalk.red(`Vault directory not found: ${absDir}`));
    process.exit(1);
  }
  return absDir;
}

function upsertDirectoryRule(rootDir: string, dirPath: string, publish: boolean): void {
  const cfg = readPensieveConfig(rootDir);
  const dirs = cfg.directories ?? [];

  // Normalize: strip leading/trailing slashes
  const normalized = dirPath.replace(/^\/+|\/+$/g, "");

  const idx = dirs.findIndex((r) => r.path === normalized);
  if (idx >= 0) {
    dirs[idx].publish = publish;
  } else {
    dirs.push({ path: normalized, publish });
  }

  writePensieveConfig(rootDir, { ...cfg, directories: dirs });
}

export const publishCommand = new Command("publish")
  .description("Mark a directory as published in pensieve.yaml")
  .argument("<dir>", "Directory path relative to vault root (e.g. notes/public)")
  .option("-v, --vault <path>", "Path to vault root directory")
  .action(async (dir: string, opts: { vault?: string }) => {
    const absVault = await resolveVaultDir(opts.vault);
    upsertDirectoryRule(absVault, dir, true);
    console.log(`Config updated. Run \`pensieve sync\` to apply.`);
  });

export const unpublishCommand = new Command("unpublish")
  .description("Mark a directory as unpublished in pensieve.yaml")
  .argument("<dir>", "Directory path relative to vault root (e.g. drafts)")
  .option("-v, --vault <path>", "Path to vault root directory")
  .action(async (dir: string, opts: { vault?: string }) => {
    const absVault = await resolveVaultDir(opts.vault);
    upsertDirectoryRule(absVault, dir, false);
    console.log(`Config updated. Run \`pensieve sync\` to apply.`);
  });
