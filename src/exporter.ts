import * as vscode from 'vscode';
import * as path from 'path';
import { analyzeWorkbook } from './analysis';
import { treeOptionsFromSettings } from './treeConfig';
import { globalAnalysisStore } from './analysisStore';
import { buildJournal } from './Journal';
import { renderDocx } from './docxGenerator';
import { renderPdf } from './pdfgenerator';
import { renderXlsx } from './excelGenerator';
import { renderPptx } from './pptgenerator';
import { layoutFlow, workflowSvg } from './workflow';
import { flowImages } from './chartImages';

export type ExportFormat = 'docx' | 'pdf' | 'xlsx' | 'pptx' | 'workflow' | 'json';

const LABEL: Record<ExportFormat, string> = {
	docx: 'jurnal DOCX', pdf: 'jurnal PDF', xlsx: 'laporan Excel', pptx: 'presentasi PowerPoint (PPTX)',
	workflow: 'gambar workflow (PNG, JPG, SVG)', json: 'data JSON (seluruh analisis)',
};

interface OutFile { suffix: string; ext: string; data: Uint8Array }

/**
 * Membuat jurnal DOCX/PDF, laporan Excel (.xlsx), presentasi PowerPoint (.pptx), atau gambar workflow (PNG + JPG + SVG)
 * langsung dari file sumber. File disimpan di folder sumber (atau dateSkunder.exportFolder).
 */
export async function exportReport(format: ExportFormat, source: vscode.Uri, sheetName?: string): Promise<vscode.Uri | undefined> {
	return vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: `Membuat ${LABEL[format]}…` },
		async () => {
			try {
				const cfg = vscode.workspace.getConfiguration('dateSkunder');
				const fileName = path.posix.basename(source.path);
				const bytes = await vscode.workspace.fs.readFile(source);
				const wb = analyzeWorkbook(bytes, fileName, treeOptionsFromSettings());
				globalAnalysisStore.set(source.toString(), wb, fileName);
				const sheet =
					(sheetName && wb.sheets.find((s) => s.name === sheetName)) ||
					[...wb.sheets].sort((a, b) => b.totalRows - a.totalRows)[0];

				const author = cfg.get<string>('authorName') || 'Penulis';
				const affiliation = cfg.get<string>('affiliation') || '';
				const files: OutFile[] = [];
				if (format === 'docx' || format === 'pdf') {
					const journal = buildJournal(sheet, fileName, { author, affiliation, email: cfg.get<string>('email') || '' });
					files.push({ suffix: '-jurnal', ext: format, data: format === 'docx' ? await renderDocx(journal) : await renderPdf(journal) });
				} else if (format === 'xlsx') {
					files.push({ suffix: '-analisis', ext: 'xlsx', data: await renderXlsx(sheet, fileName) });
				} else if (format === 'pptx') {
					files.push({ suffix: '-presentasi', ext: 'pptx', data: await renderPptx(sheet, fileName, { author, affiliation }) });
				} else if (format === 'json') {
					// Seluruh hasil analisis berkas ini (semua lembar) sebagai .json yang bisa dibaca mesin.
					const isi = {
						exportedAt: new Date().toISOString(),
						sourceFileName: fileName,
						sheets: wb.sheets.map((s) => s.name),
						analysis: wb,
					};
					files.push({ suffix: '-data', ext: 'json', data: new TextEncoder().encode(JSON.stringify(isi)) });
				} else {
					// Gambar dirender satu kali, lalu disimpan sebagai PNG (utama), JPG, dan SVG (vektor).
					const fc = layoutFlow(sheet, 'slide', `Dataset ${fileName}, lembar ${sheet.name}`);
					const img = flowImages(fc, cfg.get<number>('workflowJpgQuality') ?? 92);
					files.push({ suffix: '-workflow', ext: 'png', data: img.png });
					files.push({ suffix: '-workflow', ext: 'jpg', data: img.jpg });
					files.push({ suffix: '-workflow', ext: 'svg', data: new TextEncoder().encode(workflowSvg(fc)) });
				}

				const folder = (cfg.get<string>('exportFolder') ?? '').trim();
				const dir = folder ? vscode.Uri.file(folder) : vscode.Uri.joinPath(source, '..');
				await vscode.workspace.fs.createDirectory(dir);
				const base = fileName.replace(/\.[^.]+$/, '');

				const targets: vscode.Uri[] = [];
				for (const f of files) {
					let target = vscode.Uri.joinPath(dir, `${base}${f.suffix}.${f.ext}`);
					try {
						await vscode.workspace.fs.writeFile(target, f.data);
					} catch {
						// file lama sedang terbuka/terkunci (mis. di Excel/Word/PowerPoint) -> simpan dengan nama baru
						const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
						target = vscode.Uri.joinPath(dir, `${base}${f.suffix}-${stamp}.${f.ext}`);
						await vscode.workspace.fs.writeFile(target, f.data);
					}
					targets.push(target);
				}

				await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
				if (cfg.get<boolean>('autoRevealInFileManager', true)) {
					await vscode.commands.executeCommand('revealFileInOS', targets[0]);
				}
				const names = targets.map((t) => path.posix.basename(t.path)).join(', ');
				vscode.window.showInformationMessage(`Tersimpan: ${names}`, 'Buka File').then((a) => {
					if (!a) { return; }
					// Gambar workflow dibuka langsung di editor VS Code (PNG); format lain dibuka dengan aplikasi bawaan.
					if (format === 'workflow') { void vscode.commands.executeCommand('vscode.open', targets[0]); }
					else { void vscode.env.openExternal(targets[0]); }
				});
				return targets[0];
			} catch (e) {
				console.error('Export gagal:', e);
				vscode.window.showErrorMessage(`Gagal membuat ${LABEL[format]}: ${e instanceof Error ? e.message : String(e)}`);
				return undefined;
			}
		}
	);
}