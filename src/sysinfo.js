"use strict";

// sysinfo.js - collects facts about the machine using Node's built-in os/process.
// Everything goes through safe() so one weird platform can't crash the report.

const os = require("os");
const path = require("path");

// run a getter, return null if it throws or comes back empty.
// this is how we "handle missing values gracefully" - null shows up as N/A later.
function safe(fn, fallback = null) {
  try {
    const value = fn();
    if (value === undefined || value === "") return fallback;
    return value;
  } catch (_err) {
    return fallback;
  }
}

// bytes -> "16.0 GB"
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

// seconds -> "11d 20h 55m 48s"
function formatUptime(seconds) {
  if (seconds === null || seconds === undefined) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return d + "d " + h + "h " + m + "m " + s + "s";
}

// os.platform() returns codes like "win32"; map them to readable names.
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

// gather everything into one object. plain object => prints OR JSON-stringifies.
function collect() {
  const cpus = safe(() => os.cpus(), []) || [];
  const firstCpu = cpus[0] || {};

  const totalMem = safe(() => os.totalmem());
  const freeMem = safe(() => os.freemem());

  return {
    os: {
      platform: safe(() => os.platform()),
      platformFriendly: friendlyPlatform(safe(() => os.platform())),
      type: safe(() => os.type()),
      release: safe(() => os.release()),
      version: safe(() => os.version()),
      arch: safe(() => os.arch()),
      endianness: safe(() => os.endianness()),
    },

    cpu: {
      architecture: safe(() => process.arch),
      model: safe(() => firstCpu.model && firstCpu.model.trim()),
      cores: cpus.length || null,
      speedMHz: safe(() => firstCpu.speed),
      loadAverage: safe(() => os.loadavg()), // all zeros on Windows, that's expected
    },

    host: {
      hostname: safe(() => os.hostname()),
    },

    runtime: {
      nodeVersion: safe(() => process.version),
      v8Version: safe(() => process.versions && process.versions.v8),
      execPath: safe(() => process.execPath),
      pid: safe(() => process.pid),
    },

    user: {
      homeDirectory: safe(() => os.homedir()),
      username: safe(() => os.userInfo().username),
      shell: safe(() => os.userInfo().shell), // null on Windows, no shell there
      tempDirectory: safe(() => os.tmpdir()),
      currentWorkingDir: safe(() => process.cwd()),
      pathSeparator: safe(() => path.sep),
    },

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

    uptime: {
      systemSeconds: safe(() => os.uptime()),
      systemHuman: formatUptime(safe(() => os.uptime())),
      processSeconds: safe(() => process.uptime()),
    },

    meta: {
      generatedAt: new Date().toISOString(),
      tool: "SysScope",
      version: "1.0.0",
    },
  };
}

// os.networkInterfaces() is a nested map; flatten it to rows for the table.
function networkInterfaces() {
  const ifaces = safe(() => os.networkInterfaces(), {}) || {};
  const rows = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const addr of addrs || []) {
      rows.push({
        interface: name,
        family: addr.family,
        address: addr.address,
        internal: addr.internal ? "yes" : "no",
        mac: addr.mac && addr.mac !== "00:00:00:00:00:00" ? addr.mac : "N/A",
      });
    }
  }
  return rows;
}

module.exports = { collect, networkInterfaces, formatBytes, formatUptime, safe };
