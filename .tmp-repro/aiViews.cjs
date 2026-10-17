"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// .tmp-repro/vscode-stub.js
var require_vscode_stub = __commonJS({
  ".tmp-repro/vscode-stub.js"(exports2, module2) {
    "use strict";
    var path3 = require("path");
    var box = () => globalThis.__vscodeStub = globalThis.__vscodeStub || { config: {}, folders: [] };
    module2.exports = {
      workspace: {
        getConfiguration: () => ({ get: (key) => box().config[key] }),
        get workspaceFolders() {
          return box().folders;
        },
        createFileSystemWatcher: () => ({ onDidChange() {
        }, dispose() {
        } }),
        fs: { readFile: async () => new Uint8Array() }
      },
      Uri: {
        joinPath: (base, ...parts) => ({ fsPath: path3.join(base.fsPath, ...parts) }),
        file: (p) => ({ fsPath: p }),
        parse: (s) => ({ fsPath: s, toString: () => s })
      },
      window: {
        withProgress: async (_opts, task) => task({ report() {
        } }, { onCancellationRequested() {
        } }),
        showInformationMessage: async () => void 0,
        showWarningMessage: async () => void 0,
        showErrorMessage: async () => void 0,
        showQuickPick: async () => void 0,
        registerWebviewViewProvider: () => ({ dispose() {
        } }),
        registerCustomEditorProvider: () => ({ dispose() {
        } }),
        tabGroups: { activeTabGroup: { activeTab: void 0 } }
      },
      commands: { executeCommand: async () => void 0, registerCommand: () => ({ dispose() {
      } }) },
      ProgressLocation: { Notification: 15 },
      env: { openExternal: async () => true }
    };
  }
});

// src/aiViews.ts
var aiViews_exports = {};
__export(aiViews_exports, {
  AiHub: () => AiHub,
  ChatViewProvider: () => ChatViewProvider,
  LlamaViewProvider: () => LlamaViewProvider,
  registerAiViews: () => registerAiViews
});
module.exports = __toCommonJS(aiViews_exports);
var vscode = __toESM(require_vscode_stub());
var fs2 = __toESM(require("fs"));
var os2 = __toESM(require("os"));
var path2 = __toESM(require("path"));

// src/llamaCore.ts
var fs = __toESM(require("fs"));
var fsp = __toESM(require("fs/promises"));
var os = __toESM(require("os"));
var path = __toESM(require("path"));
var http = __toESM(require("http"));
var import_child_process = require("child_process");
var import_util = require("util");
var execFileAsync = (0, import_util.promisify)(import_child_process.execFile);
function osFolder(platform = process.platform) {
  if (platform === "win32") {
    return "win";
  }
  if (platform === "darwin") {
    return "mac";
  }
  if (platform === "linux") {
    return "linux";
  }
  return null;
}
function osLabel(platform = process.platform) {
  const f = osFolder(platform);
  return f ? `${platform} \u2192 folder "${f}/"` : `${platform} \u2192 belum didukung`;
}
function binaryCandidates(extensionPath, platform = process.platform) {
  const folder = osFolder(platform);
  if (!folder) {
    return [];
  }
  const names = platform === "win32" ? ["llama-server.exe", "llama-server", "server.exe", "bin/llama-server.exe", "build/bin/Release/llama-server.exe"] : ["llama-server", "llama-server-arm64", "server", "bin/llama-server"];
  return names.map((n) => path.join(extensionPath, folder, n.split("/").join(path.sep)));
}
function resolveServerBinary(extensionPath, platform = process.platform) {
  const candidates = binaryCandidates(extensionPath, platform);
  const chosen = candidates.find((p) => isFile(p));
  return { folder: osFolder(platform), candidates, chosen };
}
function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}
var SKIP_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "obj",
  "dist",
  "build",
  "target",
  "vendor",
  "$recycle.bin",
  "system volume information",
  "recovery",
  "perflogs",
  "winsxs",
  "winsat",
  "windows",
  "program files",
  "program files (x86)",
  "programdata",
  "temp",
  "tmp",
  "crashdumps",
  "proc",
  "sys",
  "dev",
  "run",
  "boot",
  "lost+found",
  "snap",
  "etc",
  "var",
  "bin",
  "sbin",
  "lib",
  "lib64",
  "usr",
  "system",
  "library",
  "applications",
  "private",
  "cores"
]);
function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
var storageCache;
async function listStorageRoots(platform = process.platform, cacheMs = 6e5) {
  if (storageCache && storageCache.platform === platform && Date.now() - storageCache.at < cacheMs) {
    return storageCache.roots;
  }
  const roots = platform === "win32" ? await listWindowsRoots() : platform === "darwin" ? ["/", ...listDirNames("/Volumes").map((n) => path.join("/Volumes", n))] : ["/", ...["/media", "/mnt", "/run/media", "/opt"].flatMap((base) => [base, ...listDirNames(base).map((n) => path.join(base, n))])];
  const uniq = [...new Set(roots.filter((r) => !!r && isDir(r)))];
  storageCache = { roots: uniq, at: Date.now(), platform };
  return uniq;
}
async function listWindowsRoots() {
  const fromShell = [];
  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "(Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root) -join [Environment]::NewLine"
    ], { timeout: 8e3, windowsHide: true });
    for (const line of String(stdout).split(/\r?\n/)) {
      const root = line.trim();
      if (/^[A-Za-z]:\\$/.test(root)) {
        fromShell.push(root.toUpperCase());
      }
    }
  } catch {
  }
  if (fromShell.length) {
    return fromShell;
  }
  const probed = [];
  const budget = Date.now() + 1e4;
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (Date.now() > budget) {
      break;
    }
    const root = `${letter}:\\`;
    if (await existsWithin(root, 1200)) {
      probed.push(root);
    }
  }
  return probed;
}
function listDirNames(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}
async function existsWithin(target, ms) {
  let timer;
  try {
    return await Promise.race([
      fsp.stat(target).then((s) => s.isDirectory(), () => false),
      new Promise((r) => {
        timer = setTimeout(() => r(false), ms);
        if (typeof timer.unref === "function") {
          timer.unref();
        }
      })
    ]);
  } catch {
    return false;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
function scanGgufModels(roots, opts = {}) {
  const maxDepth = opts.maxDepth ?? 6;
  const maxEntries = opts.maxEntries ?? 3e5;
  const timeoutMs = opts.timeoutMs ?? 6e4;
  const concurrency = Math.max(1, Math.min(16, opts.concurrency ?? 6));
  const progressEvery = opts.progressIntervalMs ?? 400;
  const startedAt = Date.now();
  const found = [];
  const seen = /* @__PURE__ */ new Set();
  const queue = [];
  for (const root of roots) {
    if (!root) {
      continue;
    }
    const abs = path.resolve(root);
    if (!isDir(abs)) {
      continue;
    }
    queue.push({ dir: abs, depth: 0 });
  }
  let dirs = 0;
  let entries = 0;
  let active = 0;
  let current = queue[0]?.dir ?? "";
  let lastReport = 0;
  let settled = false;
  const cancelled = () => !!opts.isCancelled?.();
  const beyondLimits = () => entries > maxEntries || Date.now() - startedAt > timeoutMs;
  const stopped = () => cancelled() || beyondLimits();
  const report = (done, force = false) => {
    const now = Date.now();
    if (!done && !force && now - lastReport < progressEvery) {
      return;
    }
    lastReport = now;
    opts.onProgress?.({
      dirs,
      entries,
      found: found.length,
      root: current,
      elapsedMs: now - startedAt,
      done,
      cancelled: cancelled(),
      timedOut: now - startedAt > timeoutMs,
      truncated: entries > maxEntries
    });
  };
  const visit = async (job) => {
    if (stopped()) {
      return;
    }
    current = job.dir;
    let items;
    try {
      items = await fsp.readdir(job.dir, { withFileTypes: true });
    } catch {
      return;
    }
    dirs++;
    for (const entry of items) {
      if (stopped()) {
        return;
      }
      entries++;
      report(false);
      if (entry.isSymbolicLink()) {
        continue;
      }
      const full = path.join(job.dir, entry.name);
      if (entry.isDirectory()) {
        if (job.depth < maxDepth && !SKIP_DIRS.has(entry.name.toLowerCase())) {
          queue.push({ dir: full, depth: job.depth + 1 });
        }
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".gguf")) {
        continue;
      }
      const key = full.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      let size = 0;
      try {
        size = (await fsp.stat(full)).size;
      } catch {
      }
      const part = /(\d{4,5})-of-(\d{4,5})/i.exec(entry.name);
      const file = { path: full, name: entry.name, sizeBytes: size, multipart: !!part, part: part ? part[0] : void 0 };
      found.push(file);
      opts.onFound?.(file, found.length);
    }
  };
  return new Promise((resolve2) => {
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      report(true, true);
      resolve2(sortModels(found));
    };
    const pump = () => {
      if (settled) {
        return;
      }
      if (active === 0 && (queue.length === 0 || stopped())) {
        finish();
        return;
      }
      while (active < concurrency && queue.length && !stopped()) {
        const job = queue.shift();
        active++;
        void visit(job).then(() => {
          active--;
          pump();
        }, () => {
          active--;
          pump();
        });
      }
    };
    pump();
  });
}
function sortModels(list) {
  return [...list].sort((a, b) => {
    const aTail = a.part ? !/00001-of-/i.test(a.name) : false;
    const bTail = b.part ? !/00001-of-/i.test(b.name) : false;
    if (aTail !== bTail) {
      return aTail ? 1 : -1;
    }
    return b.sizeBytes - a.sizeBytes;
  });
}
function defaultModelRoots(homeDir = os.homedir(), platform = process.platform) {
  const env = process.env;
  const home = homeDir;
  const list = [];
  const add = (...items) => {
    for (const it of items) {
      if (it) {
        list.push(it);
      }
    }
  };
  if (platform === "win32") {
    const local = env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    const roaming = env.APPDATA || path.join(home, "AppData", "Roaming");
    add(
      path.join(home, "Downloads"),
      path.join(home, "Documents"),
      path.join(home, "Desktop"),
      path.join(home, "Models"),
      path.join(home, "models"),
      path.join(home, "LLM"),
      path.join(home, "llama.cpp"),
      path.join(home, ".lmstudio", "models"),
      path.join(home, "jan", "models"),
      path.join(home, ".cache", "llama.cpp"),
      path.join(home, ".cache", "lm-studio", "models"),
      path.join(home, ".cache", "huggingface", "hub"),
      path.join(home, ".ollama", "models"),
      path.join(local, "LM-Studio", "models"),
      path.join(local, "nomic.ai", "GPT4All"),
      path.join(roaming, "Jan", "data", "models"),
      path.join(roaming, "anythingllm-desktop", "storage", "models"),
      env.OneDrive ? path.join(env.OneDrive, "Documents") : void 0,
      env.OneDrive ? path.join(env.OneDrive, "Desktop") : void 0,
      env.OneDrive ? path.join(env.OneDrive, "Models") : void 0
    );
  } else if (platform === "darwin") {
    const support = path.join(home, "Library", "Application Support");
    add(
      path.join(home, "Downloads"),
      path.join(home, "Documents"),
      path.join(home, "Desktop"),
      path.join(home, "Models"),
      path.join(home, "models"),
      path.join(home, "LLM"),
      path.join(home, ".lmstudio", "models"),
      path.join(home, "jan", "models"),
      path.join(home, ".cache", "llama.cpp"),
      path.join(home, ".cache", "lm-studio", "models"),
      path.join(home, ".cache", "huggingface", "hub"),
      path.join(home, ".ollama", "models"),
      path.join(support, "nomic.ai", "GPT4All"),
      path.join(support, "Jan", "data", "models"),
      path.join(home, "Library", "Caches", "llama.cpp")
    );
  } else {
    add(
      path.join(home, "Downloads"),
      path.join(home, "Documents"),
      path.join(home, "Desktop"),
      path.join(home, "Models"),
      path.join(home, "models"),
      path.join(home, "LLM"),
      path.join(home, "llama.cpp"),
      path.join(home, ".lmstudio", "models"),
      path.join(home, "jan", "models"),
      path.join(home, ".cache", "llama.cpp"),
      path.join(home, ".cache", "lm-studio", "models"),
      path.join(home, ".cache", "huggingface", "hub"),
      path.join(home, ".ollama", "models"),
      path.join(home, ".local", "share", "nomic.ai", "GPT4All"),
      "/usr/share/llama.cpp",
      "/usr/local/share/models",
      "/opt/models"
    );
  }
  const uniq = /* @__PURE__ */ new Map();
  for (const p of list) {
    const key = platform === "win32" ? p.toLowerCase() : p;
    if (!uniq.has(key)) {
      uniq.set(key, p);
    }
  }
  return [...uniq.values()];
}
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
function httpRequest(port, pathName, opts = {}) {
  return new Promise((resolve2, reject) => {
    const payload = opts.body;
    const req = http.request({
      host: opts.host ?? "127.0.0.1",
      port,
      path: pathName,
      method: opts.method ?? "GET",
      headers: payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : void 0,
      timeout: opts.timeoutMs ?? 5e3
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => {
        body += c;
      });
      res.on("end", () => resolve2({ status: res.statusCode ?? 0, body }));
    });
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}
function chatStream(o) {
  const body = JSON.stringify({
    model: "local-model",
    messages: o.messages,
    temperature: o.temperature ?? 0.2,
    top_p: o.topP ?? 0.95,
    max_tokens: o.maxTokens && o.maxTokens > 0 ? o.maxTokens : void 0,
    stream: true
  });
  let full = "";
  let finished = false;
  let resolveDone;
  let rejectDone;
  const done = new Promise((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });
  const req = http.request({
    host: o.host ?? "127.0.0.1",
    port: o.port,
    path: "/v1/chat/completions",
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "Accept": "text/event-stream" }
  }, (res) => {
    const status = res.statusCode ?? 0;
    if (status >= 400) {
      let err = "";
      res.setEncoding("utf8");
      res.on("data", (c) => {
        err += c;
      });
      res.on("end", () => {
        if (finished) {
          return;
        }
        finished = true;
        rejectDone(new Error(`llama-server membalas HTTP ${status}: ${err.slice(0, 300) || "tanpa pesan"}`));
      });
      return;
    }
    res.setEncoding("utf8");
    let buf = "";
    res.on("data", (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const raw = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!raw || !raw.startsWith("data:")) {
          continue;
        }
        const data = raw.slice(5).trim();
        if (data === "[DONE]") {
          continue;
        }
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.text ?? "";
          if (typeof delta === "string" && delta) {
            full += delta;
            o.onDelta(delta);
          }
        } catch {
        }
      }
    });
    res.on("end", () => {
      if (finished) {
        return;
      }
      finished = true;
      resolveDone(full);
    });
    res.on("error", (e) => {
      if (finished) {
        return;
      }
      finished = true;
      rejectDone(e);
    });
  });
  req.on("error", (e) => {
    if (finished) {
      return;
    }
    finished = true;
    rejectDone(e);
  });
  req.write(body);
  req.end();
  return {
    abort: () => {
      try {
        req.destroy(new Error("dibatalkan pengguna"));
      } catch {
      }
    },
    done
  };
}
var LlamaServer = class {
  constructor(opts) {
    this.opts = opts;
    this.platform = opts.platform ?? process.platform;
    this.maxLog = opts.maxLogLines ?? 4e3;
    this.st.osFolder = osFolder(this.platform);
  }
  child;
  st = { state: "stopped", port: 0 };
  platform;
  maxLog;
  logs = [];
  get status() {
    return { ...this.st };
  }
  get running() {
    return this.st.state === "running" || this.st.state === "starting";
  }
  binaryInfo() {
    return resolveServerBinary(this.opts.extensionPath, this.platform);
  }
  log(line) {
    const clean = line.replace(/\r$/, "");
    this.logs.push(clean);
    if (this.logs.length > this.maxLog) {
      this.logs.splice(0, this.logs.length - this.maxLog);
    }
    this.opts.onLog?.(clean);
  }
  clearLogs() {
    this.logs.length = 0;
  }
  setState(patch) {
    this.st = { ...this.st, ...patch };
    this.opts.onStatus?.(this.status);
    return this.status;
  }
  /** Argumen CLI llama-server yang dipakai (juga ditampilkan di view output). */
  buildArgs(cfg) {
    const args = [
      "-m",
      cfg.modelPath,
      "--host",
      cfg.host ?? "127.0.0.1",
      "--port",
      String(cfg.port),
      "-c",
      String(cfg.contextSize)
    ];
    if (cfg.gpuLayers && cfg.gpuLayers > 0) {
      args.push("-ngl", String(cfg.gpuLayers));
    }
    if (cfg.threads && cfg.threads > 0) {
      args.push("-t", String(cfg.threads));
    }
    if (cfg.extraArgs && cfg.extraArgs.length) {
      args.push(...cfg.extraArgs);
    }
    return args;
  }
  async start(cfg) {
    if (this.child) {
      await this.stop();
    }
    const bin = cfg.binaryPath ?? this.binaryInfo().chosen;
    if (!bin) {
      const info = this.binaryInfo();
      const msg = `Biner llama-server tidak ditemukan untuk ${osLabel(this.platform)}. Letakkan berkasnya di: ${info.candidates[0]}`;
      this.log(`[error] ${msg}`);
      this.setState({ state: "error", port: cfg.port, message: msg, modelPath: cfg.modelPath });
      throw new Error(msg);
    }
    if (!isFile(cfg.modelPath)) {
      const msg = `Berkas model tidak ditemukan: ${cfg.modelPath}`;
      this.log(`[error] ${msg}`);
      this.setState({ state: "error", port: cfg.port, message: msg, modelPath: cfg.modelPath, binaryPath: bin });
      throw new Error(msg);
    }
    const args = this.buildArgs(cfg);
    this.log(`[info] OS ${this.platform} \u2192 ${osLabel(this.platform)}`);
    this.log(`[info] Perintah: "${bin}" ${args.join(" ")}`);
    this.setState({ state: "starting", port: cfg.port, modelPath: cfg.modelPath, binaryPath: bin, pid: void 0, message: "Memuat model\u2026", startedAt: Date.now() });
    const child = (0, import_child_process.spawn)(bin, args, {
      cwd: path.dirname(bin),
      windowsHide: true,
      env: { ...process.env, LLAMA_LOG_COLORS: "0" }
    });
    this.child = child;
    this.setState({ pid: child.pid });
    const pipe = (stream) => {
      stream?.setEncoding?.("utf8");
      stream?.on("data", (chunk) => {
        for (const line of String(chunk).split("\n")) {
          if (line.trim().length) {
            this.log(line);
          }
        }
      });
    };
    pipe(child.stdout);
    pipe(child.stderr);
    let exitInfo = "";
    child.on("exit", (code, signal) => {
      exitInfo = `berhenti (kode ${code ?? "-"}${signal ? `, sinyal ${signal}` : ""})`;
      this.log(`[info] llama-server ${exitInfo}`);
      if (this.child === child) {
        this.child = void 0;
        this.setState({ state: this.st.state === "stopping" ? "stopped" : "error", pid: void 0, message: this.st.state === "stopping" ? void 0 : exitInfo });
      }
    });
    child.on("error", (err) => {
      const hint = err.code === "EACCES" ? ` \u2192 beri izin eksekusi dulu: chmod +x "${bin}"` : "";
      this.log(`[error] gagal menjalankan proses: ${err.message}${hint}`);
      this.setState({ state: "error", message: `${err.message}${hint}`, pid: void 0 });
    });
    const timeoutMs = cfg.startupTimeoutMs ?? 18e4;
    const healthy = await this.waitHealthy(cfg.port, timeoutMs, () => this.child === child);
    if (!healthy) {
      const detail = this.st.state === "error" ? this.st.message ?? "proses berhenti" : `tidak merespons dalam ${Math.round(timeoutMs / 1e3)} detik`;
      this.setState({ state: "error", message: `llama-server ${detail}` });
      throw new Error(`llama-server ${detail}`);
    }
    this.log(`[info] llama-server siap di http://${cfg.host ?? "127.0.0.1"}:${cfg.port}`);
    return this.setState({ state: "running", message: "Siap menerima permintaan", pid: child.pid });
  }
  async waitHealthy(port, timeoutMs, alive) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!alive()) {
        return false;
      }
      try {
        const res = await httpRequest(port, "/health", { timeoutMs: 1500 });
        if (res.status === 200) {
          return true;
        }
      } catch {
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  }
  async stop() {
    const child = this.child;
    if (!child) {
      return this.setState({ state: "stopped", pid: void 0, message: void 0 });
    }
    this.setState({ state: "stopping", message: "Menghentikan server\u2026" });
    const pid = child.pid;
    if (this.platform === "win32" && pid) {
      try {
        const killer = (0, import_child_process.spawn)("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
        await new Promise((resolve2) => {
          killer.on("exit", () => resolve2());
          killer.on("error", () => resolve2());
          setTimeout(resolve2, 4e3);
        });
      } catch {
      }
    }
    await new Promise((r) => setTimeout(r, 400));
    if (this.child === child) {
      try {
        child.kill();
      } catch {
      }
      if (this.platform !== "win32" && pid) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
        }
      }
    }
    this.child = void 0;
    return this.setState({ state: "stopped", pid: void 0, message: void 0 });
  }
};

// src/analysisStore.ts
var MAX_ENTRIES = 12;
var AnalysisStore = class {
  items = /* @__PURE__ */ new Map();
  lastId;
  set(id, result, label) {
    const entry = {
      id,
      label: label || result.fileName,
      fileName: result.fileName,
      sheetNames: (result.sheets || []).map((s) => s.name),
      result,
      updatedAt: Date.now()
    };
    this.items.set(id, entry);
    this.lastId = id;
    if (this.items.size > MAX_ENTRIES) {
      const oldest = [...this.items.values()].sort((a, b) => a.updatedAt - b.updatedAt).slice(0, this.items.size - MAX_ENTRIES);
      for (const o of oldest) {
        if (o.id !== this.lastId) {
          this.items.delete(o.id);
        }
      }
    }
    return entry;
  }
  get(id) {
    return id ? this.items.get(id) : void 0;
  }
  last() {
    return this.lastId ? this.items.get(this.lastId) : void 0;
  }
  resolve(preferredId) {
    return this.get(preferredId) ?? this.last();
  }
  list() {
    return [...this.items.values()].sort((a, b) => b.updatedAt - a.updatedAt).map((e) => {
      const sheet = e.result.sheets?.[0];
      return {
        id: e.id,
        label: e.label,
        sheets: e.sheetNames,
        updatedAt: e.updatedAt,
        rows: sheet?.totalRows ?? 0,
        hasKpi: !!sheet?.businessKpi,
        hasDecisionTree: !!sheet?.decisionTreeAnalysis,
        hasStock: !!sheet?.stockAnalysis
      };
    });
  }
  clear() {
    this.items.clear();
    this.lastId = void 0;
  }
};
var globalAnalysisStore = new AnalysisStore();
function nf(value, digits = 2) {
  if (value === null || value === void 0 || !isFinite(value)) {
    return "-";
  }
  return value.toLocaleString("id-ID", { maximumFractionDigits: digits });
}
function pct(value, digits = 2) {
  if (value === null || value === void 0 || !isFinite(value)) {
    return "-";
  }
  return `${nf(value, digits)}%`;
}
function listTop(items, take) {
  return (items || []).slice(0, take).map((x) => `${x.label} (${nf(x.value)})`).join(", ") || "-";
}
function columnLine(c) {
  if (c.num) {
    const n = c.num;
    return `- ${c.name} [numerik]: min ${nf(n.min)} \xB7 mean ${nf(n.mean)} \xB7 median ${nf(n.median)} \xB7 max ${nf(n.max)} \xB7 std ${nf(n.std)} \xB7 outlier ${nf(n.outliers, 0)}`;
  }
  if (c.type === "date") {
    return `- ${c.name} [tanggal]: ${c.dateMin ?? "?"} \u2192 ${c.dateMax ?? "?"} (granularitas ${c.gran ?? "?"})`;
  }
  const top = (c.top || []).slice(0, 5).map((t) => `${t.value} ${nf(t.count, 0)}`).join(" | ");
  return `- ${c.name} [${c.type}]: unik ${nf(c.unique, 0)}${top ? ` \xB7 teratas: ${top}` : ""}`;
}
function buildStatsContext(entry, sheetName, maxChars = 7e3) {
  const sheets = entry.result.sheets || [];
  const sheet = sheets.find((s) => s.name === sheetName) ?? sheets[0];
  if (!sheet) {
    return "Tidak ada data analisis yang tersedia.";
  }
  const parts = [];
  const cols = sheet.columns || [];
  const numCols = cols.filter((c) => c.num);
  const catCols = cols.filter((c) => c.type === "category" || c.type === "boolean");
  const dateCols = cols.filter((c) => c.type === "date");
  parts.push("=== KONTEKS DATA (hasil analisis Date Skunder) ===");
  parts.push(`Berkas: ${entry.fileName} \xB7 Sheet: ${sheet.name} \xB7 ${nf(sheet.totalRows, 0)} baris \xD7 ${sheet.headers?.length ?? cols.length} kolom${sheet.truncated ? " (dianalisis sebagian karena berkas besar)" : ""}`);
  parts.push(`Kolom: ${numCols.length} numerik, ${catCols.length} kategorikal, ${dateCols.length} tanggal. Sel kosong ${nf(sheet.missingCells, 0)}; baris duplikat ${nf(sheet.duplicates, 0)}.`);
  const health = sheet.csvHealth;
  if (health) {
    parts.push(`Kualitas CSV: skor ${nf(health.qualityScore, 0)}% (${health.qualityRating}); kelengkapan ${nf(health.completenessScore, 0)}%, konsistensi ${nf(health.consistencyScore, 0)}%, integritas ${nf(health.integrityScore, 0)}%.`);
  }
  if (numCols.length) {
    parts.push("Statistik kolom numerik:");
    parts.push(...numCols.slice(0, 10).map(columnLine));
  }
  if (catCols.length) {
    parts.push("Kolom kategorikal:");
    parts.push(...catCols.slice(0, 6).map(columnLine));
  }
  if (dateCols.length) {
    parts.push("Kolom tanggal:");
    parts.push(...dateCols.slice(0, 3).map(columnLine));
  }
  const corrPairs = collectCorrelations(sheet).slice(0, 6);
  if (corrPairs.length) {
    parts.push(`Korelasi kuat: ${corrPairs.map((p) => `${p.a} \u2194 ${p.b} (r=${nf(p.r, 3)})`).join("; ")}`);
  }
  const kpi = sheet.businessKpi;
  if (kpi) {
    const s = kpi.summary;
    parts.push("KPI bisnis:");
    parts.push(`- Pendapatan ${nf(s.totalRevenue)} dari ${nf(s.totalOrders, 0)} order (AOV ${nf(s.avgOrderValue)}); biaya ${nf(s.totalCost)}; laba kotor ${nf(s.grossProfit)}; margin ${pct(s.grossMarginPct)}.`);
    parts.push(`- Unit terjual ${nf(s.totalUnits)}; item per order ${nf(s.itemsPerOrder)}; diskon ${nf(s.totalDiscount)} (${pct(s.discountRatePct)} dari nilai kotor).`);
    parts.push(`- Pelanggan ${nf(s.customers, 0)}; pendapatan/pelanggan ${nf(s.revenuePerCustomer)}; pelanggan berulang ${pct(s.repeatCustomerRatePct)}; retensi antarperiode ${pct(s.avgRetentionPct)}; kontribusi 10% pelanggan teratas ${pct(s.top10PctCustomerSharePct)}.`);
    parts.push(`- Pertumbuhan: periode terakhir ${pct(kpi.growth.latestGrowthPct)}; rata-rata ${pct(kpi.growth.avgGrowthPct)}; periode terbaik ${kpi.growth.best?.period ?? "-"}, terlemah ${kpi.growth.worst?.period ?? "-"}.`);
    if (kpi.concentration) {
      parts.push(`- Konsentrasi: ${nf(kpi.concentration.paretoItems, 0)} ${kpi.concentration.basis} (${pct(kpi.concentration.paretoPct)}) menghasilkan 80% pendapatan; HHI ${nf(kpi.concentration.hhi, 0)}.`);
    }
    if (kpi.topProducts?.length) {
      parts.push(`- Produk teratas: ${kpi.topProducts.slice(0, 5).map((p) => `${p.label} ${nf(p.revenue)} (${pct(p.share, 1)})`).join("; ")}`);
    }
    if (kpi.topCategories?.length) {
      parts.push(`- Kategori teratas: ${kpi.topCategories.slice(0, 5).map((p) => `${p.label} ${nf(p.revenue)}`).join("; ")}`);
    }
    if (kpi.topRegions?.length) {
      parts.push(`- Wilayah teratas: ${kpi.topRegions.slice(0, 5).map((p) => `${p.label} ${nf(p.revenue)}`).join("; ")}`);
    }
    if (kpi.topCustomers?.length) {
      parts.push(`- Pelanggan teratas: ${kpi.topCustomers.slice(0, 5).map((p) => `${p.label} ${nf(p.revenue)}`).join("; ")}`);
    }
    if (kpi.growth.periods?.length) {
      parts.push(`- Tren per periode: ${kpi.growth.periods.map((p) => `${p.period} ${nf(p.revenue)}${p.growthPct === null ? "" : ` (${p.growthPct >= 0 ? "+" : ""}${nf(p.growthPct, 1)}%)`}`).join(" | ")}`);
    }
  }
  const stock = sheet.stockAnalysis;
  if (stock) {
    const k = stock.kpis;
    parts.push(`Stok/inventaris: ${nf(k.totalSKUs, 0)} SKU; volume ${nf(k.totalStockVolume)}; valuasi ${nf(k.totalValuation)}; ${nf(k.criticalCount, 0)} kritis, ${nf(k.lowCount, 0)} menipis, ${nf(k.healthyCount, 0)} aman, ${nf(k.overstockCount, 0)} overstock.`);
    if (stock.abcSummary) {
      parts.push(`Kelas ABC: A ${nf(stock.abcSummary.classA.count, 0)} SKU (${pct(stock.abcSummary.classA.valPct, 1)} nilai), B ${nf(stock.abcSummary.classB.count, 0)} (${pct(stock.abcSummary.classB.valPct, 1)}), C ${nf(stock.abcSummary.classC.count, 0)} (${pct(stock.abcSummary.classC.valPct, 1)}).`);
    }
    if (stock.topStock?.length) {
      parts.push(`Stok terbanyak: ${listTop(stock.topStock, 5)}`);
    }
    if (stock.bottomStock?.length) {
      parts.push(`Stok paling sedikit: ${listTop(stock.bottomStock, 5)}`);
    }
  }
  const needs = sheet.needsAnalysis;
  if (needs) {
    parts.push(`Kebutuhan pengadaan: anggaran ${nf(needs.totalProcurementBudget)}; ${nf(needs.urgentItemCount, 0)} item mendesak, ${nf(needs.highPriorityCount, 0)} prioritas tinggi.`);
    if (needs.procurementItems?.length) {
      parts.push(`Rincian pengadaan: ${needs.procurementItems.slice(0, 6).map((i) => `${i.name} qty ${nf(i.recommendedQty)} (${i.priority}, ${nf(i.estimatedCost)})`).join("; ")}`);
    }
    if (needs.riskWarnings?.length) {
      parts.push(`Peringatan risiko: ${needs.riskWarnings.slice(0, 4).join(" / ")}`);
    }
  }
  const dt = sheet.decisionTreeAnalysis;
  if (dt) {
    const perf = dt.performanceMetrics;
    parts.push(`Decision Tree C4.5: target "${dt.targetAttribute}"; akurasi ${pct(dt.accuracy * 100)}; precision ${pct((perf?.precision ?? 0) * 100)}, recall ${pct((perf?.recall ?? 0) * 100)}, F1 ${pct((perf?.f1Score ?? 0) * 100)}; latih/uji ${nf(dt.trainingSize, 0)}/${nf(dt.testSize, 0)}.`);
    if (dt.featureImportance?.length) {
      parts.push(`Atribut terpenting: ${dt.featureImportance.slice(0, 5).map((f) => `${f.feature} ${pct(f.importance * 100, 1)}`).join("; ")}`);
    }
    if (dt.classDistribution) {
      parts.push(`Distribusi kelas: ${Object.entries(dt.classDistribution).map(([k, v]) => `${k} ${nf(v, 0)}`).join("; ")}`);
    }
    if (dt.rules?.length) {
      parts.push("Aturan keputusan:");
      parts.push(...dt.rules.slice(0, 8).map((r) => `- ${r}`));
    }
  }
  if (sheet.insights?.length) {
    parts.push("Temuan otomatis:");
    parts.push(...sheet.insights.slice(0, 14).map((s) => `- ${s}`));
  }
  let text = parts.filter(Boolean).join("\n");
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars)}
\u2026 (konteks dipotong agar muat di jendela model)`;
  }
  return text;
}
function collectCorrelations(sheet) {
  const corr = sheet.corr;
  if (!corr || !corr.matrix?.length) {
    return [];
  }
  const out = [];
  for (let i = 0; i < corr.matrix.length; i++) {
    for (let j = i + 1; j < corr.matrix[i].length; j++) {
      const r = corr.matrix[i][j];
      if (typeof r === "number" && isFinite(r) && Math.abs(r) >= 0.7) {
        out.push({ a: corr.cols[i], b: corr.cols[j], r });
      }
    }
  }
  return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
}
function buildSystemPrompt(context, extra) {
  return [
    'Kamu adalah asisten analis data di dalam ekstensi VS Code "Date Skunder".',
    "Jawab dalam Bahasa Indonesia yang ringkas, rapi, dan langsung ke inti.",
    "Gunakan HANYA angka dan fakta pada KONTEKS DATA di bawah. Jika sebuah angka tidak ada di konteks, katakan bahwa datanya tidak tersedia \u2014 jangan mengarang.",
    "Saat menyebut angka, tulis apa adanya dari konteks (contoh: pendapatan 322.966,75).",
    "Jika membantu, sajikan ringkasan poin-poin pendek atau tabel kecil.",
    extra && extra.trim() ? `Preferensi pengguna: ${extra.trim()}` : "",
    "",
    context
  ].filter((l) => l !== "").join("\n");
}

// src/aiViews.ts
var CHAT_VIEW = "dateSkunder.chatView";
var LLAMA_VIEW = "dateSkunder.llamaView";
var SELECTED_MODEL_KEY = "dateSkunder.selectedModel";
var MODELS_CACHE_KEY = "dateSkunder.ggufCache";
var DEEP_SCAN_REUSE_MS = 5 * 60 * 1e3;
var QUICK_SCAN_MS = 4e3;
var WATCH_INTERVAL_MS = 9e4;
function readConfig() {
  const c = vscode.workspace.getConfiguration("dateSkunder");
  const extra = (c.get("llama.extraArgs") ?? "").trim();
  return {
    port: c.get("llama.port") ?? 8081,
    contextSize: c.get("llama.contextSize") ?? 4096,
    gpuLayers: c.get("llama.gpuLayers") ?? 0,
    threads: c.get("llama.threads") ?? 0,
    extraArgs: extra ? extra.split(/\s+/).filter(Boolean) : [],
    modelPaths: c.get("llama.modelPaths") ?? [],
    scanDepth: c.get("llama.scanDepth") ?? 4,
    scanTimeoutSeconds: c.get("llama.scanTimeoutSeconds") ?? 90,
    autoScan: c.get("llama.autoScan") ?? true,
    temperature: c.get("ai.temperature") ?? 0.2,
    maxTokens: c.get("ai.maxTokens") ?? 0,
    autoStart: c.get("ai.autoStartServer") ?? true,
    includeStats: c.get("ai.includeStats") ?? true,
    systemExtra: c.get("ai.systemExtra") ?? ""
  };
}
function nonce() {
  return Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join("");
}
function shortenPath(p, max = 52) {
  return p.length > max ? `\u2026${p.slice(-max)}` : p;
}
var AiHub = class {
  constructor(ctx) {
    this.ctx = ctx;
    this.server = new LlamaServer({
      extensionPath: ctx.extensionUri.fsPath,
      onLog: (line) => this.llama?.appendLog(line),
      onStatus: () => {
        this.llama?.refresh();
        this.chat?.postServerStatus();
      }
    });
    const cached = ctx.globalState.get(MODELS_CACHE_KEY);
    if (cached?.list?.length) {
      this.models = sortModels(cached.list.filter((m) => !!m?.path));
      this.modelsScannedAt = cached.at ?? 0;
      this.lastDeepScanAt = cached.at ?? 0;
    }
  }
  store = globalAnalysisStore;
  server;
  chat;
  llama;
  models = [];
  modelsScannedAt = 0;
  lastDeepScanAt = 0;
  scanning = false;
  scanAbort;
  progress;
  reportedFound = 0;
  attach(chat, llama) {
    this.chat = chat;
    this.llama = llama;
  }
  config() {
    return readConfig();
  }
  get extensionUri() {
    return this.ctx.extensionUri;
  }
  osInfo() {
    const info = resolveServerBinary(this.ctx.extensionUri.fsPath);
    return { platform: process.platform, folder: osFolder(process.platform), label: osLabel(process.platform), binary: info.chosen, candidates: info.candidates };
  }
  /** Daftar model yang sudah diketahui (cache/pemindaian terakhir) — tanpa menyentuh disk. */
  scanModels() {
    return this.models;
  }
  get scanningNow() {
    return this.scanning;
  }
  /** Kemajuan pemindaian terakhir (dipakai view Chat dan notifikasi progres). */
  get scanProgress() {
    return this.progress;
  }
  modelsPayload() {
    return {
      list: this.models.map((m) => ({ path: m.path, name: m.name, size: formatBytes(m.sizeBytes), multipart: m.multipart })),
      scannedAt: this.modelsScannedAt,
      scanning: this.scanning
    };
  }
  /**
   * Cari berkas .gguf di penyimpanan pengguna, dua tahap:
   * 1. "ringkas"  → folder umum (Downloads/Documents/Desktop/folder app model) agar hasil cepat tampil;
   * 2. "penuh"    → seluruh drive/volume yang terpasang (D:, E:, flashdisk, dsb.) berjalan di latar belakang.
   * Hasil dilaporkan bertahap lalu disimpan, jadi sesi berikutnya tidak menunggu pemindaian lagi.
   */
  async refreshModels(opts = {}) {
    if (this.scanning) {
      return this.models;
    }
    const cfg = this.config();
    const wantDeep = (opts.deep ?? true) && (opts.manual || cfg.autoScan);
    const deep = wantDeep && (opts.manual || this.models.length === 0 || Date.now() - this.lastDeepScanAt > DEEP_SCAN_REUSE_MS);
    const before = this.pathKey();
    this.scanning = true;
    this.reportedFound = 0;
    const abortFlag = { cancelled: false };
    this.scanAbort = abortFlag;
    try {
      if (!opts.quiet) {
        this.chat?.postScanStart("ringkas");
      }
      const quick = await scanGgufModels(await this.searchRoots(false), {
        maxDepth: Math.min(3, Math.max(1, cfg.scanDepth)),
        timeoutMs: QUICK_SCAN_MS,
        concurrency: 4,
        isCancelled: () => abortFlag.cancelled,
        onProgress: (p) => this.reportProgress(p, "ringkas", opts.quiet)
      });
      this.setModels(this.mergeModels(quick));
      if (!opts.quiet && !deep) {
        this.postModels("ringkas", true);
      }
      if (deep && !abortFlag.cancelled) {
        if (!opts.quiet) {
          this.chat?.postScanStart("penuh");
        }
        const full = await scanGgufModels(await this.searchRoots(true), {
          maxDepth: Math.max(2, cfg.scanDepth),
          timeoutMs: Math.max(10, cfg.scanTimeoutSeconds) * 1e3,
          concurrency: 8,
          isCancelled: () => abortFlag.cancelled,
          onProgress: (p) => this.reportProgress(p, "penuh", opts.quiet)
        });
        this.setModels(this.mergeModels(full));
        if (!abortFlag.cancelled) {
          this.lastDeepScanAt = Date.now();
        }
      }
    } finally {
      this.scanning = false;
      this.scanAbort = void 0;
    }
    if (opts.quiet) {
      if (this.pathKey() !== before) {
        this.postModels("ringkas", true, true);
      }
    } else {
      this.postModels(deep ? "penuh" : "ringkas", true);
    }
    return this.models;
  }
  /** Batalkan pemindaian yang berjalan; berkas yang sudah ditemukan tetap dipakai. */
  cancelScan() {
    if (this.scanAbort) {
      this.scanAbort.cancelled = true;
    }
  }
  /** Pencarian otomatis saat ekstensi aktif (latar belakang, tidak memblokir UI). */
  autoScan() {
    void this.refreshModels().catch(() => {
    });
  }
  /** Pemindaian manual dengan notifikasi progres dan tombol batal. */
  async scanWithProgress(title = "Mencari berkas .gguf di penyimpanan laptop ini\u2026") {
    return vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title, cancellable: true },
      async (progress, cancellation) => {
        cancellation.onCancellationRequested(() => this.cancelScan());
        const timer = setInterval(() => {
          const p = this.progress;
          if (!p) {
            return;
          }
          progress.report({ message: `${p.phase === "penuh" ? "seluruh drive" : "folder umum"} \xB7 ${p.dirs.toLocaleString("id-ID")} folder \xB7 ${p.found} model${p.root ? ` \xB7 ${shortenPath(p.root)}` : ""}` });
        }, 400);
        try {
          return await this.refreshModels({ deep: true, manual: true });
        } finally {
          clearInterval(timer);
        }
      }
    );
  }
  /** Akar pencarian: pengaturan pengguna + workspace + folder umum model + (tahap penuh) semua drive. */
  async searchRoots(deep) {
    const cfg = this.config();
    const roots = [
      ...cfg.modelPaths.map((p) => p.replace(/^~(?=$|[\\/])/, os2.homedir())),
      ...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath),
      this.ctx.extensionUri.fsPath,
      ...defaultModelRoots()
    ];
    const selected = this.selectedModel;
    if (selected) {
      roots.push(path2.dirname(selected));
    }
    if (deep) {
      roots.push(...await listStorageRoots());
    }
    return [...new Set(roots.filter(Boolean))];
  }
  /** Gabungkan hasil baru dengan daftar lama (entri lama hanya dipertahankan bila berkasnya masih ada). */
  mergeModels(fresh) {
    const byKey = /* @__PURE__ */ new Map();
    for (const m of fresh) {
      byKey.set(m.path.toLowerCase(), m);
    }
    for (const old of this.models) {
      const key = old.path.toLowerCase();
      if (byKey.has(key)) {
        continue;
      }
      if (fs2.existsSync(old.path)) {
        byKey.set(key, old);
      }
    }
    return sortModels([...byKey.values()]);
  }
  setModels(list) {
    this.models = list;
    this.modelsScannedAt = Date.now();
    void this.ctx.globalState.update(MODELS_CACHE_KEY, { at: this.modelsScannedAt, list: this.models });
  }
  pathKey() {
    return this.models.map((m) => m.path.toLowerCase()).join("|");
  }
  /** Laporan kemajuan: daftar ikut diperbarui begitu ada temuan baru pada tahap penuh. */
  reportProgress(p, phase, quiet) {
    this.progress = { ...p, phase };
    if (quiet) {
      return;
    }
    this.chat?.postScanProgress(this.progress);
    if (phase === "penuh" && p.found > this.reportedFound) {
      this.reportedFound = p.found;
      this.postModels("penuh", false);
    }
  }
  postModels(phase, done, quiet = false) {
    this.chat?.postModels({ ...this.modelsPayload(), phase, done, quiet, progress: this.progress });
  }
  get selectedModel() {
    const saved = this.ctx.workspaceState.get(SELECTED_MODEL_KEY);
    if (saved && fs2.existsSync(saved)) {
      return saved;
    }
    const list = this.models;
    return list.length ? list[0].path : void 0;
  }
  async setSelectedModel(modelPath) {
    await this.ctx.workspaceState.update(SELECTED_MODEL_KEY, modelPath);
  }
  async startServer(modelPath) {
    const cfg = this.config();
    const model = modelPath ?? this.selectedModel;
    if (!model) {
      throw new Error("Belum ada berkas .gguf yang terdeteksi. Pencarian otomatis masih berjalan \u2014 tunggu sebentar, tekan \u27F3 untuk memindai ulang, atau tambahkan folder model pada pengaturan dateSkunder.llama.modelPaths.");
    }
    const status = await this.server.start({
      modelPath: model,
      port: cfg.port,
      contextSize: cfg.contextSize,
      gpuLayers: cfg.gpuLayers,
      threads: cfg.threads,
      extraArgs: cfg.extraArgs,
      startupTimeoutMs: 24e4
    });
    await this.setSelectedModel(model);
    return status;
  }
  async stopServer() {
    return this.server.stop();
  }
  /** Dipanggil setelah analisis selesai agar Chat AI selalu memakai statistik terbaru. */
  recordAnalysis(uri, label, result) {
    globalAnalysisStore.set(uri.toString(), result, label);
    this.chat?.postContextList(uri.toString());
  }
};
var ChatViewProvider = class {
  constructor(hub) {
    this.hub = hub;
  }
  view;
  history = [];
  stream;
  contextId;
  statsEnabled = true;
  watchTimer;
  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.hub.extensionUri, "media")] };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((m) => void this.onMessage(m));
    view.onDidChangeVisibility(() => {
      if (view.visible) {
        this.startWatch();
      } else {
        this.stopWatch();
      }
    });
    view.onDidDispose(() => {
      this.stopWatch();
      this.view = void 0;
    });
    if (view.visible) {
      this.startWatch();
    }
  }
  /** Intip folder umum secara berkala selama view terbuka → model yang baru diunduh ikut terdeteksi sendiri. */
  startWatch() {
    if (this.watchTimer) {
      return;
    }
    this.watchTimer = setInterval(() => {
      void this.hub.refreshModels({ deep: false, quiet: true }).catch(() => {
      });
    }, WATCH_INTERVAL_MS);
    if (typeof this.watchTimer.unref === "function") {
      this.watchTimer.unref();
    }
  }
  stopWatch() {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = void 0;
    }
  }
  html(webview) {
    const media = vscode.Uri.joinPath(this.hub.extensionUri, "media");
    const css = webview.asWebviewUri(vscode.Uri.joinPath(media, "ai.css"));
    const js = webview.asWebviewUri(vscode.Uri.joinPath(media, "chat.js"));
    const n = nonce();
    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${n}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
<link href="${css}" rel="stylesheet">
<title>Chat AI</title>
</head>
<body class="ai-body">
<div class="ai-root">
    <div class="ai-head">
        <div class="ai-head-row">
            <strong id="title">\u{1F999} Chat AI</strong>
            <span id="dot" class="ai-dot off" title="status server"></span>
        </div>
        <div id="status" class="ai-status">menyiapkan\u2026</div>
    </div>

    <div class="ai-plain">
        <select id="model" title="Model .gguf terdeteksi (pencarian otomatis di seluruh penyimpanan)"></select>
        <div class="ai-mini">
            <button id="scan" class="ai-btn ghost" title="Pindai ulang berkas .gguf (semua drive)">\u27F3</button>
            <button id="start" class="ai-btn ghost" title="Jalankan llama-server">\u25B6</button>
            <button id="stop" class="ai-btn ghost" title="Hentikan llama-server">\u23F9</button>
            <button id="clear" class="ai-btn ghost" title="Hapus percakapan">\u{1F9F9}</button>
        </div>
    </div>

    <div id="scaninfo" class="ai-scaninfo" hidden></div>

    <div class="ai-plain">
        <select id="ctx" title="Sumber statistik yang dipakai"></select>
        <label class="ai-chk" title="Sertakan statistik berkas sebagai konteks jawaban">
            <input type="checkbox" id="stats" checked> statistik
        </label>
    </div>

    <div id="msgs" class="ai-msgs"></div>

    <div class="ai-input">
        <textarea id="ta" rows="1" placeholder="Tanya soal data ini\u2026 (Enter kirim \xB7 Shift+Enter baris baru)"></textarea>
        <div class="ai-input-actions">
            <button id="send" class="ai-btn primary">Kirim</button>
            <button id="abort" class="ai-btn" hidden>\u23F9 Stop</button>
        </div>
    </div>
</div>
<script nonce="${n}" src="${js}"></script>
</body>
</html>`;
  }
  post(message) {
    void this.view?.webview.postMessage(message);
  }
  /** Daftar model terbaru. quiet=true → view hanya memperbarui daftar pilihan tanpa menulis pesan. */
  postModels(payload) {
    this.post({ type: "models", ...payload });
  }
  postScanStart(phase) {
    this.post({ type: "scanStart", phase });
  }
  postScanProgress(p) {
    this.post({ type: "scanProgress", ...p });
  }
  postServerStatus() {
    const cfg = this.hub.config();
    const info = this.hub.osInfo();
    this.post({ type: "server", status: this.hub.server.status, os: info, binary: info.binary, port: cfg.port, model: this.hub.selectedModel });
  }
  postContextList(preferredId) {
    const list = this.hub.store.list();
    const active = preferredId ?? this.contextId ?? list[0]?.id;
    this.contextId = active;
    this.post({ type: "contextList", items: list, active });
  }
  async onMessage(msg) {
    switch (msg?.type) {
      case "ready":
        this.statsEnabled = this.hub.config().includeStats;
        this.post({
          type: "init",
          models: { ...this.hub.modelsPayload(), selected: this.hub.selectedModel },
          statsEnabled: this.statsEnabled,
          tooltip: this.hub.osInfo().label,
          binary: this.hub.osInfo().binary,
          osFolder: this.hub.osInfo().folder,
          platform: process.platform
        });
        this.postContextList();
        this.postServerStatus();
        this.hub.autoScan();
        break;
      case "scan":
        await this.hub.refreshModels({ deep: true, manual: true });
        break;
      case "selectModel":
        await this.hub.setSelectedModel(String(msg.path));
        this.postServerStatus();
        break;
      case "start":
        await this.startServer(true);
        break;
      case "stop":
        await this.hub.stopServer();
        break;
      case "clear":
        this.history = [];
        this.post({ type: "cleared" });
        break;
      case "selectContext":
        this.contextId = String(msg.id);
        this.postContextList(this.contextId);
        break;
      case "stats":
        this.statsEnabled = !!msg.value;
        break;
      case "send":
        await this.send(String(msg.text ?? ""));
        break;
      case "abort":
        this.stream?.abort();
        this.stream = void 0;
        this.post({ type: "aborted" });
        break;
      case "openSettings":
        await vscode.commands.executeCommand("workbench.action.openSettings", "dateSkunder");
        break;
    }
  }
  async startServer(verbose = false) {
    try {
      if (verbose) {
        this.post({ type: "notice", level: "info", text: "Menjalankan llama-server\u2026" });
      }
      await this.hub.startServer();
    } catch (e) {
      this.post({ type: "error", text: e instanceof Error ? e.message : String(e) });
    }
  }
  async send(text) {
    const question = text.trim();
    if (!question) {
      return;
    }
    if (!this.hub.server.running) {
      const cfg2 = this.hub.config();
      if (!cfg2.autoStart) {
        this.post({ type: "error", text: 'llama-server belum berjalan. Tekan \u25B6 pada Chat AI atau nyalakan dari view "LLAMA Server".' });
        return;
      }
      await this.startServer();
      if (!this.hub.server.running) {
        return;
      }
    }
    const cfg = this.hub.config();
    const entry = this.hub.store.resolve(this.contextId);
    const context = entry && this.statsEnabled ? buildStatsContext(entry, void 0, 7e3) : "KONTEKS DATA tidak disertakan (pengguna mematikan opsi statistik). Jawab seperlunya dan ingatkan bahwa analisis berkas belum/tidak disertakan.";
    const system = { role: "system", content: buildSystemPrompt(context, cfg.systemExtra) };
    this.history.push({ role: "user", content: question });
    const recent = this.history.slice(-12);
    this.post({ type: "assistantStart" });
    let handle;
    try {
      handle = chatStream({
        port: cfg.port,
        messages: [system, ...recent],
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        onDelta: (delta) => this.post({ type: "delta", text: delta })
      });
    } catch (e) {
      this.post({ type: "error", text: e instanceof Error ? e.message : String(e) });
      return;
    }
    this.stream = handle;
    try {
      const full = await handle.done;
      this.history.push({ role: "assistant", content: full });
      this.post({ type: "assistantEnd", text: full });
    } catch (e) {
      this.post({ type: "error", text: `Gagal menghubungi llama-server: ${e instanceof Error ? e.message : String(e)}` });
      this.post({ type: "assistantEnd", text: "" });
    } finally {
      if (this.stream === handle) {
        this.stream = void 0;
      }
    }
  }
};
var LlamaViewProvider = class {
  constructor(hub) {
    this.hub = hub;
  }
  view;
  pending = [];
  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.hub.extensionUri, "media")] };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((m) => void this.onMessage(m));
    view.onDidDispose(() => {
      this.view = void 0;
    });
  }
  html(webview) {
    const media = vscode.Uri.joinPath(this.hub.extensionUri, "media");
    const css = webview.asWebviewUri(vscode.Uri.joinPath(media, "ai.css"));
    const js = webview.asWebviewUri(vscode.Uri.joinPath(media, "llama.js"));
    const n = nonce();
    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${n}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
<link href="${css}" rel="stylesheet">
<title>LLAMA Server</title>
</head>
<body class="ai-body">
<div class="ai-root">
    <div class="ai-head">
        <div class="ai-head-row">
            <strong>\u{1F999} LLAMA Server</strong>
            <span id="dot" class="ai-dot off"></span>
        </div>
        <div id="status" class="ai-status">memeriksa\u2026</div>
    </div>

    <div class="ai-plain">
        <div class="ai-mini">
            <button id="start" class="ai-btn ghost" title="Jalankan llama-server">\u25B6 Start</button>
            <button id="stop" class="ai-btn ghost" title="Hentikan llama-server">\u23F9 Stop</button>
            <button id="settings" class="ai-btn ghost" title="Buka pengaturan Date Skunder">\u2699</button>
            <button id="clear" class="ai-btn ghost" title="Bersihkan log">\u{1F9F9}</button>
        </div>
    </div>

    <div id="meta" class="ai-meta"></div>
    <label class="ai-chk wide"><input type="checkbox" id="follow" checked> ikuti log terbaru</label>
    <pre id="log" class="ai-log"></pre>
</div>
<script nonce="${n}" src="${js}"></script>
</body>
</html>`;
  }
  post(message) {
    void this.view?.webview.postMessage(message);
  }
  /** Baris log baru dari proses llama-server (streaming, bukan tunggu proses selesai). */
  appendLog(line) {
    if (!this.view) {
      this.pending.push(line);
      return;
    }
    this.post({ type: "log", line });
  }
  refresh() {
    const info = this.hub.osInfo();
    const cfg = this.hub.config();
    const model = this.hub.selectedModel;
    this.post({
      type: "status",
      status: this.hub.server.status,
      os: info,
      binary: info.binary,
      port: cfg.port,
      contextSize: cfg.contextSize,
      gpuLayers: cfg.gpuLayers,
      model,
      modelLabel: model ? path2.basename(model) : void 0,
      modelExists: model ? fs2.existsSync(model) : false,
      logs: this.hub.server.logs.slice(-500)
    });
  }
  async onMessage(msg) {
    switch (msg?.type) {
      case "ready":
        if (this.pending.length) {
          for (const line of this.pending) {
            this.post({ type: "log", line });
          }
          this.pending = [];
        }
        this.refresh();
        break;
      case "start":
        try {
          this.post({ type: "notice", text: "Menjalankan llama-server\u2026" });
          await this.hub.startServer();
        } catch (e) {
          this.post({ type: "notice", text: e instanceof Error ? e.message : String(e), level: "error" });
        }
        this.refresh();
        break;
      case "stop":
        await this.hub.stopServer();
        this.refresh();
        break;
      case "clear":
        this.hub.server.clearLogs();
        this.post({ type: "clear" });
        break;
      case "settings":
        await vscode.commands.executeCommand("workbench.action.openSettings", "dateSkunder");
        break;
    }
  }
};
function registerAiViews(context) {
  const hub = new AiHub(context);
  const chat = new ChatViewProvider(hub);
  const llama = new LlamaViewProvider(hub);
  hub.attach(chat, llama);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CHAT_VIEW, chat, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.window.registerWebviewViewProvider(LLAMA_VIEW, llama, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand("date-skunder.ai.openChat", async () => {
      await vscode.commands.executeCommand("dateSkunder.chatView.focus");
      if (!hub.selectedModel) {
        const choice = await vscode.window.showWarningMessage("Belum ada berkas .gguf yang terdeteksi. Pencarian otomatis di seluruh penyimpanan sedang berjalan; bila model ada di folder khusus, tambahkan pada Date Skunder \u2192 LLAMA \u2192 Model Paths.", "Buka Pengaturan");
        if (choice === "Buka Pengaturan") {
          await vscode.commands.executeCommand("workbench.action.openSettings", "dateSkunder.llama.modelPaths");
        }
      }
    }),
    vscode.commands.registerCommand("date-skunder.llama.start", () => hub.startServer()),
    vscode.commands.registerCommand("date-skunder.llama.stop", () => hub.stopServer()),
    vscode.commands.registerCommand("date-skunder.llama.scanModels", async () => {
      const models = await hub.scanWithProgress("Memindai ulang berkas .gguf di seluruh penyimpanan\u2026");
      const p = hub.scanProgress;
      const detail = p ? ` (${p.dirs.toLocaleString("id-ID")} folder diperiksa${p.timedOut ? ", batas waktu tercapai" : ""}${p.cancelled ? ", dibatalkan" : ""})` : "";
      if (models.length) {
        await vscode.window.showInformationMessage(`Date Skunder AI: ${models.length} berkas .gguf terdeteksi${detail}.`);
        return;
      }
      const choice = await vscode.window.showWarningMessage(`Belum ada berkas .gguf yang terdeteksi${detail}. Letakkan model di folder Downloads/Documents, atau tambahkan foldernya pada pengaturan dateSkunder.llama.modelPaths.`, "Buka Pengaturan");
      if (choice === "Buka Pengaturan") {
        await vscode.commands.executeCommand("workbench.action.openSettings", "dateSkunder.llama.modelPaths");
      }
    }),
    vscode.commands.registerCommand("date-skunder.llama.pickModel", async () => {
      let models = hub.scanModels();
      if (!models.length) {
        models = await hub.scanWithProgress();
      }
      if (!models.length) {
        const choice = await vscode.window.showWarningMessage("Tidak ada berkas .gguf yang ditemukan setelah mencari di seluruh penyimpanan. Tambahkan folder pencarian pada pengaturan dateSkunder.llama.modelPaths.", "Buka Pengaturan");
        if (choice === "Buka Pengaturan") {
          await vscode.commands.executeCommand("workbench.action.openSettings", "dateSkunder.llama.modelPaths");
        }
        return;
      }
      const pick = await vscode.window.showQuickPick(
        models.map((m) => ({ label: m.name, description: formatBytes(m.sizeBytes), detail: m.path, path: m.path })),
        { title: "Pilih model .gguf untuk llama-server", matchOnDetail: true }
      );
      if (pick) {
        await hub.setSelectedModel(pick.path);
      }
    })
  );
  hub.autoScan();
  return hub;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AiHub,
  ChatViewProvider,
  LlamaViewProvider,
  registerAiViews
});
