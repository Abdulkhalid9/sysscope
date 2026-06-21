"use strict";

// live.js - a tiny live dashboard (CPU + memory) that redraws once a second.
// Ctrl-C to quit.
//
// There's no direct "CPU is X% busy" number, so we read each core's cumulative
// busy/idle time, wait a tick, read again, and compare the two snapshots.

const os = require("os");
const { c } = require("./output");
const { formatBytes, formatUptime } = require("./sysinfo");

// sum idle + total time across all cores
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

// % busy between two snapshots
function cpuUsagePercent(a, b) {
  const idleDelta = b.idle - a.idle;
  const totalDelta = b.total - a.total;
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
}

// text bar, green -> yellow -> red as it fills
function bar(pct, width = 28) {
  const filled = Math.round((pct / 100) * width);
  const colour = pct > 85 ? c.red : pct > 60 ? c.yellow : c.green;
  return colour("█".repeat(filled)) + c.gray("░".repeat(width - filled));
}

function start({ intervalMs = 1000 } = {}) {
  let prev = cpuTimes();
  let frames = 0;

  const render = () => {
    const cur = cpuTimes();
    const cpuPct = cpuUsagePercent(prev, cur);
    prev = cur;
    frames++;

    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const memPct = (used / total) * 100;
    const load = (os.loadavg() || [0, 0, 0]).map((n) => n.toFixed(2)).join(", ");

    process.stdout.write("\x1b[2J\x1b[H"); // clear screen + cursor home
    process.stdout.write(
      [
        c.bold(c.cyan("  SysScope - Live Dashboard")) +
          c.gray("   (frame " + frames + ", Ctrl-C to exit)"),
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

  render();
  const timer = setInterval(render, intervalMs);

  const stop = () => {
    clearInterval(timer);
    process.stdout.write("\x1b[?25h"); // show cursor again
    console.log(c.dim("\n  Live view stopped.\n"));
  };

  process.stdout.write("\x1b[?25l"); // hide cursor while drawing
  process.on("SIGINT", () => {
    stop();
    process.exit(0);
  });

  return stop;
}

module.exports = { start, cpuUsagePercent, cpuTimes };
