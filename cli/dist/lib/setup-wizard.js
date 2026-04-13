"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSetupIfNeeded = runSetupIfNeeded;
const prompts_1 = require("@inquirer/prompts");
const child_process_1 = require("child_process");
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const chalk_1 = __importDefault(require("chalk"));
const config_1 = require("../config");
function isLocalhost(url) {
    try {
        const { hostname } = new URL(url);
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    }
    catch {
        return false;
    }
}
async function configureEndpoint() {
    const mode = await (0, prompts_1.select)({
        message: "Are you connecting to a local dev server or production?",
        choices: [
            { name: "Local dev  (http://localhost:…)", value: "local" },
            { name: "Production (deployed infrastructure)", value: "prod" },
        ],
    });
    if (mode === "local") {
        const url = await (0, prompts_1.input)({
            message: "Local API endpoint:",
            default: "http://localhost:3001/api",
        });
        config_1.config.set("apiEndpoint", url);
        console.log(chalk_1.default.green("API endpoint saved."));
        return;
    }
    const fromTf = await (0, prompts_1.confirm)({
        message: "Read config from `terraform output -json`?",
        default: true,
    });
    if (fromTf) {
        const dir = await (0, prompts_1.input)({
            message: "Path to infra directory:",
            default: "./infra",
        });
        try {
            const json = (0, child_process_1.execSync)("terraform output -json", { cwd: dir, encoding: "utf8" });
            const output = JSON.parse(json);
            const get = (key) => output[key]?.value;
            if (get("api_endpoint"))
                config_1.config.set("apiEndpoint", get("api_endpoint"));
            if (get("cognito_user_pool_id"))
                config_1.config.set("cognitoUserPoolId", get("cognito_user_pool_id"));
            if (get("cognito_client_id"))
                config_1.config.set("cognitoClientId", get("cognito_client_id"));
            if (get("s3_bucket_name"))
                config_1.config.set("s3Bucket", get("s3_bucket_name"));
            console.log(chalk_1.default.green("Config loaded from Terraform."));
        }
        catch (err) {
            console.error(chalk_1.default.red(`terraform output failed: ${err instanceof Error ? err.message : String(err)}`));
            process.exit(1);
        }
        return;
    }
    const url = await (0, prompts_1.input)({ message: "API endpoint URL:" });
    const poolId = await (0, prompts_1.input)({ message: "Cognito User Pool ID:" });
    const clientId = await (0, prompts_1.input)({ message: "Cognito User Pool Client ID:" });
    config_1.config.set("apiEndpoint", url);
    config_1.config.set("cognitoUserPoolId", poolId);
    config_1.config.set("cognitoClientId", clientId);
    console.log(chalk_1.default.green("Config saved."));
}
async function authenticate() {
    const apiEndpoint = config_1.config.get("apiEndpoint");
    const local = isLocalhost(apiEndpoint);
    const clientId = config_1.config.get("cognitoClientId");
    const action = await (0, prompts_1.select)({
        message: "Do you have a Pensieve account?",
        choices: [
            { name: "Yes — log in", value: "login" },
            { name: "No  — register", value: "register" },
        ],
    });
    const email = await (0, prompts_1.input)({ message: "Email:" });
    const pass = await (0, prompts_1.password)({ message: "Password:" });
    if (action === "register") {
        const res = await fetch(`${apiEndpoint}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: pass }),
        });
        const body = await res.json();
        if (!res.ok) {
            console.error(chalk_1.default.red(body.error ?? "Registration failed"));
            process.exit(1);
        }
        if (local && body.accessToken) {
            storeTokens(body.accessToken, email);
            console.log(chalk_1.default.green(`Registered and logged in as ${email}`));
            return;
        }
        console.log(chalk_1.default.green(body.message ?? "Check your email for a confirmation code."));
        const code = await (0, prompts_1.input)({ message: "Confirmation code:" });
        const confirmRes = await fetch(`${apiEndpoint}/auth/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code }),
        });
        const confirmBody = await confirmRes.json();
        if (!confirmRes.ok) {
            console.error(chalk_1.default.red(confirmBody.error ?? "Confirmation failed"));
            process.exit(1);
        }
        console.log(chalk_1.default.green("Email confirmed. Logging you in…"));
    }
    // Login (either directly or after registration)
    if (local) {
        const res = await fetch(`${apiEndpoint}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: pass }),
        });
        const body = await res.json();
        if (!res.ok || !body.accessToken) {
            console.error(chalk_1.default.red(body.error ?? "Login failed"));
            process.exit(1);
        }
        storeTokens(body.accessToken, email);
    }
    else {
        if (!clientId) {
            console.error(chalk_1.default.red("Missing Cognito client ID. Re-run setup."));
            process.exit(1);
        }
        const client = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({ region: "us-east-1" });
        const response = await client.send(new client_cognito_identity_provider_1.InitiateAuthCommand({
            AuthFlow: "USER_PASSWORD_AUTH",
            ClientId: clientId,
            AuthParameters: { USERNAME: email, PASSWORD: pass },
        }));
        const tokens = response.AuthenticationResult;
        if (!tokens?.AccessToken) {
            console.error(chalk_1.default.red("No tokens returned from Cognito"));
            process.exit(1);
        }
        storeTokens(tokens.AccessToken, email, tokens.RefreshToken ?? undefined);
    }
    console.log(chalk_1.default.green(`Logged in as ${email}`));
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
async function runSetupIfNeeded({ requireAuth = true } = {}) {
    const needsConfig = !config_1.config.get("apiEndpoint");
    const needsAuth = requireAuth && !config_1.config.isAuthenticated();
    if (!needsConfig && !needsAuth)
        return;
    console.log(chalk_1.default.bold("\nWelcome to Pensieve! Let's get you set up.\n"));
    if (needsConfig) {
        await configureEndpoint();
        console.log();
    }
    if (needsAuth) {
        await authenticate();
        console.log();
    }
}
