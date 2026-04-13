"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configCommand = void 0;
const commander_1 = require("commander");
const child_process_1 = require("child_process");
const config_1 = require("../config");
const chalk_1 = __importDefault(require("chalk"));
// Known production Cognito client ID — set automatically when a prod API endpoint is configured.
// This is not a secret (public-facing client, no secret, ALLOW_USER_PASSWORD_AUTH only).
const PROD_COGNITO_CLIENT_ID = "6dfishamdf578kcamtovkoa3os";
function isLocalhost(url) {
    try {
        const { hostname } = new URL(url);
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    }
    catch {
        return false;
    }
}
exports.configCommand = new commander_1.Command("config")
    .description("Manage CLI configuration");
exports.configCommand
    .command("init")
    .description("Set the API endpoint and credentials. Local dev: --api-endpoint http://localhost:3000/api. Production: use --from-terraform or pass Cognito values manually.")
    .option("--api-endpoint <url>", "API endpoint URL (e.g. http://localhost:3000/api for local dev, or API Gateway URL for prod)")
    .option("--cognito-pool-id <id>", "Cognito User Pool ID (production only)")
    .option("--cognito-client-id <id>", "Cognito User Pool Client ID (production only)")
    .option("--s3-bucket <bucket>", "S3 content bucket name (production only)")
    .option("--from-terraform [dir]", "Read all values from `terraform output -json` (optional path to infra dir, defaults to cwd)")
    .action((opts) => {
    if (opts.fromTerraform !== undefined) {
        const dir = typeof opts.fromTerraform === "string" ? opts.fromTerraform : process.cwd();
        let output;
        try {
            const json = (0, child_process_1.execSync)("terraform output -json", { cwd: dir, encoding: "utf8" });
            output = JSON.parse(json);
        }
        catch (err) {
            console.error(chalk_1.default.red(`Failed to run terraform output: ${err instanceof Error ? err.message : String(err)}`));
            process.exit(1);
        }
        const get = (key) => output[key]?.value;
        if (get("api_endpoint"))
            config_1.config.set("apiEndpoint", get("api_endpoint"));
        if (get("cognito_user_pool_id"))
            config_1.config.set("cognitoUserPoolId", get("cognito_user_pool_id"));
        if (get("cognito_client_id"))
            config_1.config.set("cognitoClientId", get("cognito_client_id"));
        if (get("s3_bucket_name"))
            config_1.config.set("s3Bucket", get("s3_bucket_name"));
        console.log(chalk_1.default.green("Config loaded from Terraform outputs:"));
        console.log(config_1.config.getAll());
        return;
    }
    if (opts.apiEndpoint) {
        config_1.config.set("apiEndpoint", opts.apiEndpoint);
        // Auto-populate the Cognito client ID for prod endpoints so `pensieve login` works
        // without needing to run `--from-terraform` or pass the client ID manually.
        if (!isLocalhost(opts.apiEndpoint) && !opts.cognitoClientId) {
            config_1.config.set("cognitoClientId", PROD_COGNITO_CLIENT_ID);
        }
    }
    if (opts.cognitoPoolId)
        config_1.config.set("cognitoUserPoolId", opts.cognitoPoolId);
    if (opts.cognitoClientId)
        config_1.config.set("cognitoClientId", opts.cognitoClientId);
    if (opts.s3Bucket)
        config_1.config.set("s3Bucket", opts.s3Bucket);
    console.log(chalk_1.default.green("Config saved:"));
    console.log(config_1.config.getAll());
});
exports.configCommand
    .command("show")
    .description("Show current config")
    .action(() => {
    const all = config_1.config.getAll();
    if (Object.keys(all).length === 0) {
        console.log(chalk_1.default.yellow("No config set. Run `pensieve config init` first."));
    }
    else {
        console.log(all);
    }
});
