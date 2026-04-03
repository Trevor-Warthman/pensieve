import { select, input, password, confirm } from "@inquirer/prompts";
import { execSync } from "child_process";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import chalk from "chalk";
import { config } from "../config";

function isLocalhost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

async function configureEndpoint(): Promise<void> {
  const mode = await select({
    message: "Are you connecting to a local dev server or production?",
    choices: [
      { name: "Local dev  (http://localhost:…)", value: "local" },
      { name: "Production (deployed infrastructure)", value: "prod" },
    ],
  });

  if (mode === "local") {
    const url = await input({
      message: "Local API endpoint:",
      default: "http://localhost:3001/api",
    });
    config.set("apiEndpoint", url);
    console.log(chalk.green("API endpoint saved."));
    return;
  }

  const fromTf = await confirm({
    message: "Read config from `terraform output -json`?",
    default: true,
  });

  if (fromTf) {
    const dir = await input({
      message: "Path to infra directory:",
      default: "./infra",
    });
    try {
      const json = execSync("terraform output -json", { cwd: dir, encoding: "utf8" });
      const output = JSON.parse(json) as Record<string, { value: string }>;
      const get = (key: string) => output[key]?.value;
      if (get("api_endpoint")) config.set("apiEndpoint", get("api_endpoint"));
      if (get("cognito_user_pool_id")) config.set("cognitoUserPoolId", get("cognito_user_pool_id"));
      if (get("cognito_client_id")) config.set("cognitoClientId", get("cognito_client_id"));
      if (get("s3_bucket_name")) config.set("s3Bucket", get("s3_bucket_name"));
      console.log(chalk.green("Config loaded from Terraform."));
    } catch (err) {
      console.error(chalk.red(`terraform output failed: ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
    return;
  }

  const url = await input({ message: "API endpoint URL:" });
  const poolId = await input({ message: "Cognito User Pool ID:" });
  const clientId = await input({ message: "Cognito User Pool Client ID:" });
  config.set("apiEndpoint", url);
  config.set("cognitoUserPoolId", poolId);
  config.set("cognitoClientId", clientId);
  console.log(chalk.green("Config saved."));
}

async function authenticate(): Promise<void> {
  const apiEndpoint = config.get("apiEndpoint")!;
  const local = isLocalhost(apiEndpoint);
  const clientId = config.get("cognitoClientId");

  const action = await select({
    message: "Do you have a Pensieve account?",
    choices: [
      { name: "Yes — log in", value: "login" },
      { name: "No  — register", value: "register" },
    ],
  });

  const email = await input({ message: "Email:" });
  const pass = await password({ message: "Password:" });

  if (action === "register") {
    const res = await fetch(`${apiEndpoint}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });
    const body = await res.json() as { accessToken?: string; message?: string; error?: string };
    if (!res.ok) {
      console.error(chalk.red(body.error ?? "Registration failed"));
      process.exit(1);
    }

    if (local && body.accessToken) {
      storeTokens(body.accessToken, email);
      console.log(chalk.green(`Registered and logged in as ${email}`));
      return;
    }

    console.log(chalk.green(body.message ?? "Check your email for a confirmation code."));
    const code = await input({ message: "Confirmation code:" });
    const confirmRes = await fetch(`${apiEndpoint}/auth/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const confirmBody = await confirmRes.json() as { message?: string; error?: string };
    if (!confirmRes.ok) {
      console.error(chalk.red(confirmBody.error ?? "Confirmation failed"));
      process.exit(1);
    }
    console.log(chalk.green("Email confirmed. Logging you in…"));
  }

  // Login (either directly or after registration)
  if (local) {
    const res = await fetch(`${apiEndpoint}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });
    const body = await res.json() as { accessToken?: string; error?: string };
    if (!res.ok || !body.accessToken) {
      console.error(chalk.red(body.error ?? "Login failed"));
      process.exit(1);
    }
    storeTokens(body.accessToken, email);
  } else {
    if (!clientId) {
      console.error(chalk.red("Missing Cognito client ID. Re-run setup."));
      process.exit(1);
    }
    const client = new CognitoIdentityProviderClient({ region: "us-east-1" });
    const response = await client.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
        AuthParameters: { USERNAME: email, PASSWORD: pass },
      })
    );
    const tokens = response.AuthenticationResult;
    if (!tokens?.AccessToken) {
      console.error(chalk.red("No tokens returned from Cognito"));
      process.exit(1);
    }
    storeTokens(tokens.AccessToken, email, tokens.RefreshToken ?? undefined);
  }

  console.log(chalk.green(`Logged in as ${email}`));
}

function storeTokens(accessToken: string, email: string, refreshToken?: string) {
  config.set("accessToken", accessToken);
  if (refreshToken) config.set("refreshToken", refreshToken);
  config.set("email", email);
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());
    if (payload.sub) config.set("userId", payload.sub);
  } catch {
    // non-fatal
  }
}

export async function runSetupIfNeeded({ requireAuth = true } = {}): Promise<void> {
  const needsConfig = !config.get("apiEndpoint");
  const needsAuth = requireAuth && !config.isAuthenticated();

  if (!needsConfig && !needsAuth) return;

  console.log(chalk.bold("\nWelcome to Pensieve! Let's get you set up.\n"));

  if (needsConfig) {
    await configureEndpoint();
    console.log();
  }

  if (needsAuth) {
    await authenticate();
    console.log();
  }
}
