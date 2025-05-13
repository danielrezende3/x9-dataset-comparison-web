import JSZip from 'jszip';
import { resetDB, transactionComplete, openDB, STORE_NAMES } from '$lib/db';

/////////////////////////
// — CONFIG & TYPES — //
/////////////////////////

const CODE_EXTENSIONS = ['py', 'c'] as const;
const RENDER_EXTENSION = 'svg' as const;
const MAX_FILE_SIZE = 1;
type FilenameParts = { base: string; ext: string };
type BaseMap = Map<string, Set<string>>;

/** Lightweight logger — swap out for a no-op or 3rd-party later */
const Logger = {
	warn: console.warn.bind(console, '[zipProcessor]'),
	info: console.log.bind(console, '[zipProcessor]')
};
///////////////////////////
// — MESSAGES MODULE  — //
///////////////////////////

const MESSAGES = {
	invalidZip: 'Selecione um arquivo ZIP (.zip).',
	zipTooLarge: `O ZIP excede ${MAX_FILE_SIZE} MB.`,
	onlyAllowedExtensions: () =>
		`Somente .${[...CODE_EXTENSIONS, RENDER_EXTENSION].join(', .')} são permitidos.`,
	onlyAllowedExtensionsFound: (invalid: string[]) =>
		`${MESSAGES.onlyAllowedExtensions()} Encontrados: ${invalid.join(', ')}`,
	status: {
		validatingZip: 'Validando ZIP…',
		cleaningDB: 'Limpando banco…',
		readingZip: 'Lendo ZIP…',
		validatingContent: 'Validando conteúdo…',
		writingDB: 'Gravando no banco…'
	},
	skippingNoMd: (base: string) => `Pulando "${base}" sem .${RENDER_EXTENSION}`,
	skippingFileNotFound: (base: string) => `Pulando "${base}" — arquivo não encontrado no ZIP`,
	persisted: (base: string, ext: string) => `Persistido: ${base} (.${ext} + .${RENDER_EXTENSION})`,
	incompleteBases: (bases: string[]) =>
		`Faltam arquivos para: ${bases.join(', ')}. ` +
		`Cada conjunto precisa de .${RENDER_EXTENSION} + (.${CODE_EXTENSIONS.join(' ou .')}).`
};

//////////////////////////
// — HELPERS & UTILS — //
//////////////////////////

/**
 * Extracts base name and extension from "foo.py", "bar.md", etc.
 * Returns null for unsupported extensions.
 */
function parseFilename(filename: string): FilenameParts | null {
	const dot = filename.lastIndexOf('.');
	if (dot < 0) return null;
	const base = filename.slice(0, dot);
	const ext = filename.slice(dot + 1);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	if ([...CODE_EXTENSIONS, RENDER_EXTENSION].includes(ext as any)) {
		return { base, ext };
	}
	return null;
}

/** Throws if file not a .zip or too large. */
function validateZipFile(file: File): void {
	if (!file.name.toLowerCase().endsWith('.zip')) {
		throw new Error(MESSAGES.invalidZip);
	}
	if (file.size > MAX_FILE_SIZE * 1024 * 1024) {
		throw new Error(MESSAGES.zipTooLarge);
	}
}

/** Ensure no file slips through with a disallowed extension. */
function validateEntries(entries: string[]): void {
	const invalid = entries
		.map((p) => p.split('/').pop()!)
		.filter(
			(name) =>
				!name.match(new RegExp(`\\.(${CODE_EXTENSIONS.join('|')}|${RENDER_EXTENSION})$`, 'i'))
		);
	if (invalid.length) {
		throw new Error(MESSAGES.onlyAllowedExtensionsFound(invalid));
	}
}

/** Builds a map: baseName → Set of extensions seen. */
function buildBaseMap(entries: string[]): BaseMap {
	const map: BaseMap = new Map();
	for (const path of entries) {
		const name = path.split('/').pop()!;
		const parts = parseFilename(name);
		if (!parts) continue;
		const { base, ext } = parts;
		if (!map.has(base)) map.set(base, new Set());
		map.get(base)!.add(ext);
	}
	return map;
}

/**
 * Returns array of bases that lack either:
 *   • a Markdown file, OR
 *   • at least one code file (py or c)
 */
function findIncompleteBases(map: BaseMap): string[] {
	const missing: string[] = [];
	for (const [base, exts] of map.entries()) {
		if (!exts.has(RENDER_EXTENSION) || !CODE_EXTENSIONS.some((e) => exts.has(e))) {
			missing.push(base);
		}
	}
	return missing;
}

///////////////////////
// — DB OPERATIONS — //
///////////////////////

/**
 * Reads code + markdown text from ZIP and writes them (plus initial state)
 * into IndexedDB.
 * Stores `{ base, code, language }` in CODE, `{ base, md }` in MARKDOWN,
 * and `{ base, state }` in STATE.
 */
async function storeContents(map: BaseMap, zip: JSZip): Promise<void> {
	const db = await openDB();

	for (const [base, exts] of map.entries()) {
		const codeExt = CODE_EXTENSIONS.find((e) => exts.has(e))!;
		if (!exts.has(RENDER_EXTENSION)) {
			Logger.warn(MESSAGES.skippingNoMd(base));
			continue;
		}

		const codeFile = zip.file(`${base}.${codeExt}`);
		const mdFile = zip.file(`${base}.${RENDER_EXTENSION}`);
		if (!codeFile || !mdFile) {
			Logger.warn(MESSAGES.skippingFileNotFound(base));
			continue;
		}

		const [codeText, mdText] = await Promise.all([codeFile.async('text'), mdFile.async('text')]);

		// remove primeira e última linha de MD (e.g. ‹---› fences)
		const lines = mdText.split('\n');
		const trimmedMd = lines.length > 2 ? lines.slice(1, -1).join('\n') : mdText;

		const tx = db.transaction(
			[STORE_NAMES.CODE, STORE_NAMES.MARKDOWN, STORE_NAMES.STATE],
			'readwrite'
		);
		tx.objectStore(STORE_NAMES.CODE).put({ base, code: codeText, language: codeExt });
		tx.objectStore(STORE_NAMES.MARKDOWN).put({ base, md: trimmedMd });
		tx.objectStore(STORE_NAMES.STATE).put({ base, state: 'not-compared' });

		await transactionComplete(tx);
		Logger.info(MESSAGES.persisted(base, codeExt));
	}
}

//////////////////////
// — MAIN EXPORT —  //
//////////////////////

export async function processZip(file: File, updateStatus: (msg: string) => void): Promise<void> {
	updateStatus(MESSAGES.status.validatingZip);
	validateZipFile(file);

	updateStatus(MESSAGES.status.cleaningDB);
	await resetDB();

	updateStatus(MESSAGES.status.readingZip);
	const zip = await JSZip.loadAsync(file);

	updateStatus(MESSAGES.status.validatingContent);
	const entries = Object.values(zip.files)
		.filter((f) => !f.dir)
		.map((f) => f.name);

	validateEntries(entries);
	const baseMap = buildBaseMap(entries);

	const incomplete = findIncompleteBases(baseMap);
	if (incomplete.length) {
		throw new Error(MESSAGES.incompleteBases(incomplete));
	}

	updateStatus(MESSAGES.status.writingDB);
	await storeContents(baseMap, zip);
}
