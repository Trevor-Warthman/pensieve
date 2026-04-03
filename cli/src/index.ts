#!/usr/bin/env node
import { Command } from "commander";
import { loginCommand } from "./commands/login";
import { registerCommand } from "./commands/register";
import { syncCommand } from "./commands/sync";
import { configCommand } from "./commands/config";

const program = new Command();

program
  .name("pensieve")
  .description("Sync your markdown notes to a Pensieve lexicon")
  .version("0.1.0");

program.addCommand(loginCommand);
program.addCommand(registerCommand);
program.addCommand(syncCommand);
program.addCommand(configCommand);

for (const cmd of [loginCommand, registerCommand]) {
  cmd.hook("preAction", async () => {
    const { runSetupIfNeeded } = await import("./lib/setup-wizard");
    await runSetupIfNeeded({ requireAuth: false });
  });
}

syncCommand.hook("preAction", async () => {
  const { runSetupIfNeeded } = await import("./lib/setup-wizard");
  await runSetupIfNeeded();
});

program
  .command("logout")
  .description("Clear stored credentials")
  .action(async () => {
    const { config } = await import("./config");
    config.clear();
    console.log("Logged out.");
  });

program.parse(process.argv);
