"use strict";

// env.js - reads a safe subset of environment variables.
// We never dump all of process.env because it usually holds tokens/passwords.
// So: show an allow-list, redact anything secret-looking, and don't crash on
// variables that aren't set.

// common, harmless vars worth showing. some are Windows-only, some Unix-only;
// whatever isn't set just shows up as N/A.
const DEFAULT_SELECTION = [
  "USER",
  "USERNAME",
  "HOME",
  "HOMEPATH",
  "USERPROFILE",
  "SHELL",
  "LANG",
  "LC_ALL",
  "PWD",
  "TMPDIR",
  "TEMP",
  "TMP",
  "PATH",
  "NODE_ENV",
  "EDITOR",
  "TERM",
  "OS",
  "PROCESSOR_ARCHITECTURE",
  "NUMBER_OF_PROCESSORS",
  "COMPUTERNAME",
  "HOSTNAME",
];

// if a var NAME contains any of these, hide its value. /i = case-insensitive.
// note: we match PASSWORD/PASSWD, not bare "PWD" (that's just the working dir).
const SECRET_PATTERN = /(SECRET|TOKEN|API[_-]?KEY|ACCESS[_-]?KEY|PASSWORD|PASSWD|PASSPHRASE|CREDENTIAL|AUTH|PRIVATE[_-]?KEY)/i;

// keep long values (PATH) from blowing up the table width
function truncate(value, max = 80) {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + "...";
}

// build { NAME: value } for the vars we want to show
function select(names, opts = {}) {
  const { truncate: doTruncate = true } = opts;
  const list = names && names.length ? names : DEFAULT_SELECTION;
  const result = {};

  for (const name of list) {
    const raw = process.env[name];

    if (raw === undefined) {
      result[name] = null; // not set -> N/A
      continue;
    }
    if (SECRET_PATTERN.test(name)) {
      result[name] = "[redacted]"; // looks secret, hide it
      continue;
    }
    result[name] = doTruncate ? truncate(raw) : raw;
  }
  return result;
}

// quick counts for the footer line under the table
function summary() {
  const all = Object.keys(process.env);
  const redacted = all.filter((k) => SECRET_PATTERN.test(k));
  return {
    totalVariables: all.length,
    redactedCount: redacted.length,
  };
}

module.exports = { select, summary, DEFAULT_SELECTION, SECRET_PATTERN };
