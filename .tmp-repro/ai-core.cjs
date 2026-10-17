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
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
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
  osFolder: () => osFolder,
  osLabel: () => osLabel,
  resolveServerBinary: () => resolveServerBinary,
  scanGgufModels: () => scanGgufModels
});
module.exports = __toCommonJS(llamaCore_exports);
var fs = __toESM(require("fs"));
var os = __toESM(require("os"));
var path = __toESM(require("path"));
var http = __toESM(require("http"));
var import_child_process = require("child_process");
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
  "$recycle.bin",
  "system volume information",
  "windows",
  "winsxs",
  "program files",
  "program files (x86)",
  "programdata",
  "temp",
  "tmp",
  "obj",
  "dist",
  "build"
]);
function scanGgufModels(roots, opts = {}) {
  const maxDepth = opts.maxDepth ?? 4;
  const maxEntries = opts.maxEntries ?? 6e4;
  const timeoutMs = opts.timeoutMs ?? 4e3;
  const startedAt = Date.now();
  const found = [];
  let visited = 0;
  const walk = (dir, depth) => {
    if (depth > maxDepth || visited > maxEntries || Date.now() - startedAt > timeoutMs) {
      return;
    }
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      visited++;
      if (visited > maxEntries || Date.now() - startedAt > timeoutMs) {
        return;
      }
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name.toLowerCase())) {
          continue;
        }
        walk(full, depth + 1);
      } else if (e.isFile() && e.name.toLowerCase().endsWith(".gguf")) {
        let size = 0;
        try {
          size = fs.statSync(full).size;
        } catch {
        }
        const m = /(\d{4,5})-of-(\d{4,5})/i.exec(e.name);
        found.push({ path: full, name: e.name, sizeBytes: size, multipart: !!m, part: m ? m[0] : void 0 });
      }
    }
  };
  for (const root of roots) {
    if (root && fs.existsSync(root)) {
      walk(root, 0);
    }
  }
  const uniq = /* @__PURE__ */ new Map();
  for (const f of found) {
    const key = f.path.toLowerCase();
    if (!uniq.has(key)) {
      uniq.set(key, f);
    }
  }
  return [...uniq.values()].sort((a, b) => {
    const aTail = a.part ? !/00001-of-/i.test(a.name) : false;
    const bTail = b.part ? !/00001-of-/i.test(b.name) : false;
    if (aTail !== bTail) {
      return aTail ? 1 : -1;
    }
    return b.sizeBytes - a.sizeBytes;
  });
}
function defaultModelRoots(homeDir = os.homedir()) {
  return [
    path.join(homeDir, "Downloads"),
    path.join(homeDir, "Documents"),
    path.join(homeDir, "Desktop"),
    path.join(homeDir, "Models"),
    path.join(homeDir, "models"),
    path.join(homeDir, ".cache", "llama.cpp"),
    path.join(homeDir, ".cache", "lm-studio", "models"),
    path.join(homeDir, ".ollama", "models"),
    path.join(homeDir, "AppData", "Local", "LM-Studio", "models"),
    path.join(homeDir, ".local", "share", "nomic.ai"),
    "/usr/share/llama.cpp",
    "/opt/models"
  ];
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
  return new Promise((resolve, reject) => {
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
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
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
        await new Promise((resolve) => {
          killer.on("exit", () => resolve());
          killer.on("error", () => resolve());
          setTimeout(resolve, 4e3);
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
  osFolder,
  osLabel,
  resolveServerBinary,
  scanGgufModels
});
