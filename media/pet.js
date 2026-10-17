/* Pet Skin Date Skunder: pemilih kostum untuk pet Spider (laba-laba eksekutor di panel analisis).
   - Pratinjau tiap kostum digambar dari data yang dikirim ekstensi (warna + potongan SVG aksesori),
     jadi bentuknya sama dengan laba-laba yang berjalan di halaman analisis.
   - Tombol “Pakai” menyimpan pilihan ke pengaturan dateSkunder.spider.skin dan menyiarkannya ke
     semua halaman analisis yang terbuka — kostum langsung berganti tanpa perlu memuat ulang. */
(function () {
    const vscode = acquireVsCodeApi();
    const $ = (id) => document.getElementById(id);
    const grid = $('pet-grid');
    const stateEl = $('pet-state');
    const noteEl = $('pet-note');
    const missionsEl = $('pet-missions');

    let skins = [];
    let missions = [];
    let active = '';

    /** Geometri kaki yang sama dengan media/spider.js (4 pasang, femur + tibia). */
    const LEG_SPEC = [
        { y: 50, out: [-0.95, -0.48], femur: 19, tibia: 22 },
        { y: 58, out: [-1.00, -0.14], femur: 20, tibia: 23 },
        { y: 66, out: [-1.00, 0.18], femur: 20, tibia: 23 },
        { y: 74, out: [-0.92, 0.54], femur: 19, tibia: 22 },
    ];

    function norm(x, y) { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; }

    function legMarkup() {
        let out = '';
        for (let side = 0; side < 2; side++) {
            const sign = side === 0 ? -1 : 1;
            LEG_SPEC.forEach((spec) => {
                const hip = { x: 60 + sign * 10, y: spec.y };
                // spec.out ditulis untuk sisi kiri (x negatif); sisi kanan dicerminkan.
                const dir1 = norm(spec.out[0] * (sign === -1 ? 1 : -1), spec.out[1]);
                const knee = { x: hip.x + dir1.x * spec.femur, y: hip.y + dir1.y * spec.femur };
                const dir2 = norm(dir1.x * 0.42, dir1.y * 0.25 + 1);
                const foot = { x: knee.x + dir2.x * spec.tibia, y: knee.y + dir2.y * spec.tibia };
                out += `<g class="sp-leg"><path class="sp-seg" d="M ${hip.x} ${hip.y} L ${knee.x} ${knee.y}" />`
                    + `<g class="sp-tibia"><path class="sp-seg" d="M ${knee.x} ${knee.y} L ${foot.x} ${foot.y}" /></g></g>`;
            });
        }
        return out;
    }

    function previewSvg(skin) {
        return `<svg viewBox="0 0 120 120" aria-hidden="true">
            <g>${legMarkup()}</g>
            <ellipse class="sp-body" cx="60" cy="64" rx="17" ry="19" />
            <ellipse class="sp-back" cx="60" cy="67" rx="10" ry="11" />
            <circle class="sp-head" cx="60" cy="42" r="11.5" />
            <circle class="sp-eye" cx="55.4" cy="39" r="3.7" />
            <circle class="sp-eye" cx="64.6" cy="39" r="3.7" />
            <circle class="sp-pupil" cx="55.4" cy="39.6" r="1.8" />
            <circle class="sp-pupil" cx="64.6" cy="39.6" r="1.8" />
            ${skin.accessorySvg || ''}
        </svg>`;
    }

    function previewStyle(skin) {
        const c = skin.colors || {};
        return [
            `--sp-leg:${c.leg}`,
            `--sp-body:${c.body}`,
            `--sp-back:${c.back}`,
            `--sp-head:${c.head}`,
            `--sp-outline:${c.outline}`,
            `--sp-eye:${c.eye}`,
            `--sp-pupil:${c.pupil}`,
            `--sp-acc:${c.accent}`,
        ].join(';');
    }

    function note(text, kind) {
        if (!noteEl) { return; }
        noteEl.hidden = !text;
        noteEl.textContent = String(text || '');
        noteEl.className = 'pet-note' + (kind === 'bad' ? ' bad' : '');
    }

    function select(id) {
        note('Mengganti kostum…', 'info');
        vscode.postMessage({ type: 'select', id });
    }

    function render() {
        if (!grid) { return; }
        grid.innerHTML = '';
        skins.forEach((skin) => {
            const card = document.createElement('div');
            card.className = 'pet-card' + (skin.id === active ? ' active' : '') + (skin.locked ? ' locked' : '');

            const prev = document.createElement('div');
            prev.className = 'pet-prev';
            prev.style.cssText = previewStyle(skin);
            prev.innerHTML = previewSvg(skin);
            if (skin.locked) {
                const kunci = document.createElement('div');
                kunci.className = 'pet-lock';
                kunci.textContent = '🔒';
                prev.appendChild(kunci);
            }

            const nama = document.createElement('div');
            nama.className = 'pet-name';
            nama.textContent = skin.name || skin.id;

            const tag = document.createElement('div');
            tag.className = 'pet-tag';
            tag.textContent = skin.locked
                ? `Terkunci — selesaikan misi “${skin.missionName || '?'}” (${skin.missionProgress || '0/1'}) dulu.`
                : (skin.tagline || '');

            const pakai = document.createElement('button');
            pakai.type = 'button';
            pakai.className = 'pet-use';
            if (skin.locked) {
                pakai.textContent = '🔒 Terkunci';
                pakai.disabled = true;
                pakai.title = `Selesaikan misi “${skin.missionName || '?'}” dulu untuk membuka kostum ini`;
            } else if (skin.id === active) {
                pakai.textContent = '✓ dipakai';
                pakai.disabled = true;
                pakai.title = 'Kostum ini sedang dipakai pet';
            } else {
                pakai.textContent = 'Pakai';
                pakai.title = `Pakai kostum “${skin.name || skin.id}”`;
                pakai.onclick = () => select(skin.id);
            }

            card.appendChild(prev);
            card.appendChild(nama);
            card.appendChild(tag);
            card.appendChild(pakai);
            grid.appendChild(card);
        });
    }

    /** Daftar misi pembuka kostum: nama, progres, dan kostum hadiahnya. */
    function renderMissions() {
        if (!missionsEl) { return; }
        missionsEl.innerHTML = '';
        const selesai = missions.filter((m) => m.done).length;
        const judul = document.createElement('div');
        judul.className = 'pet-missions-head';
        judul.textContent = `🏁 Misi pembuka kostum · ${selesai}/${missions.length} selesai`;
        missionsEl.appendChild(judul);
        missions.forEach((m) => {
            const hadiah = skins.find((s) => s.id === m.rewardSkin);
            const baris = document.createElement('div');
            baris.className = 'pet-mission' + (m.done ? ' done' : '');
            const nama = document.createElement('div');
            nama.className = 'pet-mission-name';
            nama.textContent = `${m.done ? '✓' : '•'} ${m.name} — ${m.done ? 'selesai' : `${m.value}/${m.target}`}${hadiah ? ` → ${hadiah.name}` : ''}`;
            const detail = document.createElement('div');
            detail.className = 'pet-mission-detail';
            detail.textContent = m.detail;
            baris.appendChild(nama);
            baris.appendChild(detail);
            missionsEl.appendChild(baris);
        });
    }

    window.addEventListener('message', (e) => {
        const m = e.data || {};
        if (m.type === 'petSkinState') {
            skins = Array.isArray(m.skins) ? m.skins : [];
            missions = Array.isArray(m.missions) ? m.missions : [];
            active = String(m.active || '');
            const aktif = skins.find((s) => s.id === active);
            if (stateEl) {
                const terkunci = skins.filter((s) => s.locked).length;
                stateEl.textContent = skins.length
                    ? `${skins.length} kostum (${terkunci} terkunci) · aktif: ${aktif ? aktif.name : active}`
                    : 'belum ada kostum';
            }
            render();
            renderMissions();
        } else if (m.type === 'petSkinNote') {
            note(m.text, m.ok ? 'ok' : 'bad');
        }
    });

    const openCommBtn = $('pet-open-community');
    if (openCommBtn) {
        openCommBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'openCommunity' });
        });
    }

    vscode.postMessage({ type: 'ready' });
})();
