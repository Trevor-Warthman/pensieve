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
const http_1 = require("http");
const crypto_1 = require("crypto");
const commander_1 = require("commander");
const prompts_1 = require("@inquirer/prompts");
const open_1 = __importDefault(require("open"));
const config_1 = require("../config");
const chalk_1 = __importDefault(require("chalk"));
// Fixed loopback port — must match the callback_urls entry on the Cognito
// app client (infra/cognito.tf). Cognito requires a static, pre-registered
// redirect URI, so this can't be a random ephemeral port.
const CALLBACK_PORT = 53127;
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}/callback`;
function isLocalhost(url) {
    try {
        const { hostname } = new URL(url);
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    }
    catch {
        return false;
    }
}
function decodeJwtClaims(token) {
    try {
        return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    }
    catch {
        return {};
    }
}
function storeTokens(accessToken, email, refreshToken) {
    config_1.config.set("accessToken", accessToken);
    if (refreshToken)
        config_1.config.set("refreshToken", refreshToken);
    config_1.config.set("email", email);
    const payload = decodeJwtClaims(accessToken);
    if (payload.sub)
        config_1.config.set("userId", payload.sub);
}
function base64url(buf) {
    return buf.toString("base64url");
}
/**
 * Waits for the Cognito Hosted UI redirect on the loopback callback server
 * and resolves with the authorization code, or rejects on error/state
 * mismatch/timeout.
 */
function waitForAuthCode(expectedState) {
    return new Promise((resolve, reject) => {
        const server = (0, http_1.createServer)((req, res) => {
            const url = new URL(req.url ?? "/", REDIRECT_URI);
            if (url.pathname !== "/callback") {
                res.writeHead(404).end();
                return;
            }
            const code = url.searchParams.get("code");
            const state = url.searchParams.get("state");
            const error = url.searchParams.get("error");
            res.writeHead(200, { "Content-Type": "text/html" });
            if (error || !code || state !== expectedState) {
                res.end(`<html><body>Login failed (${error ?? "invalid response"}). You can close this tab.</body></html>`);
                server.close();
                reject(new Error(error ?? "Invalid or missing authorization code/state"));
                return;
            }
            res.end("<html><body>Logged in — you can close this tab and return to the terminal.</body></html>");
            server.close();
            resolve(code);
        });
        server.on("error", reject);
        const timeout = setTimeout(() => {
            server.close();
            reject(new Error("Timed out waiting for browser login (5 min)"));
        }, 5 * 60 * 1000);
        server.on("close", () => clearTimeout(timeout));
        server.listen(CALLBACK_PORT, "127.0.0.1");
    });
}
async function loginWithBrowser() {
    const clientId = config_1.config.get("cognitoClientId");
    const domain = config_1.config.get("cognitoDomain");
    if (!clientId || !domain) {
        console.log(chalk_1.default.yellow("Pensieve is not configured yet. Run `pensieve config init` once infrastructure is deployed."));
        return;
    }
    const verifier = base64url((0, crypto_1.randomBytes)(32));
    const challenge = base64url((0, crypto_1.createHash)("sha256").update(verifier).digest());
    const state = base64url((0, crypto_1.randomBytes)(16));
    const authorizeUrl = new URL(`https://${domain}/oauth2/authorize`);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authorizeUrl.searchParams.set("scope", "openid email profile");
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("state", state);
    console.log(chalk_1.default.cyan("Opening browser to log in..."));
    console.log(chalk_1.default.dim(`If it doesn't open automatically, visit:\n${authorizeUrl.toString()}`));
    const codePromise = waitForAuthCode(state);
    await (0, open_1.default)(authorizeUrl.toString());
    const code = await codePromise;
    const tokenRes = await fetch(`https://${domain}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier,
        }),
    });
    const body = (await tokenRes.json());
    if (!tokenRes.ok || !body.access_token) {
        throw new Error(body.error_description ?? body.error ?? `HTTP ${tokenRes.status}`);
    }
    const claims = body.id_token ? decodeJwtClaims(body.id_token) : {};
    const email = typeof claims.email === "string" ? claims.email : "unknown";
    storeTokens(body.access_token, email, body.refresh_token);
    console.log(chalk_1.default.green(`Logged in as ${email}`));
}
exports.loginCommand = new commander_1.Command("login")
    .description("Authenticate with Pensieve")
    .option("--local", "Use local dev server instead of Cognito (localhost only, not for production use)")
    .option("--password", "Use direct Cognito username/password instead of browser login (no TTY needed by Hosted UI, but needs one here)")
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
            const body = (await res.json());
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
    if (opts.password) {
        if (!clientId) {
            console.log(chalk_1.default.yellow("Pensieve is not configured yet. Run `pensieve config init` once infrastructure is deployed."));
            return;
        }
        const { CognitoIdentityProviderClient, InitiateAuthCommand } = await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-cognito-identity-provider")));
        const email = await (0, prompts_1.input)({ message: "Email:" });
        const pass = await (0, prompts_1.password)({ message: "Password:" });
        const client = new CognitoIdentityProviderClient({ region: "us-east-1" });
        try {
            const response = await client.send(new InitiateAuthCommand({
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
        return;
    }
    try {
        await loginWithBrowser();
    }
    catch (err) {
        console.error(chalk_1.default.red(`Login failed: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
    }
});
