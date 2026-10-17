import * as vscode from 'vscode';
import type { AiHub } from './aiViews';
import { PET_SKINS, activePetSkin, petSkinById, petSkinPayload } from './petSkins';
import { missionRewards, missionStates } from './petMissions';

const PET_VIEW = 'dateSkunder.petView';

export class PetViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;

    constructor(private hub: AiHub, private ctx: vscode.ExtensionContext) { }

    resolveWebviewView(view: vscode.WebviewView): void {
        this.view = view;
        view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.hub.extensionUri, 'media')] };
        view.webview.html = this.html(view.webview);
        view.webview.onDidReceiveMessage((m) => void this.onMessage(m));
        view.onDidDispose(() => { this.view = undefined; });
    }

    private html(webview: vscode.Webview): string {
        const media = vscode.Uri.joinPath(this.hub.extensionUri, 'media');
        const css = webview.asWebviewUri(vscode.Uri.joinPath(media, 'pet.css'));
        const js = webview.asWebviewUri(vscode.Uri.joinPath(media, 'pet.js'));
        const n = Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('');
        return /* html */ `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${n}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
<link href="${css}" rel="stylesheet">
<title>Pet Skin</title>
</head>
<body class="pet-body">
<div class="pet-root">
    <div class="pet-head">
        <strong>🎨 Pet Skin</strong>
        <span id="pet-state" class="pet-state">memuat…</span>
    </div>
    <p class="pet-intro">
        Pet <b>Spider</b> yang mengeksekusi aksi di panel analisis — berjalan ke bagiannya, menyorot,
        lalu menekan atau mengisi kontrolnya; hasil kerjanya dijelaskan oleh otak model penuh.
        Chat AI khusus percakapan. Di awal hanya kostum <b>bawaan</b> yang tersedia: <b>semua kostum
        lain terkunci</b> dan terbuka dengan menyelesaikan misinya (daftar Misi di bawah). Pilihan
        langsung dipakai pet di semua halaman analisis yang sedang terbuka.
    </p>
    <div id="pet-grid" class="pet-grid"></div>
    <div id="pet-missions" class="pet-missions"></div>
    <div id="pet-note" class="pet-note" hidden></div>
    <div class="pet-community-banner" style="margin-top:16px;padding:10px 12px;border:1px solid var(--vscode-panel-border, rgba(128,128,128,.3));border-radius:8px;background:var(--vscode-sideBar-background, rgba(128,128,128,.08));display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div>
            <div style="font-weight:600;font-size:11.5px;">💬 Community Chat</div>
            <div style="font-size:10.5px;opacity:.75;line-height:1.4;">Ruang obrolan komunitas tepat di bawah view ini.</div>
        </div>
        <button id="pet-open-community" type="button" style="padding:4px 9px;font-size:11px;cursor:pointer;white-space:nowrap;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:5px;font-weight:500;">Buka Chat</button>
    </div>
</div>
<script nonce="${n}" src="${js}"></script>
</body>
</html>`;
    }

    private post(message: unknown): void {
        void this.view?.webview.postMessage(message);
    }

    /** Keadaan terbaru: daftar kostum (termasuk yang terkunci) + misi pembukanya. */
    private statePayload() {
        const missions = missionStates(this.ctx);
        const rewards = missionRewards(this.ctx);
        return {
            type: 'petSkinState',
            active: activePetSkin(this.ctx).id,
            missions,
            skins: PET_SKINS.map((s) => {
                const misi = s.mission ? missions.find((m) => m.id === s.mission) : undefined;
                return {
                    ...petSkinPayload(s),
                    locked: !!s.mission && !rewards.has(s.id),
                    missionName: misi ? misi.name : '',
                    missionProgress: misi ? `${misi.value}/${misi.target}` : '',
                };
            }),
        };
    }

    /** Tampilkan pilihan terbaru (dipakai saat view dibuka dan setelah pengaturan berubah). */
    refresh(): void {
        this.post(this.statePayload());
    }

    /** Pakai satu kostum: simpan ke pengaturan, siarkan ke panel analisis, lalu perbarui tampilan. */
    async selectSkin(id: string): Promise<void> {
        const skin = petSkinById(id);
        if (skin.mission && !missionRewards(this.ctx).has(skin.id)) {
            const misi = missionStates(this.ctx).find((m) => m.id === skin.mission);
            this.post({
                type: 'petSkinNote',
                ok: false,
                text: `Kostum “${skin.name}” masih terkunci. Selesaikan misi “${misi ? misi.name : skin.mission}” dulu${misi ? ` (${misi.value}/${misi.target})` : ''}.`,
            });
            return;
        }
        await vscode.workspace.getConfiguration('dateSkunder').update('spider.skin', skin.id, vscode.ConfigurationTarget.Global);
        this.hub.broadcastSpiderConfig();
        this.refresh();
        this.post({
            type: 'petSkinNote',
            ok: true,
            text: `Kostum “${skin.name}” dipakai — laba-laba di panel analisis yang terbuka langsung berubah.`,
        });
    }

    private async onMessage(msg: any): Promise<void> {
        switch (msg?.type) {
            case 'ready':
                this.refresh();
                break;
            case 'select':
                await this.selectSkin(String(msg.id ?? ''));
                break;
            case 'openCommunity':
                await vscode.commands.executeCommand('dateSkunder.communityView.focus');
                break;
        }
    }
}

/** Daftarkan view Pet Skin beserta perintah-perintahnya. */
export function registerPetView(context: vscode.ExtensionContext, hub: AiHub): PetViewProvider {
    const provider = new PetViewProvider(hub, context);
    // Hub perlu kenal view ini supaya progres misi dari halaman analisis bisa langsung terlihat di sini.
    hub.bindPetView(provider);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(PET_VIEW, provider, { webviewOptions: { retainContextWhenHidden: true } }),
        vscode.commands.registerCommand('date-skunder.pet.open', async () => {
            await vscode.commands.executeCommand(`${PET_VIEW}.focus`);
        }),
        vscode.commands.registerCommand('date-skunder.pet.pick', async () => {
            const aktif = activePetSkin(context).id;
            const pilih = await vscode.window.showQuickPick(
                PET_SKINS.map((s) => ({
                    label: `${s.id === aktif ? '$(check) ' : ''}${s.name}`,
                    description: s.id === aktif ? 'sedang dipakai' : s.id,
                    detail: s.tagline,
                    id: s.id,
                })),
                { title: 'Pilih kostum pet Spider' },
            );
            if (!pilih) { return; }
            await provider.selectSkin(pilih.id);
            await vscode.commands.executeCommand(`${PET_VIEW}.focus`);
        }),
        // Pengaturan bisa juga diubah dari Settings → siarkan ulang supaya kostum pet langsung berganti.
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('dateSkunder.spider.skin')) {
                hub.broadcastSpiderConfig();
                provider.refresh();
            }
        }),
    );
    return provider;
}
