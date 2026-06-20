"use strict";

/* =============================================================================
 * output.js  —  "Make things look nice on screen"
 * =============================================================================
 *
 * PLAIN-ENGLISH SUMMARY
 *   This file is only about PRESENTATION — turning plain data into coloured
 *   text, aligned tables, and the title. It contains no system info itself.
 *
 *   We do the colouring ourselves instead of installing a library, so the
 *   project needs ZERO downloads — you can just run it with `node`.
 *
 * HOW COLOURS WORK (the short version)
 *   Terminals understand special invisible codes called "ANSI escape codes".
 *   For example the text "\x1b[31m" means "start red" and "\x1b[0m" means
 *   "reset to normal". So to print red text we wrap it: \x1b[31m + text + \x1b[0m.
 *   The `paint()` function below does exactly that.
 *
 *   We automatically TURN COLOUR OFF when it wouldn't make sense — e.g. when the
 *   output is being saved to a file (then the codes would just be ugly noise).
 * ===========================================================================*/

// Decide once, up front, whether to use colour at all.
const NO_COLOR =
  process.env.NO_COLOR !== undefined || // user/system asked for no colour
  !process.stdout.isTTY ||              // output isn't a real terminal (piped/saved)
  process.argv.includes("--no-color");  // user passed the --no-color flag

// The raw ANSI codes for each colour/style we use.
const CODES = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

/** Wrap `text` in one or more colour codes — unless colour is switched off. */
function paint(text, ...styles) {
  if (NO_COLOR) return String(text);
  const prefix = styles.map((s) => CODES[s] || "").join("");
  return prefix + text + CODES.reset;
}

// Shorthand helpers so the rest of the code can write c.green("hi"), etc.
const c = {
  bold: (t) => paint(t, "bold"),
  dim: (t) => paint(t, "dim"),
  red: (t) => paint(t, "red"),
  green: (t) => paint(t, "green"),
  yellow: (t) => paint(t, "yellow"),
  blue: (t) => paint(t, "blue"),
  magenta: (t) => paint(t, "magenta"),
  cyan: (t) => paint(t, "cyan"),
  gray: (t) => paint(t, "gray"),
};

/*
 * Colour codes are invisible but still count as characters in a string.
 * When we line up columns we must measure the VISIBLE width only, so this
 * strips the codes out before counting.
 */
function visibleLength(str) {
  return String(str).replace(/\x1b\[[0-9;]*m/g, "").length;
}

/** Add spaces to the right of `str` until it reaches `width` visible chars. */
function padEnd(str, width) {
  const pad = width - visibleLength(str);
  return pad > 0 ? str + " ".repeat(pad) : str;
}

/** A section heading with lines above and below it, e.g. "Operating System". */
function header(title) {
  const line = "─".repeat(Math.max(title.length + 4, 40));
  return "\n" + c.cyan(line) + "\n " + c.bold(c.cyan(title)) + "\n" + c.cyan(line);
}

/**
 * keyValueTable(obj) — print an object as two neat columns: label | value.
 * Missing values (null/undefined/"") are shown as a dim "N/A".
 * Arrays are joined with commas.
 */
function keyValueTable(obj) {
  const entries = Object.entries(obj);
  if (entries.length === 0) return c.dim("  (no data)");

  // Find the widest label so every value lines up in the same column.
  const keyWidth = entries.reduce(
    (max, [k]) => Math.max(max, visibleLength(k)),
    0
  );

  return entries
    .map(([k, v]) => {
      const value =
        v === null || v === undefined || v === ""
          ? c.dim("N/A")
          : Array.isArray(v)
          ? v.join(", ")
          : String(v);
      return "  " + c.green(padEnd(k, keyWidth)) + "  " + c.gray("│") + "  " + value;
    })
    .join("\n");
}

/**
 * table(rows, columns) — print a list of objects as a bordered grid.
 *   rows:    [ { name: "a", type: "file" }, ... ]
 *   columns: [ { key: "name", label: "Name" }, { key: "type", label: "Type" } ]
 */
function table(rows, columns) {
  if (!rows || rows.length === 0) return c.dim("  (no rows)");

  // Work out how wide each column needs to be (header vs widest cell).
  const widths = columns.map((col) =>
    rows.reduce(
      (max, row) => Math.max(max, visibleLength(String(row[col.key] ?? ""))),
      visibleLength(col.label)
    )
  );

  // Helper that renders one row, padding each cell to its column width.
  const renderRow = (cells, painter) =>
    "  " +
    cells
      .map((cell, i) => painter(padEnd(String(cell ?? ""), widths[i])))
      .join(c.gray("  │  "));

  const head = renderRow(
    columns.map((col) => col.label),
    (t) => c.bold(c.cyan(t))
  );
  const sep =
    "  " + widths.map((w) => c.gray("─".repeat(w))).join(c.gray("──┼──"));
  const body = rows
    .map((row) =>
      renderRow(
        columns.map((col) => row[col.key]),
        (t) => t
      )
    )
    .join("\n");

  return head + "\n" + sep + "\n" + body;
}

/** A simple text title printed at the top of the report. */
function banner() {
  return (
    c.bold(c.magenta("SysScope")) +
    "\n" +
    c.dim("System Information & File CRUD Toolkit · Thunder Hackathon 3.0")
  );
}

// Small helpers for status messages, each with its own symbol and colour.
const log = {
  info: (m) => console.log(c.blue("ℹ") + " " + m),
  ok: (m) => console.log(c.green("✔") + " " + m),
  warn: (m) => console.warn(c.yellow("⚠") + " " + m),
  error: (m) => console.error(c.red("✖") + " " + m),
};

module.exports = { c, header, keyValueTable, table, banner, log, NO_COLOR };
