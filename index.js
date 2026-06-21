#!/usr/bin/env node
"use strict";

// SysScope - Thunder Hackathon 3.0
// A small Node CLI that reports system info + environment variables and does
// CRUD on files. Scary brief title, but it's a benign diagnostics tool: it only
// reads info about the machine and edits files you explicitly point it at.
//
// Layout:
//   index.js       - reads the command and routes it (start here)
//   src/sysinfo.js - gathers OS / CPU / memory / runtime facts
//   src/env.js     - environment variables, with secrets hidden
//   src/crud.js    - create / read / update / delete files
//   src/output.js  - colours + tables
//   src/live.js    - live CPU/memory dashboard
//   src/menu.js    - interactive menu
//
// Run: node index.js [command]   (no command = full system report)
// Commands: info | env | network | live | save | menu | crud | help
// Flags: --json (raw JSON), --no-color

const fs = require("fs");
const path = require("path");

const sysinfo = require("./src/sysinfo");
const env = require("./src/env");
const crud = require("./src/crud");
const live = require("./src/live");
const menu = require("./src/menu");
const { c, header, keyValueTable, table, banner, log } = require("./src/output");

// turn the words after "node index.js" into { _: [...], flags: {...} }
function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok.startsWith("--")) {
      const key = tok.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args.flags[key] = next;
        i++;
      } else {
        args.flags[key] = true;
      }
    } else {
      args._.push(tok);
    }
  }
  return args;
}

const argv = parseArgs(process.argv.slice(2));
const JSON_MODE = Boolean(argv.flags.json);

function printInfo() {
  const data = sysinfo.collect();
  if (JSON_MODE) return console.log(JSON.stringify(data, null, 2));

  console.log(banner());

  console.log(header("Operating System"));
  console.log(
    keyValueTable({
      Platform: data.os.platformFriendly,
      "Platform (raw)": data.os.platform,
      Type: data.os.type,
      Release: data.os.release,
      Version: data.os.version,
      Architecture: data.os.arch,
      Endianness: data.os.endianness,
    })
  );

  console.log(header("CPU"));
  console.log(
    keyValueTable({
      Architecture: data.cpu.architecture,
      Model: data.cpu.model,
      Cores: data.cpu.cores,
      "Speed (MHz)": data.cpu.speedMHz,
      "Load avg (1/5/15m)": data.cpu.loadAverage
        ? data.cpu.loadAverage.map((n) => n.toFixed(2)).join(" / ")
        : null,
    })
  );

  console.log(header("Host & Node.js Runtime"));
  console.log(
    keyValueTable({
      Hostname: data.host.hostname,
      "Node.js version": data.runtime.nodeVersion,
      "V8 version": data.runtime.v8Version,
      "Executable path": data.runtime.execPath,
      "Process ID": data.runtime.pid,
    })
  );

  console.log(header("User & Paths"));
  console.log(
    keyValueTable({
      Username: data.user.username,
      "Home directory": data.user.homeDirectory,
      Shell: data.user.shell,
      "Temp directory": data.user.tempDirectory,
      "Working directory": data.user.currentWorkingDir,
      "Path separator": data.user.pathSeparator,
    })
  );

  console.log(header("Memory & Uptime"));
  console.log(
    keyValueTable({
      "Total memory": data.memory.totalHuman,
      "Used memory": data.memory.usedHuman,
      "Free memory": data.memory.freeHuman,
      "System uptime": data.uptime.systemHuman,
      "Process uptime (s)": data.uptime.processSeconds
        ? data.uptime.processSeconds.toFixed(1)
        : null,
    })
  );

  console.log(c.dim("\n  Generated at " + data.meta.generatedAt + "\n"));
}

function printEnv() {
  const selected = env.select();
  const sum = env.summary();
  if (JSON_MODE) {
    return console.log(JSON.stringify({ summary: sum, variables: selected }, null, 2));
  }
  console.log(header("Environment Variables (selected)"));
  console.log(keyValueTable(selected));
  console.log(
    c.dim(
      "\n  " + sum.totalVariables + " variables present, " +
        sum.redactedCount + " secret-like names auto-redacted\n"
    )
  );
}

function printNetwork() {
  const rows = sysinfo.networkInterfaces();
  if (JSON_MODE) return console.log(JSON.stringify(rows, null, 2));
  console.log(header("Network Interfaces"));
  console.log(
    table(rows, [
      { key: "interface", label: "Interface" },
      { key: "family", label: "Family" },
      { key: "address", label: "Address" },
      { key: "internal", label: "Internal" },
      { key: "mac", label: "MAC" },
    ])
  );
  console.log("");
}

function saveReport() {
  const data = {
    system: sysinfo.collect(),
    environment: { summary: env.summary(), variables: env.select() },
    network: sysinfo.networkInterfaces(),
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.resolve(process.cwd(), "sysscope-report-" + stamp + ".json");
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  log.ok("Report saved to " + c.cyan(outPath));
  return outPath;
}

// single place all file operations go through (CLI and menu both call this)
function runCrud({ op, target, content, mode }) {
  let result;
  switch (op) {
    case "create":
      result = crud.create(target, content || "", { force: Boolean(argv.flags.force) });
      break;
    case "read":
      result = crud.read(target);
      break;
    case "update":
      result = crud.update(target, content || "", { mode: mode || "overwrite" });
      break;
    case "delete":
      result = crud.remove(target);
      break;
    case "list":
      result = crud.list(target || ".");
      break;
    default:
      log.error("Unknown CRUD operation: " + op);
      return;
  }

  if (JSON_MODE) return console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    log.warn(result.action + ": " + result.message);
    return;
  }

  if (op === "read") {
    log.ok("Read " + c.cyan(result.file) + "  (" + result.bytes + " bytes, " + result.lines + " lines)");
    console.log(c.gray("  --- content ---"));
    console.log(result.content.replace(/^/gm, "  "));
    return;
  }
  if (op === "list") {
    console.log(header("Contents of " + result.dir));
    console.log(
      table(result.entries, [
        { key: "name", label: "Name" },
        { key: "type", label: "Type" },
        { key: "bytes", label: "Bytes" },
      ])
    );
    console.log("");
    return;
  }

  log.ok(result.action + " -> " + c.cyan(result.file));
  if (result.backup) log.info("Backup written: " + c.dim(result.backup));
}

function printHelp() {
  console.log(banner());
  console.log(
    "\n" + c.bold("USAGE") + "\n" +
    "  node index.js [command] [options]\n\n" +
    c.bold("COMMANDS") + "\n" +
    "  " + c.green("info") + "            Full system information report (default)\n" +
    "  " + c.green("menu") + "            Launch the interactive menu\n" +
    "  " + c.green("env") + "             Show selected environment variables\n" +
    "  " + c.green("network") + "         List network interfaces\n" +
    "  " + c.green("live") + "            Live CPU/memory dashboard (Ctrl-C to exit)\n" +
    "  " + c.green("save") + "            Save the full report to a timestamped JSON file\n" +
    "  " + c.green("crud <op> ...") + "   File ops: create | read | update | delete | list\n" +
    "  " + c.green("help") + "            Show this help\n\n" +
    c.bold("OPTIONS") + "\n" +
    "  " + c.yellow("--json") + "          Emit JSON instead of tables\n" +
    "  " + c.yellow("--no-color") + "      Disable colours\n\n" +
    c.bold("CRUD EXAMPLES") + "\n" +
    "  node index.js crud create hello.js \"console.log('hi')\"\n" +
    "  node index.js crud read   hello.js\n" +
    "  node index.js crud update hello.js \"// appended\" --mode append\n" +
    "  node index.js crud delete hello.js\n" +
    "  node index.js crud list   .\n"
  );
}

// look at the first word and call the matching function.
// wrapped in a catch at the bottom so nothing ever dumps a raw stack trace.
async function main() {
  const command = argv._[0] || "info";

  switch (command) {
    case "info":
      return printInfo();
    case "env":
      return printEnv();
    case "network":
      return printNetwork();
    case "save":
      return void saveReport();
    case "live":
      return void live.start();
    case "crud": {
      const [, op, target, content] = argv._;
      return runCrud({ op, target, content, mode: argv.flags.mode });
    }
    case "menu":
      return menu.run({
        info: () => printInfo(),
        env: () => printEnv(),
        network: () => printNetwork(),
        save: () => saveReport(),
        live: () =>
          new Promise((resolve) => {
            live.start();
            resolve();
          }),
        crud: (opts) => runCrud(opts),
      });
    case "help":
    case "--help":
    case "-h":
      return printHelp();
    default:
      log.error("Unknown command: " + command);
      printHelp();
      process.exitCode = 1;
  }
}

main().catch((err) => {
  log.error(err && err.message ? err.message : String(err));
  process.exitCode = 1;
});
