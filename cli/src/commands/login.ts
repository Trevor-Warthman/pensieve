import { Command } from "commander";
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const loginCommand = new Command("login")
  .description("Authenticate with Pensieve")
  .action(async () => {
    const apiEndpoint = config.get("apiEndpoint");

    if (!apiEndpoint) {
      console.log(
        chalk.yellow(
          "Pensieve is not configured yet. Run `pensieve config init` once infrastructure is deployed."
        )
      );
      return;
    }

    const startRes = await fetch(`${apiEndpoint}/device/code`, { method: "POST" });
    if (!startRes.ok) {
      console.error(chalk.red(`Login failed: could not start device login (HTTP ${startRes.status})`));
      process.exit(1);
    }

    const start = await startRes.json() as {
      deviceCode: string;
      userCode: string;
      verificationUri: string;
      verificationUriComplete: string;
      expiresIn: number;
      interval: number;
    };

    console.log();
    if (isLocalhost(apiEndpoint)) {
      const port = new URL(start.verificationUri).port || "80";
      console.log(chalk.yellow("apiEndpoint is a local dev server — not reachable from another machine directly."));
      console.log(chalk.yellow(`If you're opening this link from a different device, tunnel first:`));
      console.log(chalk.cyan(`  ssh -L ${port}:localhost:${port} <this-host>`));
      console.log();
    }
    console.log(chalk.bold(`Open: ${chalk.cyan(start.verificationUri)}`));
    console.log(`Enter code: ${chalk.bold.yellow(start.userCode)}\n`);

    // Best-effort: pop a browser if one exists. Never block or fail on this —
    // must work identically on a headless box (link/code still printed above).
    try {
      const open = (await import("open")).default;
      await open(start.verificationUriComplete);
    } catch {
      // no browser available, ignore
    }

    const deadline = Date.now() + start.expiresIn * 1000;
    while (Date.now() < deadline) {
      await sleep(start.interval * 1000);

      const pollRes = await fetch(`${apiEndpoint}/device/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceCode: start.deviceCode }),
      });
      const pollBody = await pollRes.json() as {
        accessToken?: string;
        refreshToken?: string;
        email?: string;
        error?: string;
      };

      if (pollRes.ok && pollBody.accessToken && pollBody.email) {
        storeTokens(pollBody.accessToken, pollBody.email, pollBody.refreshToken);
        console.log(chalk.green(`Logged in as ${pollBody.email}`));
        return;
      }

      if (pollBody.error === "authorization_pending") continue;
      console.error(chalk.red(`Login failed: ${pollBody.error ?? `HTTP ${pollRes.status}`}`));
      process.exit(1);
    }

    console.error(chalk.red("Login timed out. Run `pensieve login` again."));
    process.exit(1);
  });
