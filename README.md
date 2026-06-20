# SysScope

> A JavaScript (Node.js) tool that **gathers and displays system information &
> environment variables** and performs **CRUD operations on code/text files**.
> Built for **Thunder Hackathon 3.0 — "Create a virus in JS."**

Despite the playful hackathon title, SysScope is a **benign system-diagnostics
utility**. It only *reads* information about the machine it runs on and performs
*file operations you explicitly ask for* inside a sandbox. It contains no
self-replication, no networking, and no persistence — nothing that an actual
virus would do.

---

## New to the code? Read it in this order

The project is split into small files that each do **one** job, and every file
opens with a plain-English `PLAIN-ENGLISH SUMMARY` comment explaining what it
does. If you're reading the source for the first time, follow this path:

| # | File | What it does | Start here if you want to understand… |
|---|---|---|---|
| 1 | `index.js` | The "front desk." Reads your command and calls the right function. | how the program starts and flows |
| 2 | `src/sysinfo.js` | Gathers facts about the computer (OS, CPU, memory…). | where the system info comes from |
| 3 | `src/env.js` | Reads environment variables, hiding secrets. | the safety / redaction idea |
| 4 | `src/crud.js` | Create / read / update / delete files, sandboxed. | the file operations |
| 5 | `src/output.js` | Turns plain data into coloured tables. | how the pretty output is made |
| 6 | `src/live.js` | The live, auto-refreshing dashboard. | the CPU-usage measuring trick |
| 7 | `src/menu.js` | The interactive number menu. | the menu |

**One idea to remember:** `index.js` only *routes and prints*. The real work
lives in the `src/` files, and both the command-line and the menu call the
**same** functions — so behaviour can never drift between them.

---

## What it collects

| Category | Fields |
|---|---|
| **Operating system** | platform (raw + friendly name), type, release, kernel/build version, architecture, endianness |
| **CPU** | architecture, model, core count, clock speed, load average (1/5/15 min) |
| **Host** | hostname |
| **Node.js runtime** | Node version, V8 version, executable path, process ID |
| **User & paths** | username, home directory, login shell, temp directory, working directory, path separator |
| **Memory & uptime** | total / used / free memory (bytes + human-readable), system uptime, process uptime |
| **Network** | every interface: family, address, internal flag, MAC |
| **Environment variables** | an allow-listed selection (see below), with secrets auto-redacted |

### Why an allow-list for environment variables?

`process.env` routinely contains API keys, tokens, and passwords. Dumping all of
it would turn a diagnostic tool into a data-leak. SysScope therefore:

1. Shows only a **curated list** of common, non-sensitive variables
   (`USER`, `HOME`, `PATH`, `SHELL`, `LANG`, `NODE_ENV`, …).
2. **Redacts** any variable whose name looks secret-ish
   (`*SECRET*`, `*TOKEN*`, `*PASSWORD*`, `*API_KEY*`, `*CREDENTIAL*`, …),
   even if you ask for it explicitly.
3. Reports **missing** variables as `N/A` instead of crashing.

---

## Installation & requirements

- **Node.js ≥ 14** (developed and tested on Node 22). No `npm install` needed —
  **zero external dependencies**; everything uses Node's built-in modules
  (`os`, `process`, `path`, `fs`, `readline`).

```bash
# from the project folder
node index.js help
```

---

## Usage

```bash
node index.js [command] [options]
```

### Commands

| Command | Description |
|---|---|
| `info` | Full system information report (this is the default) |
| `env` | Show the selected environment variables |
| `network` | List network interfaces |
| `live` | Live, auto-refreshing CPU / memory dashboard (Ctrl-C to exit) |
| `save` | Write the full report to a timestamped `sysscope-report-*.json` |
| `menu` | Launch the interactive number-driven menu |
| `crud <op> …` | File operations: `create` / `read` / `update` / `delete` / `list` |
| `help` | Show built-in help |

### Global options

| Option | Effect |
|---|---|
| `--json` | Emit machine-readable JSON instead of pretty tables |
| `--no-color` | Disable ANSI colours (also auto-disabled when piped or when `NO_COLOR` is set) |

### CRUD examples

```bash
node index.js crud create demo/hello.js "console.log('hi')"
node index.js crud read   demo/hello.js
node index.js crud update demo/hello.js "// appended" --mode append
node index.js crud delete demo/hello.js
node index.js crud list   demo
```

`--mode` for `update` accepts `overwrite` (default), `append`, or `prepend`.

---

## Code flow & strategy

```
                       ┌─────────────┐
   user runs           │  index.js   │   parseArgs() → { command, flags }
   `node index.js …` ─▶│  (router)   │
                       └──────┬──────┘
            ┌─────────────────┼───────────────────┬─────────────┐
            ▼                 ▼                   ▼             ▼
     ┌────────────┐    ┌────────────┐      ┌────────────┐ ┌──────────┐
     │ sysinfo.js │    │   env.js   │      │  crud.js   │ │ live.js  │
     │ collect()  │    │ select()   │      │ create/    │ │ start()  │
     │ network()  │    │ summary()  │      │ read/update│ │ dashboard│
     └─────┬──────┘    └─────┬──────┘      │ delete/list│ └────┬─────┘
           │                 │             └─────┬──────┘      │
           └────────┬────────┴───────────────────┴─────────────┘
                    ▼
              ┌────────────┐         menu.js drives the same handlers
              │ output.js  │◀──────  interactively (readline)
              │ tables /   │
              │ colours /  │
              │ JSON       │
              └────────────┘
```

**Separation of concerns.** Each capability lives in its own module under
`src/`, and `index.js` is a thin router that wires them to either CLI flags or
the interactive menu — both paths call the *exact same* handler functions, so
behaviour can't drift between them.

1. **`index.js` — router & presentation glue.**
   A tiny dependency-free argument parser turns `process.argv` into a command +
   flags object, then a `switch` dispatches to the right renderer. A top-level
   `.catch()` is the global error boundary so the tool never dies with a raw
   stack trace.

2. **`src/sysinfo.js` — data gathering.**
   Every field is wrapped in a `safe(fn)` helper that returns `null` if a lookup
   throws or is empty. This is the backbone of *"handle missing values
   gracefully"*: one unusual platform can't take down the whole report. Raw
   numbers (bytes, seconds, platform codes) are also converted to friendly forms.

3. **`src/env.js` — environment variables.**
   Allow-list + secret-redaction + missing→`null`, as described above.

4. **`src/crud.js` — file operations, defensively.**
   - **Sandbox:** `resolveSafe()` resolves every path against a base directory
     and rejects anything that escapes it, blocking path-traversal
     (`../../etc/passwd`).
   - **Backups:** `update` and `delete` copy the file to a timestamped `.bak`
     *before* changing it — no operation is irreversible.
   - **Structured results:** every function returns `{ ok, action, … }` so
     callers can render success or failure consistently (and as JSON).

5. **`src/live.js` — live dashboard.**
   Samples `os.cpus()` twice and compares idle-vs-total deltas to compute real
   CPU usage, redrawing in place with ANSI cursor control once per second.

6. **`src/output.js` — presentation.**
   Hand-rolled ANSI colours and table rendering (no third-party TUI lib).
   Colour auto-disables when output isn't a TTY, when `NO_COLOR` is set, or with
   `--no-color`. `null`/empty values render as a dim `N/A`.

7. **`src/menu.js` — interactive UI.**
   A `readline`-based menu that reuses the handlers from `index.js`, including a
   CRUD sub-menu with a confirmation prompt before deletes.

### Error-handling strategy (summary)

| Failure | How it's handled |
|---|---|
| A system lookup throws | `safe()` returns `null` → rendered as `N/A` |
| Missing env var | Reported as `null` / `N/A`, never throws |
| Secret-looking env var | Redacted as `«redacted»` |
| Path escapes the sandbox | Rejected with a clear "Refused" message |
| File not found