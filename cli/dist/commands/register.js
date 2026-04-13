"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommand = void 0;
const commander_1 = require("commander");
const prompts_1 = require("@inquirer/prompts");
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
exports.registerCommand = new commander_1.Command("register")
    .description("Create a new Pensieve account")
    .option("--local", "Use local dev server (skips email confirmation, localhost only, not for production use)")
    .action(async (opts) => {
    const apiEndpoint = config_1.config.get("apiEndpoint");
    if (!apiEndpoint) {
        console.log(chalk_1.default.yellow("Pensieve is not configured yet. Run `pensieve config init` after deploying infrastructure."));
        return;
    }
    if (opts.local && !isLocalhost(apiEndpoint)) {
        console.error(chalk_1.default.red("--local requires apiEndpoint to be a localhost URL. This flag is for local development only."));
        process.exit(1);
    }
    const email = await (0, prompts_1.input)({ message: "Email:" });
    const pass = await (0, prompts_1.password)({ message: "Password:" });
    try {
        const regRes = await fetch(`${apiEndpoint}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: pass }),
        });
        const regBody = await regRes.json();
        if (!regRes.ok)
            throw new Error(regBody.error ?? "Registration failed");
        if (opts.local) {
            // Local dev: registration returns a JWT directly, no email confirmation
            if (regBody.accessToken) {
                config_1.config.set("accessToken", regBody.accessToken);
                config_1.config.set("email", email);
                try {
                    const payload = JSON.parse(Buffer.from(regBody.accessToken.split(".")[1], "base64url").toString());
                    if (payload.sub)
                        config_1.config.set("userId", payload.sub);
                }
                catch { /* non-fatal */ }
                console.log(chalk_1.default.green(`Registered and logged in as ${email}`));
            }
            else {
                console.log(chalk_1.default.green(regBody.message ?? "Registered. Run `pensieve login --local` to authenticate."));
            }
            return;
        }
        console.log(chalk_1.default.green(regBody.message ?? "Registration successful. Check your email for a confirmation code."));
        const code = await (0, prompts_1.input)({ message: "Confirmation code:" });
        const confirmRes = await fetch(`${apiEndpoint}/auth/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code }),
        });
        const confirmBody = await confirmRes.json();
        if (!confirmRes.ok)
            throw new Error(confirmBody.error ?? "Confirmation failed");
        console.log(chalk_1.default.green(confirmBody.message ?? "Email confirmed. Run `pensieve login` to authenticate."));
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk_1.default.red(`Error: ${message}`));
        process.exit(1);
    }
});
