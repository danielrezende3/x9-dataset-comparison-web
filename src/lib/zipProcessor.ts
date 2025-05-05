// filepath: /home/danielrezende/projects/pibic/comparison-app-2/src/lib/zipProcessor.ts
import JSZip from 'jszip';
import { resetDB, transactionComplete, openDB, STORE_NAMES } from '$lib/db';

/**
 * validateFile: verifica tamanho e tipo do arquivo.
 */
function validateFile(file: File): void {
	if (file.size > 50 * 1024 * 1024) throw new Error('O arquivo ZIP excede 50 MB.');
	if (!file.name.endsWith('.zip')) throw new Error('Por favor selecione um arquivo ZIP.');
}

/**
 * getFileEntries: retorna lista de arquivos não-diretório no ZIP.
 */
function getFileEntries(zip: JSZip): string[] {
	return Object.values(zip.files)
		.filter((f) => !f.dir)
		.map((f) => f.name);
}

/**
 * mapBaseToExt: mapeia baseName para conjunto de extensões encontradas.
 */
function mapBaseToExt(names: string[]): Map<string, Set<string>> {
	const map = new Map<string, Set<string>>();
	for (const name of names) {
		const filename = name.split('/').pop()!;
		let base, ext;

		// Prioritize longer matches first
		if (filename.endsWith('.py.json')) {
			base = filename.slice(0, -8);
			ext = 'py.json';
		} else if (filename.endsWith('.py.py')) {
			base = filename.slice(0, -6);
			ext = 'py.py';
		} else if (filename.endsWith('.py')) {
			base = filename.slice(0, -3);
			ext = 'py';
		} else if (filename.endsWith('.md')) {
			base = filename.slice(0, -3);
			ext = 'md';
		} else {
			continue; // Skip files with other extensions if any slip through
		}

		if (!map.has(base)) map.set(base, new Set());
		map.get(base)!.add(ext);
	}
	return map;
}

/**
 * getMissingBases: identifica baseNames sem todos os arquivos obrigatórios.
 */
function getMissingBases(map: Map<string, Set<string>>): string[] {
	const requiredExts = ['py', 'py.json', 'md'];
	return (
		Array.from(map.entries())
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			.filter(([_, exts]) => !requiredExts.every((reqExt) => exts.has(reqExt)))
			.map(([base]) => base)
	);
}

/**
 * storeZipContents: armazena conteúdos do ZIP no IndexedDB.
 */
async function storeZipContents(map: Map<string, Set<string>>, zip: JSZip): Promise<void> {
	const db = await openDB();

	for (const base of map.keys()) {
		// Ensure files exist before trying to read them
		const pyFile = zip.file(`${base}.py`);
		const jsonFile = zip.file(`${base}.py.json`);
		const mdFile = zip.file(`${base}.md`);

		if (!pyFile || !jsonFile || !mdFile) {
			console.warn(
				`Skipping base "${base}" due to missing one or more required files in zip object.`
			);
			continue; // Should ideally not happen if getMissingBases works correctly
		}

		const [codeTxt, metaTxt, mdTxt] = await Promise.all([
			pyFile.async('text'),
			jsonFile.async('text'),
			mdFile.async('text')
		]);

		// Trim first and last lines from markdown if they exist
		const mdLines = mdTxt.split('\n');
		const trimmedMd = mdLines.length > 2 ? mdLines.slice(1, -1).join('\n') : mdTxt;

		const tx = db.transaction(Object.values(STORE_NAMES), 'readwrite');
		const codeStore = tx.objectStore(STORE_NAMES.CODE);
		const metaStore = tx.objectStore(STORE_NAMES.META);
		const mdStore = tx.objectStore(STORE_NAMES.MARKDOWN);
		const stateStore = tx.objectStore(STORE_NAMES.STATE);

		// Use await for each put operation for clarity or Promise.all if preferred
		await codeStore.put({ base, code: codeTxt });
		await metaStore.put({ base, meta: JSON.parse(metaTxt) });
		await mdStore.put({ base, md: trimmedMd });
		await stateStore.put({ base, state: 'not-compared' });

		await transactionComplete(tx);
		console.log(`Stored data for base: ${base}`);
	}
}

/**
 * processZip: Orchestrates the entire ZIP processing flow.
 * @param file The ZIP file to process.
 * @param updateStatus Callback to update the loading message in the UI.
 */
export async function processZip(
	file: File,
	updateStatus: (message: string) => void
): Promise<void> {
	updateStatus('Validando arquivo...');
	validateFile(file); // Basic validation first

	updateStatus('Limpando dados antigos...');
	await resetDB();

	updateStatus('Lendo arquivo ZIP...');
	const zip = await JSZip.loadAsync(file);
	const entries = getFileEntries(zip);

	updateStatus('Verificando estrutura do ZIP...');
	// Check for disallowed extensions first
	const invalidFiles = entries.filter((name) => {
		const filename = name.split('/').pop()!;
		return !filename.match(/\.(py\.json|py\.py|py|md)$/);
	});
	if (invalidFiles.length) {
		throw new Error(
			`Arquivos com extensões não permitidas encontrados: ${invalidFiles.join(', ')}. Apenas .py, .py.py, .md e .py.json são aceitos.`
		);
	}

	const map = mapBaseToExt(entries);
	const missing = getMissingBases(map);
	if (missing.length) {
		throw new Error(
			`O ZIP está incompleto. Cada item deve ter arquivos .py, .py.json e .md. Faltam arquivos para: ${missing.join(', ')}`
		);
	}

	updateStatus('Armazenando dados...');
	await storeZipContents(map, zip);
}
