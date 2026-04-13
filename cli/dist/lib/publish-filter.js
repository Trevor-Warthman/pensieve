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
exports.readPensieveConfig = readPensieveConfig;
exports.writePensieveConfig = writePensieveConfig;
exports.scanVault = scanVault;
exports.getPublishableFiles = getPublishableFiles;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const gray_matter_1 = __importDefault(require("gray-matter"));
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".weba", ".opus"]);
const SKIP_DIRS = new Set([".", "..", ".git", ".obsidian", "node_modules"]);
function readPensieveConfig(rootDir) {
    const configPath = path.join(rootDir, "pensieve.yaml");
    if (!fs.existsSync(configPath))
        return {};
    try {
        const content = fs.readFileSync(configPath, "utf8");
        const { data } = (0, gray_matter_1.default)(`---\n${content}\n---\n`);
        return data;
    }
    catch {
        return {};
    }
}
function writePensieveConfig(rootDir, cfg) {
    const configPath = path.join(rootDir, "pensieve.yaml");
    const dirs = cfg.directories ?? [];
    let content = "directories:\n";
    if (dirs.length === 0) {
        content += "  []\n";
    }
    else {
        for (const rule of dirs) {
            content += `  - path: ${rule.path}\n    publish: ${rule.publish}\n`;
        }
    }
    fs.writeFileSync(configPath, content, "utf8");
}
/** Find the most specific (longest) directory rule that applies to a given directory path. */
function resolveDirectoryDefault(dirRelPath, rules, globalDefault) {
    let best = null;
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
function shouldPublishFile(filePath, fileDefault) {
    try {
        const { data } = gray_matter_1.default.read(filePath);
        if (typeof data.publish === "boolean")
            return data.publish;
        return fileDefault;
    }
    catch {
        return fileDefault;
    }
}
function scanVault(rootDir, currentDir = rootDir, parentDefault = true, rules) {
    // Read pensieve.yaml once at root level, then thread it through recursion
    if (rules === undefined) {
        rules = readPensieveConfig(rootDir).directories ?? [];
    }
    const mdFiles = [];
    const assetFiles = [];
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name))
            continue;
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            const sub = scanVault(rootDir, fullPath, parentDefault, rules);
            mdFiles.push(...sub.mdFiles);
            assetFiles.push(...sub.assetFiles);
        }
        else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ext === ".md") {
                const dirRelPath = path.relative(rootDir, currentDir).replace(/\\/g, "/");
                const fileDefault = resolveDirectoryDefault(dirRelPath, rules, parentDefault);
                if (shouldPublishFile(fullPath, fileDefault)) {
                    mdFiles.push(fullPath);
                }
            }
            else if (IMAGE_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext)) {
                assetFiles.push(fullPath);
            }
        }
    }
    return { mdFiles, assetFiles };
}
/** @deprecated Use scanVault instead */
function getPublishableFiles(rootDir) {
    return scanVault(rootDir).mdFiles;
}
