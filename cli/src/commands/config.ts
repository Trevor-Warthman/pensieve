import { Command } from "commander";
import { execSync } from "child_process";
import { config } from "../config";
import chalk from "chalk";

export const configCommand = new Command("config")
  .description("Manage CLI configuration");

configCommand
  .command("init")
  .description("Set the API endpoint and credentials. Local dev: --api-endpoint http://localhost:3000/api. Production: use --from-terraform or pass Cognito values manually.")
  .option("--api-endpoint <url>", "API endpoint URL (e.g. http://localhost:3000/api for local dev, or API Gateway URL for prod)")
  .option("--cognito-pool-id <id>", "Cognito User Pool ID (production only)")
  .option("--cognito-client-id <id>", "Cognito User Pool Client ID (production only)")
  .option("--s3-bucket <bucket>", "S3 content bucket name (production only)")
  .option("--from-terraform [dir]", "Read all values from `terraform output -json` (optional path to infra dir, defaults to cwd)")
  .action((opts: {
    apiEndpoint?: string;
    cognitoPoolId?: string;
    cognitoClientId?: string;
    s3Bucket?: string;
    fromTerraform?: string | boolean;
  }) => {
    if (opts.fromTerraform !== undefined) {
      const dir = typeof opts.fromTerraform === "string" ? opts.fromTerraform : process.cwd();
      let output: Record<string, { value: string }>;
      try {
        const json = execSync("terraform output -json", { cwd: dir, encoding: "utf8" });
        output = JSON.parse(json);
      } catch (err) {
        console.error(chalk.red(`Failed to run terraform output: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }

      const get = (key: string) => output[key]?.value;
      if (get("api_endpoint")) config.set("apiEndpoint", get("api_endpoint"));
      if (get("cognito_user_pool_id")) config.set("cognitoUserPoolId", get("cognito_user_pool_id"));
      if (get("cognito_client_id")) config.set("cognitoClientId", get("cognito_client_id"));
      if (get("s3_bucket_name")) config.set("s3Bucket", get("s3_bucket_name"));

      console.log(chalk.green("Config loaded from Terraform outputs:"));
      console.log(config.getAll());
      return;
    }

    if (opts.apiEndpoint) config.set("apiEndpoint", opts.apiEndpoint);
    if (opts.cognitoPoolId) config.set("cognitoUserPoolId", opts.cognitoPoolId);
    if (opts.cognitoClientId) config.set("cognitoClientId", opts.cognitoClientId);
    if (opts.s3Bucket) config.set("s3Bucket", opts.s3Bucket);
    console.log(chalk.green("Config saved:"));
    console.log(config.getAll());
  });

configCommand
  .command("show")
  .description("Show current config")
  .action(() => {
    const all = config.getAll();
    if (Object.keys(all).length === 0) {
      console.log(chalk.yellow("No config set. Run `pensieve config init` first."));
    } else {
      console.log(all);
    }
  });
