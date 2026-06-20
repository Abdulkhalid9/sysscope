"use strict";

/* =============================================================================
 * menu.js  —  "A simple number-driven menu"
 * =============================================================================
 *
 * PLAIN-ENGLISH SUMMARY
 *   Not everyone wants to memorise commands. This file shows a menu: you type a
 *   number, it runs the matching action. It does NOT contain any feature logic
 *   of its own — it just calls the same handler functions that the command-line
 *   uses (passed in as `actions`), so the two ways of using the tool always
 *   behave identically.
 *
 * HOW IT READS YOUR TYPING
 *   Node's built-in `readline` module asks a question and waits for an answer.
 *   We wrap it in a small `ask()` helper that returns a Promise, so we can use
 *   the easy-to-read `await ask(...)` style.
 * ===========================================================================*/

const readline = require("readline");
const { c, log } = require("./output");

/** Ask one question and resolve with the user's (trimmed) answer. */
function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

/**
 * run(actions) — show the main menu in a loop until the user chooses Exit.
 * `actions` is an object of callbacks supplied by index.js:
 *   { info, env, network, save, live, crud }
 */
async function run(actions) {
  // Open a readline interface connected to the keyboard (stdin) and screen.
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Each menu item: [ keyToPress, label, functionToRun ].
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
    console.log(c.bold(c.cyan("\n  ── SysScope Menu ─────────────────────────")));
    for (const [key, label] of items) {
      console.log("   " + c.green(key) + "  " + label);
    }

    const choice = await ask(rl, c.yellow("\n  Choose an option: "));
    const item = items.find((i) => i[0] === choice);

    if (!item) {
      log.warn("Unknown option, try again.");
      continue;
    }
    if (choice === "0") {
      running = false;
      break;
    }

    // Run the chosen action; if it throws, show the error but keep the menu open.
    try {
      await item[2]();
    } catch (err) {
      log.error(err.message);
    }
  }

  rl.close();
  log.ok("Goodbye!");
}

/**
 * crudMenu() — a small sub-menu for file operations. Asks which operation, then
 * the details it needs, then calls actions.crud(...) which does the real work.
 */
async function crudMenu(rl, actions) {
  console.log(c.bold(c.cyan("\n  ── File CRUD ─────────────────────────────")));
  console.log(
    "   " + c.green("c") + " create   " + c.green("r") + " read   " +
      c.green("u") + " update   " + c.green("d") + " delete   " + c.green("l") + " list"
  );
  const op = (await ask(rl, c.yellow("\n  Operation: "))).toLowerCase();

  // List just needs a folder name.
  if (op === "l") {
    const dir = (await ask(rl, "  Directory (default '.'): ")) || ".";
    return actions.crud({ op: "list", target: dir });
  }

  // The others need a file path.
  if (op === "c" || op === "r" || op === "u" || op === "d") {
    const target = await ask(rl, "  File path (relative to sandbox): ");
    if (!target) return log.warn("No path given.");

    if (op === "r") return actions.crud({ op: "read", target });

    if (op === "d") {
      // Deleting is destructive, so confirm first.
      const sure = await ask(rl, c.red('  Delete "' + target + '"? (y/N): '));
      if (sure.toLowerCase() !== "y") return log.info("Cancelled.");
      return actions.crud({ op: "delete", target });
    }

    // create and update also need the content to write.
    const content = await ask(rl, "  Content: ");
    if (op === "c") return actions.crud({ op: "create", target, content });
    if (op === "u") {
      const mode =
        (await ask(rl, "  Mode [overwrite/append/prepend] (default overwrite): ")) ||
        "overwrite";
      return actions.crud({ op: "update", target, content, mode });
    }
  }

  log.warn("Unknown CRUD operation.");
}

module.exports = { run };
