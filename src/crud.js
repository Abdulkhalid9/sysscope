"use strict";

// crud.js - create / read / update / delete files (+ list).
// This is the part that actually changes files, so it's the careful part:
//   - paths can be relative, absolute, or point outside the project folder
//   - update/delete write a .bak copy first, so nothing is unrecoverable
//   - every function returns { ok, ... } instead of throwing/failing silently

const fs = require("fs");
const path = require("path");

// Resolve a path against baseDir. Absolute paths stay absolute; relative paths
// are resolved from the current working directory, including "../" segments.
function resolveTarget(target, baseDir) {
  if (!target) throw new Error("No path given.");
  const base = path.resolve(baseDir);
  return path.resolve(base, target);
}

// filesystem-safe timestamp for .bak names
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function create(target, content, options) {
  const opts = options || {};
  const baseDir = opts.baseDir || process.cwd();
  const force = Boolean(opts.force);
  const file = resolveTarget(target, baseDir);

  if (fs.existsSync(file) && !force) {
    return { ok: false, action: "create", file, message: "File already exists (use force to overwrite)." };
  }

  fs.mkdirSync(path.dirname(file), { recursive: true }); // make parent dirs if needed
  fs.writeFileSync(file, content || "", "utf8");

  return { ok: true, action: "create", file, bytes: Buffer.byteLength(content || "") };
}

function read(target, options) {
  const opts = options || {};
  const baseDir = opts.baseDir || process.cwd();
  const file = resolveTarget(target, baseDir);

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
    lines: content.split(/\r\n|\r|\n/).length,
    modified: stat.mtime.toISOString(),
    content,
  };
}

// mode: overwrite (default) | append | prepend
function update(target, content, options) {
  const opts = options || {};
  const baseDir = opts.baseDir || process.cwd();
  const mode = opts.mode || "overwrite";
  const file = resolveTarget(target, baseDir);

  if (!fs.existsSync(file)) {
    return { ok: false, action: "update", file, message: "File not found (use create instead)." };
  }

  const backup = file + "." + timestamp() + ".bak"; // back up before we touch it
  fs.copyFileSync(file, backup);

  let final = content;
  if (mode === "append") final = fs.readFileSync(file, "utf8") + content;
  else if (mode === "prepend") final = content + fs.readFileSync(file, "utf8");

  fs.writeFileSync(file, final, "utf8");
  return { ok: true, action: "update", file, mode, backup, bytes: Buffer.byteLength(final) };
}

function remove(target, options) {
  const opts = options || {};
  const baseDir = opts.baseDir || process.cwd();
  const file = resolveTarget(target, baseDir);

  if (!fs.existsSync(file)) {
    return { ok: false, action: "delete", file, message: "File not found." };
  }
  const stat = fs.statSync(file);
  if (stat.isDirectory()) {
    return { ok: false, action: "delete", file, message: "Refusing to delete a directory." };
  }

  const backup = file + "." + timestamp() + ".bak";
  fs.copyFileSync(file, backup); // keep a copy, then delete
  fs.unlinkSync(file);
  return { ok: true, action: "delete", file, backup };
}

// one level of a directory, with file sizes
function list(target, options) {
  const opts = options || {};
  const baseDir = opts.baseDir || process.cwd();
  const dir = resolveTarget(target || ".", baseDir);

  if (!fs.existsSync(dir)) {
    return { ok: false, action: "list", dir, message: "Directory not found." };
  }

  const entries = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
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

module.exports = { create, read, update, remove, list, resolveTarget };
