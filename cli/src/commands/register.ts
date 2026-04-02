import { Command } from "commander";
import { input, password } from "@inquirer/prompts";
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

export const registerCommand = new Command("register")
  .description("Create a new Pensieve account")
  .option("--local", "Use local dev server (skips email confirmation, localhost only, not for production use)")
  .action(async (opts: { local?: boolean }) => {
    const apiEndpoint = config.get("apiEndpoint");
    if (!apiEndpoint) {
      console.log(
        chalk.yellow("Pensieve is not configured yet. Run `pensieve config init` after deploying infrastructure.")
      );
      return;
    }

    if (opts.local && !isLocalhost(apiEndpoint)) {
      console.error(chalk.red("--local requires apiEndpoint to be a localhost URL. This flag is for local development only."));
      process.exit(1);
    }

    const email = await input({ message: "Email:" });
    const pass = await password({ message: "Password:" });

    try {
      const regRes = await fetch(`${apiEndpoint}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });

      const regBody = await regRes.json() as { accessToken?: string; message?: string; error?: string };
      if (!regRes.ok) throw new Error(regBody.error ?? "Registration failed");

      if (opts.local) {
        // Local dev: registration returns a JWT directly, no email confirmation
        if (regBody.accessToken) {
          config.set("accessToken", regBody.accessToken);
          config.set("email", email);
          try {
            const payload = JSON.parse(Buffer.from(regBody.accessToken.split(".")[1], "base64url").toString());
            if (payload.sub) config.set("userId", payload.sub);
          } catch { /* non-fatal */ }
          console.log(chalk.green(`Registered and logged in as ${email}`));
        } else {
          console.log(chalk.green(regBody.message ?? "Registered. Run `pensieve login --local` to authenticate."));
        }
        return;
      }

      console.log(chalk.green(regBody.message ?? "Registration successful. Check your email for a confirmation code."));

      const code = await input({ message: "Confirmation code:" });

      const confirmRes = await fetch(`${apiEndpoint}/auth/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const confirmBody = await confirmRes.json() as { message?: string; error?: string };
      if (!confirmRes.ok) throw new Error(confirmBody.error ?? "Confirmation failed");

      console.log(chalk.green(confirmBody.message ?? "Email confirmed. Run `pensieve login` to authenticate."));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  });
