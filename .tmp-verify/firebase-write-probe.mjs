// Probe tulis+hapus: pastikan aturan Firestore mengizinkan tulis ke koleksi community_umum.
const projectId = 'streamlit-launcher-vscode';
const apiKey = 'AIzaSyBIyAz-ZOIL_CzvNHC6PpYNr7NJJgzaVqo';
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

async function main() {
	// 1) Buat dokumen uji di koleksi community_umum
	const create = await fetch(`${base}/community_umum?key=${apiKey}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			fields: {
				username: { stringValue: '__probe_test__' },
				description: { stringValue: 'uji koneksi otomatis (dihapus)' },
				message: { stringValue: 'tes tulis-hapus' },
				timestamp: { integerValue: String(Date.now()) },
			},
		}),
	});
	const createText = await create.text();
	console.log('[CREATE] status:', create.status);
	console.log('[CREATE] body:', createText.slice(0, 500));
	if (!create.ok) { return; }

	let docName = '';
	try { docName = JSON.parse(createText).name; } catch { /* abaikan */ }
	if (!docName) { console.log('[CREATE] nama dokumen tidak ditemukan — hapus manual bila perlu'); return; }

	// 2) Hapus dokumen uji
	const del = await fetch(`${base.replace('/documents', '')}/${docName.split('/databases/')[1]}?key=${apiKey}`, { method: 'DELETE' });
	console.log('[DELETE] status:', del.status);
	console.log('[DELETE] body:', (await del.text()).slice(0, 200));
}

main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1); });
