"use strict";

// menu.js - the interactive number menu. It has no logic of its own; it just
// calls the same handler functions the command line uses (passed in as actions),
// so both ways of driving the tool behave the same.

const readline = require("readline");
const { c, log } = require("./output");

// ask one question, resolve with the trimmed answer
function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

async function run(actions) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // [ key, label, fn ]
  const items = [
    ["1", "System information report", actions.info],
    ["2", "Environment variables", actions.env],
    ["3", "Network interfaces", actions.network],
    ["4", "Save full report to file", actions.save],
    ["5", "Live dashboard", actions.live],
    ["6", "File CRUD menu", () => crudMenu(rl, actions)],
    ["0", "Exit", null],
  ];

  let running = true;
  while (running) {
    console.log(c.bold(c.cyan("\n  -- SysScope Menu -------------------------")));
    for (const [key, label] of items) {
      console.log("   " + c.green(key) + "  " + label);
    }

    const choice = await ask(rl, c.yellow("\n  Choose an option: "));
    const item = items.find((i) => i[0] === choice);

    if (!item) {
      log.warn("Unknown option, try again.");
      continue;
    }
    if (choice === "0") break;

    try {
      await item[2]();
    } catch (err) {
      log.error(err.message);
    }
  }

  rl.close();
  log.ok("Goodbye!");
}

// sub-menu for file operations
async function crudMenu(rl, actions) {
  console.log(c.bold(c.cyan("\n  -- File CRUD -----------------------------")));
  console.log(
    "   " + c.green("c") + " create   " + c.green("r") + " read   " +
      c.green("u") + " update   " + c.green("d") + " delete   " + c.green("l") + " list"
  );
  const op = (await ask(rl, c.yellow("\n  Operation: "))).toLowerCase();

  if (op === "l") {
    const dir = (await ask(rl, "  Directory (default '.'): ")) || ".";
    return actions.crud({ op: "list", target: dir });
  }

  if (op === "c" || op === "r" || op === "u" || op === "d") {
    const target = await ask(rl, "  File path (relative to project folder): ");
    if (!target) return log.warn("No path given.");

    if (op === "r") return actions.crud({ op: "read", target });

    if (op === "d") {
      const sure = await ask(rl, c.red('  Delete "' + target + '"? (y/N): '));
      if (sure.toLowerCase() !== "y") return log.info("Cancelled.");
      return actions.crud({ op: "delete", target });
    }

    const content = await ask(rl, "  Content: ");
    if (op === "c") return actions.crud({ op: "create", target, content });
    if (op === "u") {
      const mode =
        (await ask(rl, "  Mode [overwrite/append/prepend] (default overwrite): ")) || "overwrite";
      return actions.crud({ op: "update", target, content, mode });
    }
  }

  log.warn("Unknown CRUD operation.");
}

module.exports = { run };
