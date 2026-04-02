import { Command } from "commander";
import { input, password } from "@inquirer/prompts";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { config } from "../config";
import chalk from "chalk";

function isLocalhost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
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

export const loginCommand = new Command("login")
  .description("Authenticate with Pensieve")
  .option("--local", "Use local dev server instead of Cognito (localhost only, not for production use)")
  .action(async (opts: { local?: boolean }) => {
    const apiEndpoint = config.get("apiEndpoint");
    const clientId = config.get("cognitoClientId");

    if (opts.local) {
      if (!apiEndpoint || !isLocalhost(apiEndpoint)) {
        console.error(chalk.red("--local requires apiEndpoint to be a localhost URL. This flag is for local development only."));
        process.exit(1);
      }

      const email = await input({ message: "Email:" });
      const pass = await password({ message: "Password:" });

      try {
        const res = await fetch(`${apiEndpoint}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pass }),
        });
        const body = await res.json() as { accessToken?: string; error?: string };
        if (!res.ok || !body.accessToken) throw new Error(body.error ?? `HTTP ${res.status}`);
        storeTokens(body.accessToken, email);
        console.log(chalk.green(`Logged in as ${email}`));
      } catch (err: unknown) {
        console.error(chalk.red(`Login failed: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
      return;
    }

    if (!clientId) {
      console.log(
        chalk.yellow(
          "Pensieve is not configured yet. Run `pensieve config init` once infrastructure is deployed."
        )
      );
      return;
    }

    const email = await input({ message: "Email:" });
    const pass = await password({ message: "Password:" });

    const client = new CognitoIdentityProviderClient({ region: "us-east-1" });

    try {
      const response = await client.send(
        new InitiateAuthCommand({
          AuthFlow: "USER_PASSWORD_AUTH",
          ClientId: clientId,
          AuthParameters: { USERNAME: email, PASSWORD: pass },
        })
      );

      const tokens = response.AuthenticationResult;
      if (!tokens?.AccessToken) throw new Error("No tokens returned");
      storeTokens(tokens.AccessToken, email, tokens.RefreshToken ?? undefined);
      console.log(chalk.green(`Logged in as ${email}`));
    } catch (err: unknown) {
      console.error(chalk.red(`Login failed: ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });
