"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginCommand = void 0;
const commander_1 = require("commander");
const prompts_1 = require("@inquirer/prompts");
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
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
exports.loginCommand = new commander_1.Command("login")
    .description("Authenticate with Pensieve")
    .option("--local", "Use local dev server instead of Cognito (localhost only, not for production use)")
    .action(async (opts) => {
    const apiEndpoint = config_1.config.get("apiEndpoint");
    const clientId = config_1.config.get("cognitoClientId");
    if (opts.local) {
        if (!apiEndpoint || !isLocalhost(apiEndpoint)) {
            console.error(chalk_1.default.red("--local requires apiEndpoint to be a localhost URL. This flag is for local development only."));
            process.exit(1);
        }
        const email = await (0, prompts_1.input)({ message: "Email:" });
        const pass = await (0, prompts_1.password)({ message: "Password:" });
        try {
            const res = await fetch(`${apiEndpoint}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password: pass }),
            });
            const body = await res.json();
            if (!res.ok || !body.accessToken)
                throw new Error(body.error ?? `HTTP ${res.status}`);
            storeTokens(body.accessToken, email);
            console.log(chalk_1.default.green(`Logged in as ${email}`));
        }
        catch (err) {
            console.error(chalk_1.default.red(`Login failed: ${err instanceof Error ? err.message : String(err)}`));
            process.exit(1);
        }
        return;
    }
    if (!clientId) {
        console.log(chalk_1.default.yellow("Pensieve is not configured yet. Run `pensieve config init` once infrastructure is deployed."));
        return;
    }
    const email = await (0, prompts_1.input)({ message: "Email:" });
    const pass = await (0, prompts_1.password)({ message: "Password:" });
    const client = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({ region: "us-east-1" });
    try {
        const response = await client.send(new client_cognito_identity_provider_1.InitiateAuthCommand({
            AuthFlow: "USER_PASSWORD_AUTH",
            ClientId: clientId,
            AuthParameters: { USERNAME: email, PASSWORD: pass },
        }));
        const tokens = response.AuthenticationResult;
        if (!tokens?.AccessToken)
            throw new Error("No tokens returned");
        storeTokens(tokens.AccessToken, email, tokens.RefreshToken ?? undefined);
        console.log(chalk_1.default.green(`Logged in as ${email}`));
    }
    catch (err) {
        console.error(chalk_1.default.red(`Login failed: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
    }
});
