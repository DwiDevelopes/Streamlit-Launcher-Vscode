// Probe read-only: cek apakah Firestore project streamlit-launcher-vscode bisa diakses lewat REST API.
const projectId = 'streamlit-launcher-vscode';
const apiKey = 'AIzaSyBIyAz-ZOIL_CzvNHC6PpYNr7NJJgzaVqo';
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

async function main() {
	// 1) GET root documents (bentuk error menjelaskan status database/rules)
	const g = await fetch(`${base}?key=${apiKey}&pageSize=1`, { method: 'GET' });
	console.log('[GET documents] status:', g.status);
	console.log('[GET documents] body:', (await g.text()).slice(0, 400));

	// 2) runQuery persis seperti yang akan dipakai webview chat
	const q = await fetch(`${base}:runQuery?key=${apiKey}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			structuredQuery: {
				from: [{ collectionId: 'community_umum' }],
				orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'DESCENDING' }],
				limit: 5,
			},
		}),
	});
	console.log('[runQuery community_umum] status:', q.status);
	console.log('[runQuery community_umum] body:', (await q.text()).slice(0, 400));
}

main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1); });
