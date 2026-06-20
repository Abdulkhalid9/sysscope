"use strict";

/* =============================================================================
 * crud.js  —  "Create, Read, Update, Delete files (safely)"
 * =============================================================================
 *
 * PLAIN-ENGLISH SUMMARY
 *   CRUD is just the four basic things you can do with a file:
 *     Create  - make a new file
 *     Read    - look at a file's contents
 *     Update  - change a file
 *     Delete  - remove a file
 *   ...plus List, to see what's in a folder.
 *
 *   Because messing with files is the genuinely "dangerous" part of the brief,
 *   this file is written defensively. Three safety ideas run through it:
 *
 *     1. SANDBOX  - every file path must stay inside one base folder (your
 *        current folder by default). Sneaky paths like "../../etc/passwd" that
 *        try to climb OUT are rejected. (see resolveSafe)
 *     2. BACKUPS  - before Update or Delete changes anything, we first copy the
 *        file to a timestamped ".bak" file, so you can always undo.
 *     3. CLEAR RESULTS - every function returns a small object describing what
 *        happened ({ ok: true/false, ... }) instead of failing silently.
 * ===========================================================================*/

const fs = require("fs");     // built-in: read/write files
const path = require("path"); // built-in: work with file paths

/**
 * resolveSafe(target, baseDir) - turn a path the user typed into a full path,
 * and make sure it stays INSIDE baseDir. Throws if it tries to escape.
 * This is the guard that blocks "path traversal" attacks like "../../secret".
 */
function resolveSafe(target, baseDir) {
  const base = path.resolve(baseDir);          // full path of the sandbox
  const resolved = path.resolve(base, target); // full path of the target
  const rel = path.relative(base, resolved);   // route from base -> target

  // If the route starts with ".." (or is absolute), the target is OUTSIDE the
  // sandbox, so we refuse.
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      'Refused: "' + target + '" resolves outside the sandbox (' + base + ")."
    );
  }
  return resolved;
}

/** A filesystem-safe timestamp like 2026-06-20T12-30-00-000Z for backup names. */
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/** CREATE - write a brand-new file. Won't overwrite unless force=true. */
function create(target, content, options) {
  const opts = options || {};
  const baseDir = opts.baseDir || process.cwd();
  const force = Boolean(opts.force);
  const file = resolveSafe(target, baseDir);

  if (fs.existsSync(file) && !force) {
    return { ok: false, action: "create", file, message: "File already exists (use force to overwrite)." };
  }

  // Make sure the folder exists first (e.g. "demo/hello.js" needs "demo/").
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content || "", "utf8");

  return { ok: true, action: "create", file, bytes: Buffer.byteLength(content || "") };
}

/** READ - return a file's text plus a few facts about it (size, lines, date). */
function read(target, options) {
  const opts = options || {};
  const baseDir = opts.baseDir || process.cwd();
  const file = resolveSafe(target, baseDir);

  if (!fs.existsSync(file)) {
    return { ok: false, action: "read", file, message: "File not found." };
  }
  const stat = fs.statSync(file);
  if (stat.isDirectory()) {
    return { ok: false, action: "read", file, message: "Path is a directory, not a file." };
  }

  const content = fs.readFileSync(file, "utf8");
  return {
    ok: true,
    action: "read",
    file,
    bytes: stat.size,
    lines: content.split(/\r\n|\r|\n/).length, // count line breaks
    modified: stat.mtime.toISOString(),
    content,
  };
}

/**
 * UPDATE - change an existing file. A backup is made first.
 * mode: "overwrite" (default) | "append" | "prepend"
 */
function update(target, content, options) {
  const opts = options || {};
  const baseDir = opts.baseDir || process.cwd();
  const mode = opts.mode || "overwrite";
  const file = resolveSafe(target, baseDir);

  if (!fs.existsSync(file)) {
    return { ok: false, action: "update", file, message: "File not found (use create instead)." };
  }

  // Safety: copy the current file to a .bak before touching it.
  const backup = file + "." + timestamp() + ".bak";
  fs.copyFileSync(file, backup);

  let final = content;
  if (mode === "append") final = fs.readFileSync(file, "utf8") + content;
  else if (mode === "prepend") final = content + fs.readFileSync(file, "utf8");

  fs.writeFileSync(file, final, "utf8");
  return { ok: true, action: "update", file, mode, backup, bytes: Buffer.byteLength(final) };
}

/** DELETE - remove a file. A backup is made first, so it's recoverable. */
function remove(target, options) {
  const opts = options || {};
  const baseDir = opts.baseDir || process.cwd();
  const file = resolveSafe(target, baseDir);

  if (!fs.existsSync(file)) {
    return { ok: false, action: "delete", file, message: "File not found." };
  }
  const stat = fs.statSync(file);
  if (stat.isDirectory()) {
    return { ok: false, action: "delete", file, message: "Refusing to delete a directory." };
  }

  const backup = file + "." + timestamp() + ".bak";
  fs.copyFileSync(file, backup); // keep a copy...
  fs.unlinkSync(file);           // ...then delete the original
  return { ok: true, action: "delete", file, backup };
}

/** LIST - show the files/folders directly inside a directory, with sizes. */
function list(target, options) {
  const opts = options || {};
  const baseDir = opts.baseDir || process.cwd();
  const dir = resolveSafe(target || ".", baseDir);

  if (!fs.existsSync(dir)) {
    return { ok: false, action: "list", dir, message: "Directory not found." };
  }

  const dirents = fs.readdirSync(dir, { withFileTypes: true });
  const entries = [];
  for (const d of dirents) {
    let size = "N/A";
    try {
      if (d.isFile()) size = fs.statSync(path.join(dir, d.name)).size;
    } catch (_e) {
      size = "N/A";
    }
    entries.push({
      name: d.name,
      type: d.isDirectory() ? "dir" : "file",
      bytes: size,
    });
  }

  return { ok: true, action: "list", dir, entries };
}

module.exports = { create, read, update, remove, list, resolveSafe };
