import { Command } from "commander";
import { input, password } from "@inquirer/prompts";
import { config } from "../config";
import chalk from "chalk";

export const registerCommand = new Command("register")
  .description("Create a new Pensieve account")
  .action(async () => {
    const apiEndpoint = config.get("apiEndpoint");
    if (!apiEndpoint) {
      console.log(
        chalk.yellow("Pensieve is not configured yet. Run `pensieve config init` after deploying infrastructure.")
      );
      return;
    }

    const email = await input({ message: "Email:" });
    const pass = await password({ message: "Password:" });

    try {
      const regRes = await fetch(`${apiEndpoint}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });

      const regBody = await regRes.json() as { message?: string; error?: string };
      if (!regRes.ok) throw new Error(regBody.error ?? "Registration failed");
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
