import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

interface FolderConfig {
  publish?: boolean;
}

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

export function getPublishableFiles(
  rootDir: string,
  currentDir: string = rootDir,
  parentDefault: boolean = true
): string[] {
  const folderConfig = readFolderConfig(currentDir);
  const folderDefault =
    typeof folderConfig.publish === "boolean"
      ? folderConfig.publish
      : parentDefault;

  const results: string[] = [];
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      results.push(...getPublishableFiles(rootDir, fullPath, folderDefault));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".md") &&
      entry.name !== "_folder.yaml"
    ) {
      if (shouldPublishFile(fullPath, folderDefault)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}
