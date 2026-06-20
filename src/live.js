"use strict";

/* =============================================================================
 * live.js  —  "A live dashboard that updates every second"
 * =============================================================================
 *
 * PLAIN-ENGLISH SUMMARY
 *   This shows CPU and memory usage as little bars that refresh once a second,
 *   like a tiny Task Manager. Press Ctrl-C to stop it.
 *
 * THE TRICKY PART: measuring CPU usage
 *   There is no single "CPU is 30% busy" number we can just read. Instead the
 *   OS tells us TOTAL time each core has spent doing things, including time
 *   spent doing nothing ("idle"). So to find usage we:
 *     1. take a snapshot of those numbers,
 *     2. wait a second,
 *     3. take another snapshot,
 *     4. compare: how much of the elapsed time was NOT idle = how busy it was.
 *   That comparison is what cpuUsagePercent() does.
 * ===========================================================================*/

const os = require("os");
const { c } = require("./output");
const { formatBytes, formatUptime } = require("./sysinfo");

/**
 * Take one snapshot: add up idle time and total time across all CPU cores.
 * os.cpus()[i].times has fields like user, sys, idle — we sum them.
 */
function cpuTimes() {
  const cpus = os.cpus() || [];
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const t of Object.values(cpu.times)) total += t;
    idle += cpu.times.idle;
  }
  return { idle, total };
}

/**
 * Compare two snapshots and return how busy the CPU was between them, 0-100%.
 * If almost all the new time was idle, usage is low; if little was idle, high.
 */
function cpuUsagePercent(a, b) {
  const idleDelta = b.idle - a.idle;   // extra idle time since last snapshot
  const totalDelta = b.total - a.total; // extra total time since last snapshot
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
}

/**
 * Draw a text bar like ████░░░░ for a given percentage.
 * Colour goes green -> yellow -> red as it fills up.
 */
function bar(pct, width = 28) {
  const filled = Math.round((pct / 100) * width);
  const colour = pct > 85 ? c.red : pct > 60 ? c.yellow : c.green;
  return colour("█".repeat(filled)) + c.gray("░".repeat(width - filled));
}

/**
 * start() — begin the live view. It redraws every `intervalMs` milliseconds and
 * keeps going until you press Ctrl-C. Returns a stop() function too.
 */
function start({ intervalMs = 1000 } = {}) {
  let prev = cpuTimes(); // remember the previous snapshot to compare against
  let frames = 0;

  const render = () => {
    const cur = cpuTimes();
    const cpuPct = cpuUsagePercent(prev, cur);
    prev = cur; // this snapshot becomes the baseline for next time
    frames++;

    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const memPct = (used / total) * 100;
    const load = (os.loadavg() || [0, 0, 0]).map((n) => n.toFixed(2)).join(", ");

    // "\x1b[2J\x1b[H" = clear the screen and move the cursor to the top-left,
    // so each frame redraws in the same place instead of scrolling.
    process.stdout.write("\x1b[2J\x1b[H");
    process.stdout.write(
      [
        c.bold(c.cyan("  SysScope · Live Dashboard")) +
          c.gray("   (frame " + frames + " · Ctrl-C to exit)"),
        "",
        "  " + c.green("CPU  ") + " " + bar(cpuPct) + " " + cpuPct.toFixed(1).padStart(5) + "%",
        "  " + c.green("MEM  ") + " " + bar(memPct) + " " + memPct.toFixed(1).padStart(5) + "%   " +
          c.gray(formatBytes(used) + " / " + formatBytes(total)),
        "",
        "  " + c.green("Load avg") + "   " + c.gray(load),
        "  " + c.green("Uptime  ") + "   " + c.gray(formatUptime(os.uptime())),
        "  " + c.green("Free mem") + "   " + c.gray(formatBytes(free)),
        "",
      ].join("\n")
    );
  };

  render();                                   // draw immediately...
  const timer = setInterval(render, intervalMs); // ...then every second

  const stop = () => {
    clearInterval(timer);
    process.stdout.write("\x1b[?25h"); // turn the text cursor back on
    console.log(c.dim("\n  Live view stopped.\n"));
  };

  process.stdout.write("\x1b[?25l"); // hide the blinking cursor while drawing
  // When the user presses Ctrl-C, stop cleanly instead of dumping an error.
  process.on("SIGINT", () => {
    stop();
    process.exit(0);
  });

  return stop;
}

module.exports = { start, cpuUsagePercent, cpuTimes };
