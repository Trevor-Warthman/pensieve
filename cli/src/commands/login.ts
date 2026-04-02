import { Command } from "commander";
import { input, password } from "@inquirer/prompts";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { config } from "../config";
import chalk from "chalk";

export const loginCommand = new Command("login")
  .description("Authenticate with Pensieve")
  .action(async () => {
    const clientId = config.get("cognitoClientId");
    if (!clientId) {
      console.log(
        chalk.yellow(
          "Pensieve is not configured yet. Run `pensieve config set` once infrastructure is deployed."
        )
      );
      // TODO: remove stub once infra is deployed and outputs are wired
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
          AuthParameters: {
            USERNAME: email,
            PASSWORD: pass,
          },
        })
      );

      const tokens = response.AuthenticationResult;
      if (!tokens?.AccessToken) throw new Error("No tokens returned");

      config.set("accessToken", tokens.AccessToken);
      config.set("refreshToken", tokens.RefreshToken ?? undefined);
      config.set("email", email);

      // Decode JWT payload to extract userId (sub claim)
      try {
        const payload = JSON.parse(
          Buffer.from(tokens.AccessToken.split(".")[1], "base64url").toString()
        );
        if (payload.sub) config.set("userId", payload.sub);
      } catch {
        // non-fatal — userId will be missing until next login
      }

      console.log(chalk.green(`Logged in as ${email}`));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`Login failed: ${message}`));
      process.exit(1);
    }
  });
