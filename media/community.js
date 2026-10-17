/* Community Chat Date Skunder: ruang obrolan komunitas yang tersambung ke Firebase Firestore.
   - Profil = nama + deskripsi; avatar selalu gambar bawaan (media/community-default.png).
   - Yang dikirim ke Firestore: nama, deskripsi, isi pesan, waktu, dan opsional data binary skin (base64).
   - Tiap pesan menjadi satu dokumen di koleksi `community_<ruang>` (REST API, tanpa SDK).
   - Fitur baru: bagikan skin aktif (binary→base64 di Firestore) dan bagikan hasil AI ke komunitas. */
(function () {
    const vscode = acquireVsCodeApi();
    const cfg = window.SKUNDER_COMMUNITY || {};
    const $ = (id) => document.getElementById(id);

    const root = document.querySelector('.cw-root');
    const stateEl = $('cw-state');
    const channelEl = $('cw-channel');
    const refreshEl = $('cw-refresh');
    const msgsEl = $('cw-msgs');
    const textEl = $('cw-text');
    const sendEl = $('cw-send');
    const nameEl = $('cw-name');
    const bioEl = $('cw-bio');
    const saveEl = $('cw-save');
    const saveNoteEl = $('cw-save-note');
    const meSumEl = $('cw-me-sum');
    const avatarEl = $('cw-avatar');
    const setupEl = $('cw-setup');
    const openSettingsEl = $('cw-open-settings');
    const sendSkinEl = $('cw-send-skin');
    const sendAiEl = $('cw-send-ai');

    let AVATAR = String(cfg.defaultAvatar || '');
    const CHANNELS = Array.isArray(cfg.channels) && cfg.channels.length
        ? cfg.channels
        : [{ id: 'umum', label: '#umum', desc: '' }];
    const POLL_MS = 15000;
    const PAGE_SIZE = 200;

    const saved = vscode.getState() || {};
    /** @type {{name: string, bio: string}} */
    let profile = { name: '', bio: '' };
    let channel = CHANNELS[0].id;
    let messages = [];
    let busy = false;
    let timer = 0;
    let apiKey = String(cfg.apiKey || '').trim();
    /** Skin data terakhir yang dikirim dari ekstensi (JSON patch kostum atau base64 PNG). */
    let lastSkinData = null;
    /** Penanda permintaan data skin sudah dikirim (mencegah permintaan berulang). */
    let skinRequestSent = false;
    /** Pengguna sudah menekan “Bagikan Skin”; kirim otomatis begitu data tiba. */
    let pendingSkinShare = false;
    /** Teks AI terakhir yang diterima dari panel lain. */
    let lastAiText = null;

    /** Nilai string dari sebuah field Firestore REST. */
    function fieldStr(fields, key) {
        const v = fields && fields[key];
        if (!v || typeof v !== 'object') { return ''; }
        if (typeof v.stringValue === 'string') { return v.stringValue; }
        if (v.integerValue !== undefined) { return String(v.integerValue); }
        if (v.doubleValue !== undefined) { return String(v.doubleValue); }
        return '';
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function collectionsPath() {
        return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}`
            + `/databases/(default)/documents/community_${encodeURIComponent(channel)}`;
    }

    function status(text, bad) {
        if (!stateEl) { return; }
        stateEl.textContent = String(text || '');
        stateEl.className = 'cw-state' + (bad ? ' bad' : '');
    }

    function note(text, bad) {
        if (!saveNoteEl) { return; }
        saveNoteEl.hidden = !text;
        saveNoteEl.textContent = String(text || '');
        saveNoteEl.className = 'cw-note' + (bad ? ' bad' : '');
    }

    /** Jam relatif singkat: baru saja / x menit lalu / tanggal lokal. */
    function when(ms) {
        if (!ms) { return ''; }
        const d = Date.now() - ms;
        if (d < 0) { return 'baru saja'; }
        if (d < 60000) { return 'baru saja'; }
        if (d < 3600000) { return Math.floor(d / 60000) + ' menit lalu'; }
        if (d < 86400000) { return Math.floor(d / 3600000) + ' jam lalu'; }
        if (d < 604800000) { return Math.floor(d / 86400000) + ' hari lalu'; }
        return new Date(ms).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function stamp(ms) {
        return ms ? new Date(ms).toLocaleString('id-ID') : '';
    }

    /** Render satu baris pesan. Jika pesan berisi skinData, tampilkan badge skin. */
    function renderMsg(m) {
        const isMine = profile.name.trim().toLowerCase() && m.name.trim().toLowerCase() === profile.name.trim().toLowerCase();
        const nama = esc(m.name || 'tanpa nama');
        const bio = m.bio ? `<div class="cw-bio" title="${esc(m.bio)}">${esc(m.bio)}</div>` : '';
        const skinBadge = m.skinData
            ? `<div class="cw-skin-badge">🎨 <b>Patch Skin</b> · <span class="cw-muted">${esc(m.skinLabel || 'data skin')}</span></div>`
            : '';
        const aiBadge = m.aiResult
            ? `<div class="cw-ai-badge">🤖 <b>Hasil Analisis AI</b></div>`
            : '';
        const textContent = m.text
            ? `<div class="cw-text">${esc(m.text)}</div>`
            : '';
        return `<div class="cw-msg${isMine ? ' mine' : ''}${m.skinData ? ' skin-share' : ''}${m.aiResult ? ' ai-share' : ''}">
            <img class="cw-avatar" src="${esc(AVATAR)}" alt="" />
            <div class="cw-bubble">
                <div class="cw-top"><span class="cw-name">${nama}</span><span class="cw-when" title="${esc(stamp(m.at))}">${esc(when(m.at))}</span></div>
                ${bio}
                ${aiBadge}
                ${skinBadge}
                ${textContent}
            </div>
        </div>`;
    }

    /** Susun daftar pesan (terlama → terbaru) memakai avatar bawaan untuk semua orang. */
    function render() {
        if (!msgsEl) { return; }
        if (!apiKey) {
            msgsEl.innerHTML = '<div class="cw-empty">🔑 Ruang komunitas belum tersambung. Isi kunci web Firebase pada pengaturan <b>dateSkunder.community.webKey</b> (panel di bawah), lalu muat ulang.</div>';
            return;
        }
        if (!messages.length) {
            msgsEl.innerHTML = '<div class="cw-empty">Belum ada pesan di ruang ini. Jadilah yang pertama menyapa 👋</div>';
            return;
        }
        msgsEl.innerHTML = messages.map(renderMsg).join('');
        msgsEl.scrollTop = msgsEl.scrollHeight;
    }

    /** Muat pesan dari Firestore (urut waktu menaik). */
    async function load(silent) {
        if (!apiKey) { render(); return; }
        if (!silent) { status('memuat pesan…'); }
        try {
            const url = `${collectionsPath()}?key=${encodeURIComponent(apiKey)}&pageSize=${PAGE_SIZE}`;
            const res = await fetch(url);
            if (!res.ok) { throw new Error(await describeError(res)); }
            const json = await res.json();
            const docs = Array.isArray(json.documents) ? json.documents : [];
            messages = docs.map((d) => {
                const f = d.fields || {};
                const name = fieldStr(f, 'username') || fieldStr(f, 'name') || 'tanpa nama';
                const bio = fieldStr(f, 'description') || fieldStr(f, 'bio');
                const text = fieldStr(f, 'chat') || fieldStr(f, 'text');
                const skinData = fieldStr(f, 'skinData');
                const skinLabel = fieldStr(f, 'skinLabel');
                const aiResult = fieldStr(f, 'aiResult');
                return {
                    name: name.slice(0, 40),
                    bio: bio.slice(0, 200),
                    text: text,
                    skinData: skinData || null,
                    skinLabel: skinLabel || null,
                    aiResult: aiResult || null,
                    at: Number(fieldStr(f, 'at')) || 0,
                };
            }).filter((m) => m.text || m.skinData || m.aiResult).sort((a, b) => a.at - b.at);
            status(`${messages.length} pesan · ruang ${channel}`);
            render();
        } catch (err) {
            status('gagal memuat: ' + (err && err.message ? err.message : err), true);
            if (!messages.length) {
                msgsEl.innerHTML = `<div class="cw-empty">⚠️ Tidak bisa memuat pesan dari ruang <b>${esc(channel)}</b>.<br />${esc(err && err.message ? err.message : String(err))}</div>`;
            }
        }
    }

    /** Pesan galat REST yang mudah dibaca. */
    async function describeError(res) {
        let detail = '';
        try {
            const j = await res.json();
            detail = j && j.error && j.error.message ? j.error.message : '';
        } catch { /* badan bukan JSON → pakai status saja */ }
        if (res.status === 403 || /permission|PERMISSION/i.test(detail)) {
            return `ditolak Firestore (${res.status}). Pastikan aturan Firestore mengizinkan koleksi community_*.`;
        }
        if (res.status === 400 && /key|api_key|not valid/i.test(detail)) {
            return `Kunci web Firebase tidak valid (${res.status}). Periksa dateSkunder.community.webKey.`;
        }
        return `HTTP ${res.status}${detail ? ' — ' + detail : ''}`;
    }

    /** Validasi profil: tampilkan error jika nama kosong. */
    function requireProfile() {
        if (!profile.name.trim()) {
            note('Isi nama/username dulu di bagian "Profil Saya", lalu simpan.', true);
            const detailsEl = document.getElementById('cw-me');
            if (detailsEl) { detailsEl.open = true; }
            if (nameEl) { nameEl.focus(); }
            return false;
        }
        return true;
    }

    /** Kirim satu pesan teks biasa. */
    async function send() {
        if (busy || !apiKey) { return; }
        const text = String(textEl ? textEl.value : '').trim();
        if (!text) { return; }
        if (!requireProfile()) { return; }
        await postToFirestore({ text });
        if (textEl) { textEl.value = ''; }
    }

    /**
     * Simpan data skin terbaru dari ekstensi (konfigurasi awal maupun pesan `skinData`),
     * siapkan tombol bagikan, lalu lanjutkan pengiriman yang sempat tertunda.
     */
    function applySkinData(payload) {
        const ada = payload && (payload.label || payload.data || payload.id || payload.skinId);
        const tandaSebelum = lastSkinData ? `${lastSkinData.label || ''}|${lastSkinData.data || ''}` : '';
        lastSkinData = ada ? payload : null;
        const tandaSesudah = lastSkinData ? `${lastSkinData.label || ''}|${lastSkinData.data || ''}` : '';
        skinRequestSent = false;
        if (sendSkinEl) {
            sendSkinEl.disabled = !apiKey;
            sendSkinEl.title = lastSkinData
                ? `Bagikan skin aktif: ${lastSkinData.label || 'skin'}`
                : 'Bagikan skin aktif pet Spider ke ruang komunitas';
        }
        if (!pendingSkinShare) {
            // Penyegaran berkala dengan data yang sama tidak perlu menulis ulang baris status.
            if (lastSkinData && tandaSesudah !== tandaSebelum) {
                status(`Skin "${lastSkinData.label || 'skin'}" siap dibagikan · klik 🎨 Bagikan Skin`);
            }
            return;
        }
        // Pengguna sudah menekan tombol: lanjutkan pengiriman begitu datanya tiba.
        pendingSkinShare = false;
        if (lastSkinData) { void sendSkin(); }
        else { note('Data skin tidak tersedia dari ekstensi.', true); }
    }

    /** Kirim patch skin (data binary sebagai base64) ke Firestore. */
    async function sendSkin() {
        if (busy || !apiKey) { return; }
        if (!requireProfile()) { return; }
        if (!lastSkinData) {
            // Data skin dipegang ekstensi (view Pet Skin), jadi minta sekali lalu lanjutkan otomatis.
            if (!skinRequestSent) {
                skinRequestSent = true;
                pendingSkinShare = true;
                status('mengambil data skin aktif dari pet…');
                vscode.postMessage({ type: 'requestSkin' });
                return;
            }
            note('Data skin belum diterima dari ekstensi. Buka view Pet Skin sekali, lalu tekan tombol ini lagi.', true);
            return;
        }
        const label = lastSkinData.label || lastSkinData.name || 'skin-patch';
        const text = `[Patch Skin] ${label}`;
        await postToFirestore({
            text,
            skinData: lastSkinData.data || JSON.stringify(lastSkinData),
            skinLabel: label,
        });
    }

    /** Kirim hasil analisis AI ke komunitas. */
    async function sendAi() {
        if (busy || !apiKey) { return; }
        if (!requireProfile()) { return; }
        if (!lastAiText) {
            note('Belum ada hasil AI yang diterima. Jalankan analisis AI terlebih dahulu.', true);
            return;
        }
        const preview = lastAiText.slice(0, 900);
        await postToFirestore({
            text: preview,
            aiResult: 'true',
        });
        lastAiText = null;
        if (sendAiEl) { sendAiEl.style.display = 'none'; }
    }

    /** Kirim dokumen ke Firestore (nama/deskripsi/waktu selalu disertakan). */
    async function postToFirestore(extra) {
        if (busy || !apiKey) { return; }
        busy = true;
        if (sendEl) { sendEl.disabled = true; }
        if (sendSkinEl) { sendSkinEl.disabled = true; }
        if (sendAiEl) { sendAiEl.disabled = true; }
        status('mengirim…');
        try {
            const fields = {
                username: { stringValue: profile.name.trim().slice(0, 32) },
                name: { stringValue: profile.name.trim().slice(0, 32) },
                description: { stringValue: profile.bio.trim().slice(0, 160) },
                bio: { stringValue: profile.bio.trim().slice(0, 160) },
                chat: { stringValue: (extra.text || '').slice(0, 900) },
                text: { stringValue: (extra.text || '').slice(0, 900) },
                at: { integerValue: String(Date.now()) },
            };
            if (extra.skinData) {
                // Simpan data binary skin sebagai base64 string di Firestore
                fields.skinData = { stringValue: String(extra.skinData).slice(0, 100000) };
                fields.skinLabel = { stringValue: String(extra.skinLabel || 'skin').slice(0, 80) };
            }
            if (extra.aiResult) {
                fields.aiResult = { stringValue: 'true' };
            }
            const res = await fetch(`${collectionsPath()}?key=${encodeURIComponent(apiKey)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields }),
            });
            if (!res.ok) { throw new Error(await describeError(res)); }
            await load(true);
            status('terkirim · ruang ' + channel);
        } catch (err) {
            status('gagal mengirim: ' + (err && err.message ? err.message : err), true);
        } finally {
            busy = false;
            if (sendEl) { sendEl.disabled = false; }
            if (sendSkinEl) { sendSkinEl.disabled = false; }
            if (sendAiEl) { sendAiEl.disabled = false; }
            if (textEl) { textEl.focus(); }
        }
    }

    /** Simpan profil (dikirim ke ekstensi agar tersimpan di globalState) + tampilkan ringkasannya. */
    function saveProfile() {
        const name = String(nameEl ? nameEl.value : '').trim();
        const bio = String(bioEl ? bioEl.value : '').trim();
        if (!name) { note('Nama tampilan tidak boleh kosong.', true); if (nameEl) { nameEl.focus(); } return; }
        profile = { name, bio };
        vscode.setState(Object.assign({}, vscode.getState() || {}, { profile, channel }));
        vscode.postMessage({ type: 'saveProfile', name, bio });
        note('Profil disimpan. Nama dan deskripsi ini ikut tampil pada pesan berikutnya.');
        renderSummary();
    }

    function renderSummary() {
        const p = profile.name.trim();
        if (meSumEl) { meSumEl.textContent = p ? `· ${p}${profile.bio.trim() ? ' — ' + profile.bio.trim() : ''}` : '· nama belum diisi'; }
        if (avatarEl) { avatarEl.src = AVATAR; }
    }

    /** Isi dropdown ruang + pulihkan ruang terakhir. */
    function buildChannels() {
        if (!channelEl) { return; }
        channelEl.innerHTML = CHANNELS.map((c) => `<option value="${esc(c.id)}" title="${esc(c.desc || '')}">${esc(c.label || c.id)}</option>`).join('');
        if (saved.channel && CHANNELS.some((c) => c.id === saved.channel)) { channel = saved.channel; }
        channelEl.value = channel;
    }

    /** Tampilkan/bunyikan panel sambungan Firebase sesuai ada-tidaknya API key. */
    function renderSetup() {
        if (setupEl) { setupEl.hidden = !!apiKey; if (!apiKey) { setupEl.open = true; } }
        if (root) { root.classList.toggle('offline', !apiKey); }
        if (refreshEl) { refreshEl.disabled = !apiKey; }
        if (sendSkinEl) { sendSkinEl.disabled = !apiKey; }
    }

    function startPolling() {
        if (timer) { clearInterval(timer); }
        timer = setInterval(() => {
            if (document.visibilityState !== 'visible' || busy) { return; }
            void load(true);
        }, POLL_MS);
    }

    // ── kejadian UI ────────────────────────────────────────────────────────────
    if (channelEl) {
        channelEl.addEventListener('change', () => {
            channel = channelEl.value;
            vscode.setState(Object.assign({}, vscode.getState() || {}, { profile, channel }));
            messages = [];
            render();
            void load();
        });
    }
    if (refreshEl) {
        refreshEl.addEventListener('click', () => {
            refreshEl.classList.add('spin');
            void load().then(() => refreshEl.classList.remove('spin'));
        });
    }
    if (sendEl) { sendEl.addEventListener('click', () => void send()); }
    if (textEl) {
        textEl.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); void send(); }
        });
    }
    if (saveEl) { saveEl.addEventListener('click', saveProfile); }
    if (openSettingsEl) { openSettingsEl.addEventListener('click', () => vscode.postMessage({ type: 'openSettings' })); }
    if (sendSkinEl) { sendSkinEl.addEventListener('click', () => void sendSkin()); }
    if (sendAiEl) { sendAiEl.addEventListener('click', () => void sendAi()); }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && apiKey) { void load(true); } });

    // ── pesan dari ekstensi ────────────────────────────────────────────────────
    window.addEventListener('message', (e) => {
        const m = e.data || {};
        if (m.type === 'communityConfig') {
            apiKey = String(m.apiKey || '').trim();
            if (m.defaultAvatar) { AVATAR = String(m.defaultAvatar); }
            if (m.profile) { profile = { name: String(m.profile.name || ''), bio: String(m.profile.bio || '') }; }
            if (nameEl) { nameEl.value = profile.name; }
            if (bioEl) { bioEl.value = profile.bio; }
            renderSummary();
            renderSetup();
            render();
            if (m.skin) { applySkinData(m.skin); }
            if (apiKey) { void load(); }
            else { status('belum tersambung · kunci web Firebase belum diisi', true); }
        } else if (m.type === 'communityProfile') {
            profile = { name: String(m.profile && m.profile.name || ''), bio: String(m.profile && m.profile.bio || '') };
            if (nameEl) { nameEl.value = profile.name; }
            if (bioEl) { bioEl.value = profile.bio; }
            renderSummary();
            render();
        } else if (m.type === 'prefillMessage') {
            // Panel lain (AI chat, spider) mengirim teks agar langsung dikirim ke komunitas
            const txt = String(m.text || '').trim();
            if (txt) {
                lastAiText = txt;
                if (sendAiEl) { sendAiEl.style.display = ''; sendAiEl.disabled = !apiKey; }
                if (textEl) { textEl.value = txt.slice(0, 900); textEl.focus(); }
                status('Teks AI siap dibagikan. Klik "Kirim" atau gunakan tombol 🤖 Bagikan ke Chat.');
            }
        } else if (m.type === 'skinData') {
            // Ekstensi mengirim data skin aktif (JSON patch kostum atau base64 PNG)
            applySkinData(m.payload || { label: m.label || 'skin', data: m.data || '' });
        }
    });

    // ── awal ───────────────────────────────────────────────────────────────────
    buildChannels();
    if (saved.profile && saved.profile.name) { profile = { name: String(saved.profile.name), bio: String(saved.profile.bio || '') }; }
    if (cfg.profile && cfg.profile.name) { profile = { name: String(cfg.profile.name), bio: String(cfg.profile.bio || '') }; }
    if (nameEl) { nameEl.value = profile.name; }
    if (bioEl) { bioEl.value = profile.bio; }
    renderSummary();
    renderSetup();
    render();
    if (cfg.skin) { applySkinData(cfg.skin); }
    startPolling();
    vscode.postMessage({ type: 'ready' });
})();
