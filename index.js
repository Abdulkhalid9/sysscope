#!/usr/bin/env node
"use strict";

/* =============================================================================
 * SysScope  —  index.js  (the starting point of the whole program)
 * =============================================================================
 * Thunder Hackathon 3.0 · "Create a product in JS"
 *
 * Don't worry about the scary title — this is a SAFE tool. It only LOOKS at
 * your computer (operating system, CPU, memory, Node version, environment
 * variables) and does file operations you ask for inside one folder. It does
 * not spread, hide, or connect to the internet.
 *
 * -----------------------------------------------------------------------------
 * NEW HERE? READ THE FILES IN THIS ORDER:
 *   1. index.js   (this file)  - the "front desk": reads your command and sends
 *                                you to the right place. Start here.
 *   2. src/sysinfo.js          - gathers facts about the computer.
 *   3. src/env.js              - reads environment variables, safely.
 *   4. src/crud.js             - create/read/update/delete files, safely.
 *   5. src/output.js           - turns data into pretty coloured tables.
 *   6. src/live.js             - the live updating dashboard.
 *   7. src/menu.js             - the interactive number menu.
 *
 * -----------------------------------------------------------------------------
 * HOW TO RUN:
 *   node index.js              -> full system report (the default)
 *   node index.js env          -> environment variables
 *   node index.js network      -> network interfaces
 *   node index.js live         -> live CPU/memory dashboard (Ctrl-C to quit)
 *   node index.js save         -> save the report to a JSON file
 *   node index.js menu         -> interactive menu
 *   node index.js help         -> list every command
 *
 *   Add --json to get raw JSON.  Add --no-color to turn off colours.
 *
 *   File operations:
 *     node index.js crud create <file> "<content>"
 *     node index.js crud read   <file>
 *     node index.js crud update <file> "<content>" --mode append
 *     node index.js crud delete <file>
 *     node index.js crud list   [folder]
 * ===========================================================================*/

const fs = require("fs");
const path = require("path");

// Pull in our own modules (the files in src/). Each one does one job.
const sysinfo = require("./src/sysinfo");
const env = require("./src/env");
const crud = require("./src/crud");
const live = require("./src/live");
const menu = require("./src/menu");
const { c, header, keyValueTable, table, banner, log } = require("./src/output");

/* -----------------------------------------------------------------------------
 * STEP 1: understand what the user typed.
 * ---------------------------------------------------------------------------*/

/*
 * parseArgs turns the words typed after "node index.js" into something easy to
 * use. It separates plain words (the command and its targets) from --flags.
 *
 * Example:  node index.js crud update a.js "hi" --mode append
 *   becomes { _: ["crud","update","a.js","hi"], flags: { mode: "append" } }
 */
function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok.startsWith("--")) {
      const key = tok.slice(2);       // drop the leading "--"
      const next = argv[i + 1];
      // "--mode append" -> flag has a value; "--json" alone -> flag is just true
      if (next !== undefined && !next.startsWith("--")) {
        args.flags[key] = next;
        i++; // skip the value we just consumed
      } else {
        args.flags[key] = true;
      }
    } else {
      args._.push(tok);
    }
  }
  return args;
}

const argv = parseArgs(process.argv.slice(2)); // slice(2) skips "node" and the script path
const JSON_MODE = Boolean(argv.flags.json);    // did the user ask for JSON?

/* -----------------------------------------------------------------------------
 * STEP 2: one function per command. Each gathers data, then prints it either as
 * pretty tables or (if --json) as raw JSON.
 * ---------------------------------------------------------------------------*/

/** Print the full system information report. */
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

/** Print the selected environment variables. */
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
      "\n  " + sum.totalVariables + " variables present · " +
        sum.redactedCount + " secret-like names auto-redacted\n"
    )
  );
}

/** Print the list of network interfaces. */
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

/** Gather everything and write it to a timestamped JSON file. */
function saveReport() {
  const data = {
    system: sysinfo.collect(),
    environment: { summary: env.summary(), variables: env.select() },
    network: sysinfo.networkInterfaces(),
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = "sysscope-report-" + stamp + ".json";
  const outPath = path.resolve(process.cwd(), fileName);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  log.ok("Report saved to " + c.cyan(outPath));
  return outPath;
}

/*
 * runCrud — one place that performs any file operation. Both the command-line
 * ("crud" command) and the interactive menu call this, so file behaviour lives
 * in exactly one spot.
 */
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

  // In JSON mode, just print the raw result object.
  if (JSON_MODE) return console.log(JSON.stringify(result, null, 2));

  // If the operation failed (file missing, etc.), show a friendly warning.
  if (!result.ok) {
    log.warn(result.action + ": " + result.message);
    return;
  }

  // Otherwise, show a nice success message tailored to the operation.
  if (op === "read") {
    log.ok("Read " + c.cyan(result.file) + "  (" + result.bytes + " bytes, " + result.lines + " lines)");
    console.log(c.gray("  ─── content ───────────────────────────"));
    console.log(result.content.replace(/^/gm, "  ")); // indent every line by 2 spaces
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

  log.ok(result.action + " → " + c.cyan(result.file));
  if (result.backup) log.info("Backup written: " + c.dim(result.backup));
}

/** Print the help screen. */
function printHelp() {
  console.log(banner());
  console.log(
    "\n" + c.bold("USAGE") + "\n" +
    "  node index.js [command] [options]\n\n" +
    c.bold("COMMANDS") + "\n" +
    "  " + c.green("info") + "            Full system information report (default)\n" +
    "  " + c.green("env") + "             Show selected environment variables\n" +
    "  " + c.green("network") + "         List network interfaces\n" +
    "  " + c.green("live") + "            Live CPU/memory dashboard (Ctrl-C to exit)\n" +
    "  " + c.green("save") + "            Save the full report to a timestamped JSON file\n" +
    "  " + c.green("menu") + "            Launch the interactive menu\n" +
    "  " + c.green("crud <op> ...") + "   File ops: create | read | update | delete | list\n" +
    "  " + c.green("help") + "            Show this help\n\n" +
    c.bold("GLOBAL OPTIONS") + "\n" +
    "  " + c.yellow("--json") + "          Emit JSON instead of pretty tables\n" +
    "  " + c.yellow("--no-color") + "      Disable colours\n\n" +
    c.bold("CRUD EXAMPLES") + "\n" +
    "  node index.js crud create hello.js \"console.log('hi')\"\n" +
    "  node index.js crud read   hello.js\n" +
    "  node index.js crud update hello.js \"// appended\" --mode append\n" +
    "  node index.js crud delete hello.js\n" +
    "  node index.js crud list   .\n"
  );
}

/* -----------------------------------------------------------------------------
 * STEP 3: the router. Look at the first word the user typed and call the right
 * function. The whole thing is wrapped in a try/catch (at the bottom) so that
 * no matter what goes wrong, the user sees a clean message — never a crash.
 * ---------------------------------------------------------------------------*/
async function main() {
  const command = argv._[0] || "info"; // no command typed? default to "info"

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
      // For crud, the remaining words are: <op> <target> <content>
      const [, op, target, content] = argv._;
      return runCrud({ op, target, content, mode: argv.flags.mode });
    }
    case "menu":
      // Hand the menu the same functions the command-line uses.
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

// Start the program. If ANY error escapes, show it cleanly and exit with code 1.
main().catch((err) => {
  log.error(err && err.message ? err.message : String(err));
  process.exitCode = 1;
});
