"use strict";

/* =============================================================================
 * env.js  —  "Show environment variables, but safely"
 * =============================================================================
 *
 * PLAIN-ENGLISH SUMMARY
 *   Environment variables are little named settings the operating system keeps,
 *   like HOME (your home folder) or PATH (where programs live). Node exposes
 *   them all in `process.env`.
 *
 *   We DON'T print all of them, because process.env often also contains
 *   passwords, API keys and tokens. Leaking those would be exactly what a real
 *   virus does — so this file is deliberately careful:
 *
 *     1. ALLOW-LIST: we only show a hand-picked list of harmless, common
 *        variables (DEFAULT_SELECTION below).
 *     2. REDACT: if a variable's NAME looks secret (contains "PASSWORD",
 *        "TOKEN", "SECRET", etc.), we hide its value as "«redacted»" — even if
 *        someone asks for it on purpose.
 *     3. GRACEFUL: if a variable doesn't exist, we return null (shown as "N/A")
 *        instead of crashing.
 * ===========================================================================*/

// The harmless, commonly-useful variables we are happy to display.
// (Some only exist on Windows, some only on Linux/macOS — missing ones show N/A.)
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

/*
 * A "regular expression" (regex) is a pattern for matching text.
 * This one matches any variable NAME that contains words associated with
 * secrets. The trailing /i means "case-insensitive" (PASSWORD == password).
 * If a name matches, we hide its value.
 *
 * Note: we match "PASSWORD"/"PASSWD" specifically and NOT the bare word "PWD",
 * because on Linux/macOS "PWD" just means the current working directory — not
 * a password.
 */
const SECRET_PATTERN = /(SECRET|TOKEN|API[_-]?KEY|ACCESS[_-]?KEY|PASSWORD|PASSWD|PASSPHRASE|CREDENTIAL|AUTH|PRIVATE[_-]?KEY)/i;

/**
 * Long values (like PATH) would wreck the table layout, so shorten anything
 * over `max` characters and add an "…" to show it was cut.
 */
function truncate(value, max = 80) {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + "…";
}

/**
 * select() — build the { NAME: value } object we want to display.
 * @param {string[]} [names] optional custom list; otherwise DEFAULT_SELECTION
 * @param {object}   [opts]  set { truncate: false } to keep long values whole
 */
function select(names, opts = {}) {
  const { truncate: doTruncate = true } = opts;
  const list = names && names.length ? names : DEFAULT_SELECTION;
  const result = {};

  for (const name of list) {
    const raw = process.env[name];

    if (raw === undefined) {
      result[name] = null;          // variable not set -> show "N/A"
      continue;
    }
    if (SECRET_PATTERN.test(name)) {
      result[name] = "«redacted»";  // secret-looking name -> hide the value
      continue;
    }
    result[name] = doTruncate ? truncate(raw) : raw;
  }
  return result;
}

/**
 * summary() — a tiny overview: how many variables exist in total, and how many
 * of them we treated as secrets. Handy to print under the table.
 */
function summary() {
  const all = Object.keys(process.env);
  const redacted = all.filter((k) => SECRET_PATTERN.test(k));
  return {
    totalVariables: all.length,
    redactedCount: redacted.length,
  };
}

module.exports = { select, summary, DEFAULT_SELECTION, SECRET_PATTERN };
