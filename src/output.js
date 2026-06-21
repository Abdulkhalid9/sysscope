"use strict";

// output.js - all the printing/formatting lives here. No system info, just looks.
// Colours are hand-rolled ANSI codes so there are no dependencies to install.
// Colour turns itself off when output isn't a real terminal (piped/saved) or
// when NO_COLOR / --no-color is set.

const NO_COLOR =
  process.env.NO_COLOR !== undefined ||
  !process.stdout.isTTY ||
  process.argv.includes("--no-color");

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

function paint(text, ...styles) {
  if (NO_COLOR) return String(text);
  return styles.map((s) => CODES[s] || "").join("") + text + CODES.reset;
}

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

// colour codes count as characters, so measure visible width without them
function visibleLength(str) {
  return String(str).replace(/\x1b\[[0-9;]*m/g, "").length;
}

function padEnd(str, width) {
  const pad = width - visibleLength(str);
  return pad > 0 ? str + " ".repeat(pad) : str;
}

function header(title) {
  const line = "─".repeat(Math.max(title.length + 4, 40));
  return "\n" + c.cyan(line) + "\n " + c.bold(c.cyan(title)) + "\n" + c.cyan(line);
}

// two-column label | value table. null/empty values render as a dim N/A.
function keyValueTable(obj) {
  const entries = Object.entries(obj);
  if (entries.length === 0) return c.dim("  (no data)");

  const keyWidth = entries.reduce((max, [k]) => Math.max(max, visibleLength(k)), 0);

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

// bordered grid for a list of row-objects
function table(rows, columns) {
  if (!rows || rows.length === 0) return c.dim("  (no rows)");

  const widths = columns.map((col) =>
    rows.reduce(
      (max, row) => Math.max(max, visibleLength(String(row[col.key] ?? ""))),
      visibleLength(col.label)
    )
  );

  const renderRow = (cells, painter) =>
    "  " +
    cells.map((cell, i) => painter(padEnd(String(cell ?? ""), widths[i]))).join(c.gray("  │  "));

  const head = renderRow(columns.map((col) => col.label), (t) => c.bold(c.cyan(t)));
  const sep = "  " + widths.map((w) => c.gray("─".repeat(w))).join(c.gray("──┼──"));
  const body = rows
    .map((row) => renderRow(columns.map((col) => row[col.key]), (t) => t))
    .join("\n");

  return head + "\n" + sep + "\n" + body;
}

function banner() {
  return (
    c.bold(c.magenta("SysScope")) +
    "\n" +
    c.dim("System Information & File CRUD Toolkit - Thunder Hackathon 3.0")
  );
}

// little status helpers
const log = {
  info: (m) => console.log(c.blue("i") + " " + m),
  ok: (m) => console.log(c.green("ok") + " " + m),
  warn: (m) => console.warn(c.yellow("warn") + " " + m),
  error: (m) => console.error(c.red("x") + " " + m),
};

module.exports = { c, header, keyValueTable, table, banner, log, NO_COLOR };
