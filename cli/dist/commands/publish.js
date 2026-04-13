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
exports.unpublishCommand = exports.publishCommand = void 0;
const commander_1 = require("commander");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const prompts_1 = require("@inquirer/prompts");
const chalk_1 = __importDefault(require("chalk"));
const publish_filter_1 = require("../lib/publish-filter");
async function resolveVaultDir(opt) {
    let vaultDir = opt;
    if (!vaultDir) {
        vaultDir = await (0, prompts_1.input)({ message: "Vault root directory (e.g. ./notes or /Users/you/notes):" });
    }
    const absDir = path.resolve(vaultDir);
    if (!fs.existsSync(absDir)) {
        console.error(chalk_1.default.red(`Vault directory not found: ${absDir}`));
        process.exit(1);
    }
    return absDir;
}
function upsertDirectoryRule(rootDir, dirPath, publish) {
    const cfg = (0, publish_filter_1.readPensieveConfig)(rootDir);
    const dirs = cfg.directories ?? [];
    // Normalize: strip leading/trailing slashes
    const normalized = dirPath.replace(/^\/+|\/+$/g, "");
    const idx = dirs.findIndex((r) => r.path === normalized);
    if (idx >= 0) {
        dirs[idx].publish = publish;
    }
    else {
        dirs.push({ path: normalized, publish });
    }
    (0, publish_filter_1.writePensieveConfig)(rootDir, { ...cfg, directories: dirs });
}
exports.publishCommand = new commander_1.Command("publish")
    .description("Mark a directory as published in pensieve.yaml")
    .argument("<dir>", "Directory path relative to vault root (e.g. notes/public)")
    .option("-v, --vault <path>", "Path to vault root directory")
    .action(async (dir, opts) => {
    const absVault = await resolveVaultDir(opts.vault);
    upsertDirectoryRule(absVault, dir, true);
    console.log(`Config updated. Run \`pensieve sync\` to apply.`);
});
exports.unpublishCommand = new commander_1.Command("unpublish")
    .description("Mark a directory as unpublished in pensieve.yaml")
    .argument("<dir>", "Directory path relative to vault root (e.g. drafts)")
    .option("-v, --vault <path>", "Path to vault root directory")
    .action(async (dir, opts) => {
    const absVault = await resolveVaultDir(opts.vault);
    upsertDirectoryRule(absVault, dir, false);
    console.log(`Config updated. Run \`pensieve sync\` to apply.`);
});
