"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PET_MISSIONS = void 0;
exports.missionById = missionById;
exports.missionStates = missionStates;
exports.missionRewards = missionRewards;
exports.addMissionProgress = addMissionProgress;
/**
 * Semua kostum selain yang bawaan terkunci di balik satu misi: kerjakan misinya dulu untuk
 * membukanya. Urutan di sini hanya untuk tampilan.
 */
exports.PET_MISSIONS = [
    { id: 'first-export', name: 'Eksportir Pertama', detail: 'Klik satu tombol export di halaman (mis. minta “export excel”).', target: 1, rewardSkin: 'samurai' },
    { id: 'first-jurnal', name: 'Penulis Jurnal', detail: 'Jalankan export jurnal (DOCX atau PDF) sekali.', target: 1, rewardSkin: 'merah' },
    { id: 'first-workflow', name: 'Pembuat Alur', detail: 'Jalankan export flow (gambar workflow) sekali.', target: 1, rewardSkin: 'zamrud' },
    { id: 'navigator', name: 'Penjelajah Tab', detail: 'Pindahkan tab/filter stok 3 kali lewat pet.', target: 3, rewardSkin: 'senja' },
    { id: 'typist', name: 'Juru Ketik', detail: 'Suruh pet mengetik/mengisi kolom 5 kali (mis. “cari indomie”).', target: 5, rewardSkin: 'ungu' },
    { id: 'first-json', name: 'Penjaga Data', detail: 'Jalankan export JSON sekali.', target: 1, rewardSkin: 'es' },
    { id: 'first-pptx', name: 'Presenter', detail: 'Jalankan export PPT sekali.', target: 1, rewardSkin: 'emas' },
    { id: 'export-all', name: 'Sekali Klik Semua', detail: 'Minta “export semua sekaligus” sampai 3 tombol export berhasil diklik dalam satu perintah.', target: 3, rewardSkin: 'lava' },
    { id: 'tour-master', name: 'Penjelajah Halaman', detail: 'Jalankan “▶ Jalankan semua fitur” sampai selesai.', target: 1, rewardSkin: 'robot' },
    { id: 'checker', name: 'Tukang Cek', detail: 'Jalankan “✓ Cek semua kontrol” satu kali.', target: 1, rewardSkin: 'peri' },
    { id: 'nonstop-runner', name: 'Pekerja Nonstop', detail: 'Selesaikan 5 putaran kerja nonstop.', target: 5, rewardSkin: 'hantu' },
    { id: 'marathon', name: 'Maraton Halaman', detail: 'Selesaikan total 25 aksi berhasil di halaman (akumulatif).', target: 25, rewardSkin: 'ninja' },
];
function missionById(id) {
    return exports.PET_MISSIONS.find((m) => m.id === id);
}
const KEY = 'dateSkunder.petMissions';
function read(ctx) {
    return ctx.globalState.get(KEY) ?? {};
}
/** Keadaan misi untuk ditampilkan di view Pet Skin. */
function missionStates(ctx) {
    const p = read(ctx);
    return exports.PET_MISSIONS.map((m) => {
        const value = Math.min(m.target, Math.max(0, Math.floor(p[m.id] ?? 0)));
        return { ...m, value, done: value >= m.target };
    });
}
/** Id kostum yang sudah terbuka karena misinya selesai. */
function missionRewards(ctx) {
    return new Set(missionStates(ctx).filter((m) => m.done).map((m) => m.rewardSkin));
}
/**
 * Tambah progres misi. Mengembalikan id misi yang BARU selesai (dipakai untuk notifikasi).
 * Progres tidak pernah melewati target dan tidak pernah turun.
 */
async function addMissionProgress(ctx, deltas) {
    const now = { ...read(ctx) };
    const selesai = [];
    let berubah = false;
    for (const m of exports.PET_MISSIONS) {
        const tambah = Math.max(0, Math.floor(deltas[m.id] ?? 0));
        if (!tambah) {
            continue;
        }
        const lama = Math.max(0, Math.floor(now[m.id] ?? 0));
        if (lama >= m.target) {
            continue;
        }
        const baru = Math.min(m.target, lama + tambah);
        now[m.id] = baru;
        berubah = true;
        if (baru >= m.target) {
            selesai.push(m.id);
        }
    }
    if (berubah) {
        await ctx.globalState.update(KEY, now);
    }
    return selesai;
}
