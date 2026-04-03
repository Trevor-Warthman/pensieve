import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

interface FolderConfig {
  publish?: boolean;
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif"]);
const SKIP_DIRS = new Set([".", "..", ".git", ".obsidian", "node_modules"]);

function readFolderConfig(dir: string): FolderConfig {
  const configPath = path.join(dir, "_folder.yaml");
  if (!fs.existsSync(configPath)) return {};
  try {
    const { data } = matter.read(configPath);
    return data as FolderConfig;
  } catch {
    return {};
  }
}

function shouldPublishFile(filePath: string, folderDefault: boolean): boolean {
  try {
    const { data } = matter.read(filePath);
    if (typeof data.publish === "boolean") return data.publish;
    return folderDefault;
  } catch {
    return folderDefault;
  }
}

export interface ScanResult {
  mdFiles: string[];   // publishable markdown files
  assetFiles: string[]; // images and other assets (always included)
}

export function scanVault(
  rootDir: string,
  currentDir: string = rootDir,
  parentDefault: boolean = true
): ScanResult {
  const folderConfig = readFolderConfig(currentDir);
  const folderDefault =
    typeof folderConfig.publish === "boolean"
      ? folderConfig.publish
      : parentDefault;

  const mdFiles: string[] = [];
  const assetFiles: string[] = [];
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      const sub = scanVault(rootDir, fullPath, folderDefault);
      mdFiles.push(...sub.mdFiles);
      assetFiles.push(...sub.assetFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === ".md" && entry.name !== "_folder.yaml") {
        if (shouldPublishFile(fullPath, folderDefault)) {
          mdFiles.push(fullPath);
        }
      } else if (IMAGE_EXTENSIONS.has(ext)) {
        assetFiles.push(fullPath);
      }
    }
  }

  return { mdFiles, assetFiles };
}

/** @deprecated Use scanVault instead */
export function getPublishableFiles(rootDir: string): string[] {
  return scanVault(rootDir).mdFiles;
}
