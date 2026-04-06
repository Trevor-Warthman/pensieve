import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

interface DirectoryRule {
  path: string;
  publish: boolean;
}

export interface PensieveConfig {
  directories?: DirectoryRule[];
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".weba", ".opus"]);
const SKIP_DIRS = new Set([".", "..", ".git", ".obsidian", "node_modules"]);

export function readPensieveConfig(rootDir: string): PensieveConfig {
  const configPath = path.join(rootDir, "pensieve.yaml");
  if (!fs.existsSync(configPath)) return {};
  try {
    const content = fs.readFileSync(configPath, "utf8");
    const { data } = matter(`---\n${content}\n---\n`);
    return data as PensieveConfig;
  } catch {
    return {};
  }
}

export function writePensieveConfig(rootDir: string, cfg: PensieveConfig): void {
  const configPath = path.join(rootDir, "pensieve.yaml");
  const dirs = cfg.directories ?? [];
  let content = "directories:\n";
  if (dirs.length === 0) {
    content += "  []\n";
  } else {
    for (const rule of dirs) {
      content += `  - path: ${rule.path}\n    publish: ${rule.publish}\n`;
    }
  }
  fs.writeFileSync(configPath, content, "utf8");
}

/** Find the most specific (longest) directory rule that applies to a given directory path. */
function resolveDirectoryDefault(dirRelPath: string, rules: DirectoryRule[], globalDefault: boolean): boolean {
  let best: DirectoryRule | null = null;
  for (const rule of rules) {
    const rulePath = rule.path.replace(/\/$/, "");
    if (dirRelPath === rulePath || dirRelPath.startsWith(rulePath + "/")) {
      if (!best || rulePath.length > best.path.replace(/\/$/, "").length) {
        best = rule;
      }
    }
  }
  return best !== null ? best.publish : globalDefault;
}

function shouldPublishFile(filePath: string, fileDefault: boolean): boolean {
  try {
    const { data } = matter.read(filePath);
    if (typeof data.publish === "boolean") return data.publish;
    return fileDefault;
  } catch {
    return fileDefault;
  }
}

export interface ScanResult {
  mdFiles: string[];   // publishable markdown files
  assetFiles: string[]; // images and other assets (always included)
}

export function scanVault(
  rootDir: string,
  currentDir: string = rootDir,
  parentDefault: boolean = true,
  rules?: DirectoryRule[]
): ScanResult {
  // Read pensieve.yaml once at root level, then thread it through recursion
  if (rules === undefined) {
    rules = readPensieveConfig(rootDir).directories ?? [];
  }

  const mdFiles: string[] = [];
  const assetFiles: string[] = [];
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      const sub = scanVault(rootDir, fullPath, parentDefault, rules);
      mdFiles.push(...sub.mdFiles);
      assetFiles.push(...sub.assetFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === ".md") {
        const dirRelPath = path.relative(rootDir, currentDir).replace(/\\/g, "/");
        const fileDefault = resolveDirectoryDefault(dirRelPath, rules, parentDefault);
        if (shouldPublishFile(fullPath, fileDefault)) {
          mdFiles.push(fullPath);
        }
      } else if (IMAGE_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext)) {
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
