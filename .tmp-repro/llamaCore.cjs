"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/llamaCore.ts
var llamaCore_exports = {};
__export(llamaCore_exports, {
  LlamaServer: () => LlamaServer,
  binaryCandidates: () => binaryCandidates,
  chatStream: () => chatStream,
  defaultModelRoots: () => defaultModelRoots,
  formatBytes: () => formatBytes,
  httpRequest: () => httpRequest,
  isDir: () => isDir,
  listStorageRoots: () => listStorageRoots,
  osFolder: () => osFolder,
  osLabel: () => osLabel,
  resolveServerBinary: () => resolveServerBinary,
  scanGgufModels: () => scanGgufModels,
  sortModels: () => sortModels
});
module.exports = __toCommonJS(llamaCore_exports);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LlamaServer,
  binaryCandidates,
  chatStream,
  defaultModelRoots,
  formatBytes,
  httpRequest,
  isDir,
  listStorageRoots,
  osFolder,
  osLabel,
  resolveServerBinary,
  scanGgufModels,
  sortModels
});
