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

// src/petSkins.ts
var petSkins_exports = {};
__export(petSkins_exports, {
  DEFAULT_PET_SKIN_ID: () => DEFAULT_PET_SKIN_ID,
  PET_SKINS: () => PET_SKINS,
  activePetSkin: () => activePetSkin,
  buildSpiderWebConfig: () => buildSpiderWebConfig,
  petSkinById: () => petSkinById,
  petSkinPayload: () => petSkinPayload,
  petSkinSharePayload: () => petSkinSharePayload,
  skinAvailable: () => skinAvailable
});
module.exports = __toCommonJS(petSkins_exports);
var vscode = __toESM(require("vscode"));

// src/petMissions.ts
var PET_MISSIONS = [
  { id: "first-export", name: "Eksportir Pertama", detail: "Klik satu tombol export di halaman (mis. minta \u201Cexport excel\u201D).", target: 1, rewardSkin: "samurai" },
  { id: "first-jurnal", name: "Penulis Jurnal", detail: "Jalankan export jurnal (DOCX atau PDF) sekali.", target: 1, rewardSkin: "merah" },
  { id: "first-workflow", name: "Pembuat Alur", detail: "Jalankan export flow (gambar workflow) sekali.", target: 1, rewardSkin: "zamrud" },
  { id: "navigator", name: "Penjelajah Tab", detail: "Pindahkan tab/filter stok 3 kali lewat pet.", target: 3, rewardSkin: "senja" },
  { id: "typist", name: "Juru Ketik", detail: "Suruh pet mengetik/mengisi kolom 5 kali (mis. \u201Ccari indomie\u201D).", target: 5, rewardSkin: "ungu" },
  { id: "first-json", name: "Penjaga Data", detail: "Jalankan export JSON sekali.", target: 1, rewardSkin: "es" },
  { id: "first-pptx", name: "Presenter", detail: "Jalankan export PPT sekali.", target: 1, rewardSkin: "emas" },
  { id: "export-all", name: "Sekali Klik Semua", detail: "Minta \u201Cexport semua sekaligus\u201D sampai 3 tombol export berhasil diklik dalam satu perintah.", target: 3, rewardSkin: "lava" },
  { id: "tour-master", name: "Penjelajah Halaman", detail: "Jalankan \u201C\u25B6 Jalankan semua fitur\u201D sampai selesai.", target: 1, rewardSkin: "robot" },
  { id: "checker", name: "Tukang Cek", detail: "Jalankan \u201C\u2713 Cek semua kontrol\u201D satu kali.", target: 1, rewardSkin: "peri" },
  { id: "nonstop-runner", name: "Pekerja Nonstop", detail: "Selesaikan 5 putaran kerja nonstop.", target: 5, rewardSkin: "hantu" },
  { id: "marathon", name: "Maraton Halaman", detail: "Selesaikan total 25 aksi berhasil di halaman (akumulatif).", target: 25, rewardSkin: "ninja" }
];
var KEY = "dateSkunder.petMissions";
function read(ctx) {
  return ctx.globalState.get(KEY) ?? {};
}
function missionStates(ctx) {
  const p = read(ctx);
  return PET_MISSIONS.map((m) => {
    const value = Math.min(m.target, Math.max(0, Math.floor(p[m.id] ?? 0)));
    return { ...m, value, done: value >= m.target };
  });
}
function missionRewards(ctx) {
  return new Set(missionStates(ctx).filter((m) => m.done).map((m) => m.rewardSkin));
}

// src/petSkins.ts
var ACCESSORY_SVG = {
  none: "",
  crown: '<path class="sp-acc" d="M51.4 31 L51.4 20.6 L56 25.6 L60 18.8 L64 25.6 L68.6 20.6 L68.6 31 Z" />',
  hat: '<g class="sp-acc"><path d="M52.6 31 L52.6 19 Q60 15.4 67.4 19 L67.4 31 Z" /><ellipse cx="60" cy="31" rx="13.4" ry="3.1" /><rect class="sp-acc-band" x="52.6" y="26.4" width="14.8" height="3.4" /></g>',
  bow: '<g class="sp-acc"><path d="M53 56.5 L45.6 52.2 L45.6 60.8 Z" /><path d="M67 56.5 L74.4 52.2 L74.4 60.8 Z" /><circle cx="60" cy="56.5" r="2.3" /></g>',
  glasses: '<g class="sp-acc ring"><circle cx="55.4" cy="39" r="5.1" /><circle cx="64.6" cy="39" r="5.1" /><path d="M60.5 39 L59.5 39" /><path d="M50.3 37.6 L47 35.6" /><path d="M69.7 37.6 L73 35.6" /></g>',
  scarf: '<g class="sp-acc"><path d="M47.2 54.6 Q60 61.8 72.8 54.6 L72.8 59.6 Q60 66.8 47.2 59.6 Z" /><path d="M53.4 62.5 L49.4 73.4 L55.2 73.4 L56.8 63.6 Z" /></g>',
  halo: '<ellipse class="sp-acc ring" cx="60" cy="17.6" rx="10.2" ry="3.4" />',
  headband: '<g class="sp-acc"><path d="M48.4 34.6 Q60 30.4 71.6 34.6 L71 38.4 Q60 34.4 49 38.4 Z" /><path d="M49.6 36.4 L39.6 30.4 L41.4 37.6 Z" /></g>',
  antenna: '<g class="sp-acc"><path d="M55.4 32.5 L52.2 20.8 L54.6 20 L57.6 31.4 Z" /><circle cx="53.4" cy="18.8" r="3.1" /><path d="M64.6 32.5 L67.8 20.8 L65.4 20 L62.4 31.4 Z" /><circle cx="66.6" cy="18.8" r="3.1" /></g>',
  wings: '<g class="sp-acc"><path d="M47 54 Q30 41 26.5 58 Q37 63 47 61 Z" /><path d="M73 54 Q90 41 93.5 58 Q83 63 73 61 Z" /></g>'
};
var PET_SKINS = [
  {
    id: "baja",
    name: "Baja Klasik",
    tagline: "Tampilan bawaan: abu baja dengan mata biru dingin.",
    colors: { leg: "#22262c", body: "#2b3038", back: "#3a4149", head: "#343a42", outline: "#4b5563", eye: "#e8f6ff", pupil: "#17324a", accent: "#8fa3b8" },
    accessory: "none"
  },
  {
    id: "merah",
    name: "Merah Menyala",
    tagline: "Badan merah berani, leher dibalut syal.",
    colors: { leg: "#5a1f22", body: "#a8323a", back: "#c0454d", head: "#932b33", outline: "#e2707a", eye: "#fff2f2", pupil: "#4a0f12", accent: "#ffb3b3" },
    accessory: "scarf",
    mission: "first-jurnal"
  },
  {
    id: "zamrud",
    name: "Zamrud Rimba",
    tagline: "Hijau zamrud segar dengan topi petualang.",
    colors: { leg: "#14402c", body: "#1f7a4d", back: "#2b9962", head: "#1c6b44", outline: "#5fd39a", eye: "#eafff5", pupil: "#0b3a26", accent: "#9ff2c8" },
    accessory: "hat",
    mission: "first-workflow"
  },
  {
    id: "senja",
    name: "Senja Jingga",
    tagline: "Oranye senja hangat berkacamata bundar.",
    colors: { leg: "#5a3418", body: "#d2691e", back: "#e8833a", head: "#b85c17", outline: "#ffc38a", eye: "#fff6ea", pupil: "#542609", accent: "#ffd9a8" },
    accessory: "glasses",
    mission: "navigator"
  },
  {
    id: "ungu",
    name: "Ungu Neon",
    tagline: "Ungu terang berpendar dengan dasi kupu-kupu.",
    colors: { leg: "#2e1b4d", body: "#6d28d9", back: "#8b5cf6", head: "#5b21b6", outline: "#c4b5fd", eye: "#f5f3ff", pupil: "#2e1065", accent: "#d8b4fe" },
    accessory: "bow",
    mission: "typist"
  },
  {
    id: "es",
    name: "Es Kristal",
    tagline: "Biru muda sebening es dengan halo melayang.",
    colors: { leg: "#7fa3bd", body: "#d8ecfa", back: "#eef7ff", head: "#c6dff1", outline: "#ffffff", eye: "#ffffff", pupil: "#123a55", accent: "#8fd3ff" },
    accessory: "halo",
    mission: "first-json"
  },
  {
    id: "emas",
    name: "Emas Royal",
    tagline: "Emas berkilau bermahkota untuk tugas besar.",
    colors: { leg: "#4a3a08", body: "#d4af37", back: "#e9c95c", head: "#bb9427", outline: "#fff1b8", eye: "#fffbe8", pupil: "#4a3a06", accent: "#fff3c4" },
    accessory: "crown",
    mission: "first-pptx"
  },
  {
    id: "ninja",
    name: "Ninja Bayangan",
    tagline: "Hitam pekat, ikat kepala merah, mata menyala.",
    colors: { leg: "#0c0e12", body: "#16181d", back: "#21252d", head: "#14171c", outline: "#3d4450", eye: "#ffe1e1", pupil: "#7f1d1d", accent: "#b91c1c" },
    accessory: "headband",
    mission: "marathon"
  },
  {
    id: "samurai",
    name: "Samurai Fajar",
    tagline: "Merah gelap berikat kepala \u2014 terkunci sampai misi \u201CEksportir Pertama\u201D selesai.",
    colors: { leg: "#2a1010", body: "#7f1d1d", back: "#a12b2b", head: "#641414", outline: "#d97373", eye: "#ffe9e9", pupil: "#3b0a0a", accent: "#dc2626" },
    accessory: "headband",
    mission: "first-export"
  },
  {
    id: "lava",
    name: "Lava Magma",
    tagline: "Bara oranye bersyal \u2014 terkunci sampai misi \u201CSekali Klik Semua\u201D selesai.",
    colors: { leg: "#2b1a0a", body: "#7c2d12", back: "#c2410c", head: "#9a3412", outline: "#fb923c", eye: "#fff1e6", pupil: "#542007", accent: "#f97316" },
    accessory: "scarf",
    mission: "export-all"
  },
  {
    id: "robot",
    name: "Robot Chrome",
    tagline: "Logam perak berantena \u2014 terkunci sampai misi \u201CPenjelajah Halaman\u201D selesai.",
    colors: { leg: "#4b5563", body: "#9ca3af", back: "#cbd5e1", head: "#6b7280", outline: "#e5e7eb", eye: "#38bdf8", pupil: "#0f172a", accent: "#22d3ee" },
    accessory: "antenna",
    mission: "tour-master"
  },
  {
    id: "peri",
    name: "Peri Kupu",
    tagline: "Ungu-pink bersayap \u2014 terkunci sampai misi \u201CTukang Cek\u201D selesai.",
    colors: { leg: "#4c1d95", body: "#c084fc", back: "#e9d5ff", head: "#a855f7", outline: "#f5d0fe", eye: "#fff7ff", pupil: "#4c1d95", accent: "#f9a8d4" },
    accessory: "wings",
    mission: "checker"
  },
  {
    id: "hantu",
    name: "Hantu Bulan",
    tagline: "Pucat berhalo \u2014 terkunci sampai misi \u201CPekerja Nonstop\u201D selesai.",
    colors: { leg: "#8b9bb4", body: "#e2e8f0", back: "#f8fafc", head: "#dbe3ef", outline: "#ffffff", eye: "#334155", pupil: "#0f172a", accent: "#c7d2fe" },
    accessory: "halo",
    mission: "nonstop-runner"
  }
];
var DEFAULT_PET_SKIN_ID = "baja";
function petSkinById(id) {
  const key = String(id ?? "").trim().toLowerCase();
  return PET_SKINS.find((s) => s.id === key) ?? PET_SKINS[0];
}
function skinAvailable(skin, ctx) {
  return !skin.mission || !ctx || missionRewards(ctx).has(skin.id);
}
function activePetSkin(ctx) {
  const skin = petSkinById(vscode.workspace.getConfiguration("dateSkunder").get("spider.skin"));
  return skinAvailable(skin, ctx) ? skin : PET_SKINS[0];
}
function petSkinPayload(skin) {
  return { ...skin, accessorySvg: ACCESSORY_SVG[skin.accessory] ?? "" };
}
function petSkinSharePayload(skin) {
  return {
    label: skin.name || skin.id,
    skinId: skin.id,
    accessory: skin.accessory,
    colors: skin.colors,
    data: JSON.stringify(petSkinPayload(skin))
  };
}
function buildSpiderWebConfig(ctx) {
  const c = vscode.workspace.getConfiguration("dateSkunder");
  return {
    type: "spiderConfig",
    enabled: c.get("spider.enabled") ?? true,
    speak: c.get("spider.voice") ?? false,
    allowActions: c.get("spider.allowActions") ?? true,
    autoRun: c.get("spider.autoRun") ?? true,
    walkSpeed: c.get("spider.walkSpeed") ?? 1,
    nonstopSeconds: Math.min(3600, Math.max(30, Math.round(c.get("spider.nonstopSeconds") ?? 90))),
    skin: petSkinPayload(activePetSkin(ctx))
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_PET_SKIN_ID,
  PET_SKINS,
  activePetSkin,
  buildSpiderWebConfig,
  petSkinById,
  petSkinPayload,
  petSkinSharePayload,
  skinAvailable
});
