"use strict";

/* =============================================================================
 * sysinfo.js  —  "What machine am I running on?"
 * =============================================================================
 *
 * PLAIN-ENGLISH SUMMARY
 *   This file's only job is to gather facts about the computer: the operating
 *   system, the CPU, how much memory there is, the Node.js version, and so on.
 *   It then hands all of that back as one big plain object, which the rest of
 *   the program turns into nice tables or JSON.
 *
 * HOW IT WORKS
 *   Node.js ships with a built-in module called `os` that knows about the
 *   machine, and a global object called `process` that knows about the running
 *   program. We just ask them questions (os.platform(), os.cpus(), etc.) and
 *   tidy up the answers.
 *
 * THE ONE IDEA TO UNDERSTAND: the `safe()` helper
 *   Some of these questions can fail on unusual computers. If even one of them
 *   throws an error, we don't want the whole report to crash. So every lookup
 *   is wrapped in `safe(() => ...)`, which means: "try to get this value; if it
 *   blows up or is empty, just give me `null` instead." Later, the screen shows
 *   `null` values as a friendly "N/A".
 * ===========================================================================*/

const os = require("os");     // built-in: info about the operating system
const path = require("path"); // built-in: file-path helpers

/**
 * safe(fn) — run a function and return its result, or `null` if it fails.
 * This is what makes the tool "handle missing values gracefully".
 *
 * Example: safe(() => os.hostname())
 *   - if os.hostname() works  -> returns the hostname
 *   - if it throws or is ""    -> returns null (shown as "N/A")
 */
function safe(fn, fallback = null) {
  try {
    const value = fn();
    if (value === undefined || value === "") return fallback;
    return value;
  } catch (_err) {
    return fallback;
  }
}

/**
 * Turn a raw byte count (like 17179869184) into something humans read
 * (like "16.0 GB"). We keep dividing by 1024 and bump up the unit each time.
 */
function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return null;
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return n.toFixed(1) + " " + units[i];
}

/**
 * Turn a number of seconds into "Xd Yh Zm Ws" (days, hours, minutes, seconds).
 * Used for how long the computer has been switched on.
 */
function formatUptime(seconds) {
  if (seconds === null || seconds === undefined) return null;
  const d = Math.floor(seconds / 86400);          // 86400 seconds in a day
  const h = Math.floor((seconds % 86400) / 3600); // 3600 seconds in an hour
  const m = Math.floor((seconds % 3600) / 60);    // 60 seconds in a minute
  const s = Math.floor(seconds % 60);
  return d + "d " + h + "h " + m + "m " + s + "s";
}

/**
 * Node calls Windows "win32", macOS "darwin", etc. Those are hard to read,
 * so we translate the code into a friendly name. Anything we don't recognise
 * is returned unchanged.
 */
function friendlyPlatform(platform) {
  const map = {
    aix: "AIX",
    darwin: "macOS",
    freebsd: "FreeBSD",
    linux: "Linux",
    openbsd: "OpenBSD",
    sunos: "SunOS",
    win32: "Windows",
  };
  return map[platform] || platform || null;
}

/**
 * collect() — the main function. Asks every question and returns one object
 * grouped into sections (os, cpu, host, runtime, user, memory, uptime).
 * Because it's a plain object, it can be printed OR converted straight to JSON.
 */
function collect() {
  // os.cpus() returns one entry per CPU core. We grab the list (or [] if it
  // fails) and look at the first core for the model name and speed.
  const cpus = safe(() => os.cpus(), []) || [];
  const firstCpu = cpus[0] || {};

  const totalMem = safe(() => os.totalmem()); // total RAM in bytes
  const freeMem = safe(() => os.freemem());   // currently free RAM in bytes

  return {
    // ---- Operating system details ----
    os: {
      platform: safe(() => os.platform()),                       // "win32"
      platformFriendly: friendlyPlatform(safe(() => os.platform())), // "Windows"
      type: safe(() => os.type()),         // "Windows_NT" / "Linux" / "Darwin"
      release: safe(() => os.release()),   // kernel/build number
      version: safe(() => os.version()),   // descriptive edition string
      arch: safe(() => os.arch()),         // "x64", "arm64", ...
      endianness: safe(() => os.endianness()), // "LE" or "BE" (byte order)
    },

    // ---- CPU architecture & details ----
    cpu: {
      architecture: safe(() => process.arch),
      model: safe(() => firstCpu.model && firstCpu.model.trim()),
      cores: cpus.length || null,
      speedMHz: safe(() => firstCpu.speed),
      // Load average = how busy the machine has been (1, 5, 15 min).
      // Note: Windows always reports 0s here because it has no such concept.
      loadAverage: safe(() => os.loadavg()),
    },

    // ---- Host / network name ----
    host: {
      hostname: safe(() => os.hostname()),
    },

    // ---- The Node.js program itself ----
    runtime: {
      nodeVersion: safe(() => process.version),
      v8Version: safe(() => process.versions && process.versions.v8),
      execPath: safe(() => process.execPath), // path to node.exe / node
      pid: safe(() => process.pid),           // this run's process id number
    },

    // ---- The logged-in user and important folders ----
    user: {
      homeDirectory: safe(() => os.homedir()),
      username: safe(() => os.userInfo().username),
      shell: safe(() => os.userInfo().shell),     // null on Windows (no shell)
      tempDirectory: safe(() => os.tmpdir()),
      currentWorkingDir: safe(() => process.cwd()),
      pathSeparator: safe(() => path.sep),        // "\\" on Windows, "/" on Unix
    },

    // ---- Memory snapshot ----
    memory: {
      total: totalMem,
      free: freeMem,
      used: totalMem !== null && freeMem !== null ? totalMem - freeMem : null,
      totalHuman: formatBytes(totalMem),
      freeHuman: formatBytes(freeMem),
      usedHuman:
        totalMem !== null && freeMem !== null
          ? formatBytes(totalMem - freeMem)
          : null,
    },

    // ---- How long things have been running ----
    uptime: {
      systemSeconds: safe(() => os.uptime()),            // since last boot
      systemHuman: formatUptime(safe(() => os.uptime())),
      processSeconds: safe(() => process.uptime()),      // since THIS program started
    },

    // ---- A little stamp so a saved report knows when it was made ----
    meta: {
      generatedAt: new Date().toISOString(),
      tool: "SysScope",
      version: "1.0.0",
    },
  };
}

/**
 * networkInterfaces() — list the machine's network cards and their addresses.
 * os.networkInterfaces() returns a nested object; we flatten it into a simple
 * list of rows so it's easy to print as a table.
 */
function networkInterfaces() {
  const ifaces = safe(() => os.networkInterfaces(), {}) || {};
  const rows = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const addr of addrs || []) {
      rows.push({
        interface: name,
        family: addr.family,                 // IPv4 or IPv6
        address: addr.address,               // the actual IP address
        internal: addr.internal ? "yes" : "no", // "yes" = loopback (127.0.0.1)
        mac: addr.mac && addr.mac !== "00:00:00:00:00:00" ? addr.mac : "N/A",
      });
    }
  }
  return rows;
}

// Make these functions usable from other files (index.js, live.js).
module.exports = { collect, networkInterfaces, formatBytes, formatUptime, safe };
