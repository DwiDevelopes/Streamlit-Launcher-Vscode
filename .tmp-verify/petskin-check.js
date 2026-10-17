/* Uji fungsional scratch: 13 kostum (12 terkunci + 1 bawaan) + aturan misi pembuka (stub vscode). */
const Module = require('module');
const origLoad = Module._load;
let skinSetting = 'emas';
const store = {};
Module._load = function (request, parent, isMain) {
    if (request === 'vscode') {
        return {
            workspace: { getConfiguration: () => ({ get: (key) => (key === 'spider.skin' ? skinSetting : undefined) }) },
        };
    }
    return origLoad.apply(this, arguments);
};

const assert = require('assert');
const m = require('./petskin-test/petSkins.js');
const missions = require('./petskin-test/petMissions.js');
const ctx = { globalState: { get: (k) => store[k], update: async (k, v) => { store[k] = v; } } };

// ── 1. katalog kostum ───────────────────────────────────────────────────────
assert.strictEqual(m.PET_SKINS.length, 13, 'ada 13 kostum');
const ids = new Set(m.PET_SKINS.map((s) => s.id));
assert.strictEqual(ids.size, 13, 'id kostum unik');
for (const s of m.PET_SKINS) {
    for (const key of ['leg', 'body', 'back', 'head', 'outline', 'eye', 'pupil', 'accent']) {
        assert.ok(/^#[0-9a-f]{6}$/i.test(s.colors[key]), `${s.id}.${key} harus warna hex`);
    }
    const payload = m.petSkinPayload(s);
    if (s.accessory === 'none') { assert.strictEqual(payload.accessorySvg, '', `${s.id} tanpa aksesori`); }
    else { assert.ok(payload.accessorySvg.includes('<'), `${s.id} punya potongan SVG aksesori`); }
}

// ── 2. SEMUA kostum selain bawaan harus terkunci di balik misi ─────────────
const terkunci = m.PET_SKINS.filter((s) => s.mission);
assert.strictEqual(terkunci.length, 12, '12 kostum terkunci');
assert.strictEqual(m.PET_SKINS.filter((s) => !s.mission).length, 1, 'hanya kostum bawaan yang terbuka');
assert.strictEqual(m.PET_SKINS[0].mission, undefined, 'kostum bawaan (pertama) tanpa misi');
assert.strictEqual(missions.PET_MISSIONS.length, 12, '12 misi pembuka');
for (const s of terkunci) {
    assert.ok(missions.PET_MISSIONS.some((mm) => mm.id === s.mission), `${s.id}: misi ${s.mission} ada di katalog`);
}
for (const mm of missions.PET_MISSIONS) {
    assert.ok(ids.has(mm.rewardSkin), `hadiah misi ${mm.id} menunjuk kostum yang ada (${mm.rewardSkin})`);
    assert.strictEqual(m.PET_SKINS.find((s) => s.id === mm.rewardSkin).mission, mm.id, `kostum ${mm.rewardSkin} memang dikunci misi ${mm.id}`);
}
assert.strictEqual(new Set(missions.PET_MISSIONS.map((x) => x.rewardSkin)).size, 12, 'tiap misi menghadiahkan kostum berbeda');

// ── 3. kostum terkunci → pet memakai bawaan ────────────────────────────────
skinSetting = 'emas';
assert.strictEqual(m.activePetSkin(ctx).id, 'baja', 'kostum pilihan masih terkunci → pet memakai bawaan');
assert.strictEqual(m.activePetSkin().id, 'emas', 'tanpa ctx pengaturan dipakai apa adanya (mode uji terpisah)');
store['dateSkunder.petMissions'] = { 'first-pptx': 1 };
assert.strictEqual(m.activePetSkin(ctx).id, 'emas', 'setelah misi PPT selesai, kostum emas boleh dipakai');
assert.strictEqual(m.skinAvailable(m.petSkinById('emas'), ctx), true);
assert.strictEqual(m.skinAvailable(m.petSkinById('robot'), ctx), false, 'robot masih terkunci');
assert.strictEqual(m.skinAvailable(m.petSkinById('baja'), ctx), true, 'kostum bawaan selalu boleh');
delete store['dateSkunder.petMissions'];

// ── 4. pencarian & konfigurasi (regresi) ───────────────────────────────────
assert.strictEqual(m.petSkinById('Emas Royal').id, m.DEFAULT_PET_SKIN_ID, 'nama bukan id → bawaan');
assert.strictEqual(m.petSkinById('ROBOT').id, 'robot', 'id tidak peka huruf besar/kecil');
assert.strictEqual(m.petSkinById('tidak-ada').id, m.DEFAULT_PET_SKIN_ID, 'id asing → kostum bawaan');
skinSetting = 'ngawur';
assert.strictEqual(m.activePetSkin(ctx).id, m.DEFAULT_PET_SKIN_ID, 'pengaturan rusak → bawaan');
skinSetting = 'emas';
const cfg = m.buildSpiderWebConfig(ctx);
assert.strictEqual(cfg.type, 'spiderConfig');
assert.strictEqual(cfg.skin.id, 'baja', 'panel menerima kostum bawaan selama kostum pilihan masih terkunci');
assert.strictEqual(typeof cfg.nonstopSeconds, 'number', 'jeda nonstop ikut dikirim');

// ── 5. misi: progres tidak melewati target & membuka kostum tepat waktu ────
(async () => {
    assert.strictEqual(missions.missionStates(ctx).filter((x) => x.done).length, 0, 'awalnya semua misi kosong');

    let selesai = await missions.addMissionProgress(ctx, { 'first-export': 1 });
    assert.deepStrictEqual(selesai, ['first-export'], 'misi export pertama selesai');
    assert.ok(missions.missionRewards(ctx).has('samurai'), 'kostum samurai terbuka');

    let selesaiNonstop = [];
    for (let i = 0; i < 6; i++) {
        const out = await missions.addMissionProgress(ctx, { 'nonstop-runner': 1 });
        if (out.length) {
            selesaiNonstop = out;
            assert.strictEqual(i, 4, 'misi nonstop selesai tepat pada putaran ke-5');
        }
    }
    assert.deepStrictEqual(selesaiNonstop, ['nonstop-runner'], 'misi nonstop selesai sekali saja');
    assert.deepStrictEqual(await missions.addMissionProgress(ctx, { 'nonstop-runner': 1 }), [], 'setelah selesai tidak ada notifikasi ulang');
    const st = missions.missionStates(ctx).find((x) => x.id === 'nonstop-runner');
    assert.strictEqual(st.value, 5, 'progres tidak melewati target');
    assert.ok(missions.missionRewards(ctx).has('hantu'), 'kostum hantu terbuka');

    await missions.addMissionProgress(ctx, { 'export-all': 2 });
    assert.ok(!missions.missionRewards(ctx).has('lava'), '2 export belum membuka lava');
    await missions.addMissionProgress(ctx, { 'export-all': 1 });
    assert.ok(missions.missionRewards(ctx).has('lava'), '3 export dalam satu perintah membuka lava');

    await missions.addMissionProgress(ctx, { typist: 5 });
    assert.ok(missions.missionRewards(ctx).has('ungu'), 'misi juru ketik (5×) membuka ungu');
    await missions.addMissionProgress(ctx, { navigator: 3 });
    assert.ok(missions.missionRewards(ctx).has('senja'), 'misi penjelajah tab (3×) membuka senja');

    console.log('OK: 13 kostum (12 terkunci + bawaan) + 12 misi & aturan pembukaan terverifikasi.');
})();
