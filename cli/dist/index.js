#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const login_1 = require("./commands/login");
const register_1 = require("./commands/register");
const sync_1 = require("./commands/sync");
const config_1 = require("./commands/config");
const publish_1 = require("./commands/publish");
const program = new commander_1.Command();
program
    .name("pensieve")
    .description("Sync your markdown notes to a Pensieve lexicon")
    .version("0.1.0");
program.addCommand(login_1.loginCommand);
program.addCommand(register_1.registerCommand);
program.addCommand(sync_1.syncCommand);
program.addCommand(config_1.configCommand);
program.addCommand(publish_1.publishCommand);
program.addCommand(publish_1.unpublishCommand);
for (const cmd of [login_1.loginCommand, register_1.registerCommand]) {
    cmd.hook("preAction", async () => {
        const { runSetupIfNeeded } = await Promise.resolve().then(() => __importStar(require("./lib/setup-wizard")));
        await runSetupIfNeeded({ requireAuth: false });
    });
}
sync_1.syncCommand.hook("preAction", async () => {
    const { runSetupIfNeeded } = await Promise.resolve().then(() => __importStar(require("./lib/setup-wizard")));
    await runSetupIfNeeded();
});
program
    .command("logout")
    .description("Clear stored credentials")
    .action(async () => {
    const { config } = await Promise.resolve().then(() => __importStar(require("./config")));
    config.clear();
    console.log("Logged out.");
});
program.parse(process.argv);
