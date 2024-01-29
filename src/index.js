#!/usr/bin/env bun
import { program } from "commander";
import packagejson from "../package.json";
import present from "./command/present";
import create from "./command/create";
import studio from "./command/studio";

const { log } = console;

log(`\x1b[1m ____(•)${Math.round(Math.random()) ? "-" : "<"}
(\x1b[4mSliDesk\x1b[0m\x1b[1m) v \x1b[36;49m${packagejson.version}\x1b[0m
`);

program
  .name("slidesk")
  .description("Your presentation companion")
  .version(packagejson.version, "-v, --version");

// talk's creation command
program.command("create").argument("<talk>").action(create);

// talk's studio command
program
  .command("studio")
  .argument("[talk]", "the directory of your talk")
  .option("-d, --domain <string>", "domain", "localhost")
  .option("-p, --port <int>", "port", 1982)
  .action(studio);

// talk's presentation command
program
  .argument("[talk]", "the directory of your talk")
  .option("-d, --domain <string>", "domain", "localhost")
  .option("-p, --port <int>", "port", 1337)
  .option("-s, --save <path>", "save the presentation")
  .option("-n, --notes", "open with speakers notes")
  .option("-t, --timers", "add checkpoint and slide maximum time on notes view")
  .option("-a, --transition <int>", "transition timer", 300)
  .option("-w, --watch", "watch modification of files")
  .option("-g, --hidden", "remove help information")
  .option("-c, --conf <name>", "use a specific .env file", "")
  .option(
    "-o, --open <browser>",
    "open a browser with the presentation or notes view (browser is : chrome, edge, firefox, browser, browserPrivate)",
  )
  .action(present);

program.parse();
