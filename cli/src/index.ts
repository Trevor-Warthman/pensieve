#!/usr/bin/env node
import { Command } from "commander";
import { loginCommand } from "./commands/login";
import { registerCommand } from "./commands/register";
import { syncCommand } from "./commands/sync";
import { configCommand } from "./commands/config";
import { publishCommand, unpublishCommand } from "./commands/publish";

const program = new Command();

program
  .name("pensieve")
  .description("Sync your markdown notes to a Pensieve lexicon")
  .version("0.1.0");

program.addCommand(loginCommand);
program.addCommand(registerCommand);
program.addCommand(syncCommand);
program.addCommand(configCommand);
program.addCommand(publishCommand);
program.addCommand(unpublishCommand);

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

// Kick off the update check before parse so it runs in the background while
// the command executes, then print any warning once the command completes.
const updateCheckPromise = import("./lib/update-check").then(({ checkForUpdate }) =>
  checkForUpdate().catch(() => null)
);

program.hook("postAction", async () => {
  const warning = await updateCheckPromise;
  if (warning) console.log(warning);
});

program.parse(process.argv);
