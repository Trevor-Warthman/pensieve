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
exports.loginCommand = void 0;
const commander_1 = require("commander");
const config_1 = require("../config");
const chalk_1 = __importDefault(require("chalk"));
function isLocalhost(url) {
    try {
        const { hostname } = new URL(url);
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    }
    catch {
        return false;
    }
}
function storeTokens(accessToken, email, refreshToken) {
    config_1.config.set("accessToken", accessToken);
    if (refreshToken)
        config_1.config.set("refreshToken", refreshToken);
    config_1.config.set("email", email);
    try {
        const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());
        if (payload.sub)
            config_1.config.set("userId", payload.sub);
    }
    catch {
        // non-fatal
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
exports.loginCommand = new commander_1.Command("login")
    .description("Authenticate with Pensieve")
    .action(async () => {
    const apiEndpoint = config_1.config.get("apiEndpoint");
    if (!apiEndpoint) {
        console.log(chalk_1.default.yellow("Pensieve is not configured yet. Run `pensieve config init` once infrastructure is deployed."));
        return;
    }
    const startRes = await fetch(`${apiEndpoint}/device/code`, { method: "POST" });
    if (!startRes.ok) {
        console.error(chalk_1.default.red(`Login failed: could not start device login (HTTP ${startRes.status})`));
        process.exit(1);
    }
    const start = await startRes.json();
    console.log();
    if (isLocalhost(apiEndpoint)) {
        const port = new URL(start.verificationUri).port || "80";
        console.log(chalk_1.default.yellow("apiEndpoint is a local dev server — not reachable from another machine directly."));
        console.log(chalk_1.default.yellow(`If you're opening this link from a different device, tunnel first:`));
        console.log(chalk_1.default.cyan(`  ssh -L ${port}:localhost:${port} <this-host>`));
        console.log();
    }
    console.log(chalk_1.default.bold(`Open: ${chalk_1.default.cyan(start.verificationUri)}`));
    console.log(`Enter code: ${chalk_1.default.bold.yellow(start.userCode)}\n`);
    // Best-effort: pop a browser if one exists. Never block or fail on this —
    // must work identically on a headless box (link/code still printed above).
    try {
        const open = (await Promise.resolve().then(() => __importStar(require("open")))).default;
        await open(start.verificationUriComplete);
    }
    catch {
        // no browser available, ignore
    }
    const deadline = Date.now() + start.expiresIn * 1000;
    while (Date.now() < deadline) {
        await sleep(start.interval * 1000);
        const pollRes = await fetch(`${apiEndpoint}/device/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceCode: start.deviceCode }),
        });
        const pollBody = await pollRes.json();
        if (pollRes.ok && pollBody.accessToken && pollBody.email) {
            storeTokens(pollBody.accessToken, pollBody.email, pollBody.refreshToken);
            console.log(chalk_1.default.green(`Logged in as ${pollBody.email}`));
            return;
        }
        if (pollBody.error === "authorization_pending")
            continue;
        console.error(chalk_1.default.red(`Login failed: ${pollBody.error ?? `HTTP ${pollRes.status}`}`));
        process.exit(1);
    }
    console.error(chalk_1.default.red("Login timed out. Run `pensieve login` again."));
    process.exit(1);
});
