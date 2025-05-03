<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Markdown } from '$lib/types/markdown';
	import type { PythonCode } from '$lib/types/pythonCode';
	import type { PythonMeta } from '$lib/types/pythonMeta';
	import type { stateComparison } from '$lib/types/stateComparison';
	import JSZip from 'jszip';

	// Bind targets
	let uploadArea: HTMLElement;
	let fileInput: HTMLInputElement;

	// Reactive state
	let error = $state<string>('');
	let loading = $state(false);
	let success = $state(false);

	// Data interfaces

	// Main handler
	async function handleZip(file: File): Promise<void> {
		resetState();
		try {
			validateFile(file);
			loading = true;

			const zip = await JSZip.loadAsync(file);
			const entries = getFileEntries(zip);

			// Ensure only allowed extensions
			const invalidFiles = entries.filter((name) => !/^(.*)\.(py\.json|py\.py|py|md)$/.test(name));
			if (invalidFiles.length) {
				throw new Error(
					`Extensões inválidas encontradas, São permitidos apenas ".py", ".py.py", ".md" e ".py.json".`
				);
			}

			const map = mapBaseToExt(entries);
			const missing = getMissingBases(map);
			if (missing.length) {
				throw new Error(`Faltam versões para: ${missing.join(', ')}`);
			}

			await storeZipContents(map, zip);
			success = true;
			goto('/files');
		} catch (err: any) {
			console.error(err);
			error = err.message || 'Erro ao processar ZIP.';
		} finally {
			loading = false;
			uploadArea.classList.remove('drag-over');
		}
	}

	// Reset UI state
	function resetState(): void {
		error = '';
		success = false;
	}

	// Validate file size & type
	function validateFile(file: File): void {
		if (file.size > 50 * 1024 * 1024) throw new Error('O arquivo ZIP excede 50 MB.');
		if (!file.name.endsWith('.zip')) throw new Error('Por favor selecione um arquivo ZIP.');
	}

	// List all non-directory entries
	function getFileEntries(zip: JSZip): string[] {
		return Object.values(zip.files)
			.filter((f) => !f.dir)
			.map((f) => f.name);
	}

	// Map baseName → set of extensions found
	function mapBaseToExt(names: string[]): Map<string, Set<string>> {
		const map = new Map<string, Set<string>>();
		for (const name of names) {
			// Handle path separators by extracting just the filename
			const filename = name.split('/').pop()!;

			let base, ext;

			if (filename.endsWith('.py.json')) {
				// Handle filename.py.json
				base = filename.substring(0, filename.length - 8);
				ext = 'py.json';
			} else if (filename.endsWith('.py.py')) {
				// Handle filename.py.py
				base = filename.substring(0, filename.length - 6);
				ext = 'py.py';
			} else if (filename.endsWith('.py')) {
				// Handle filename.py
				base = filename.substring(0, filename.length - 3);
				ext = 'py';
			} else if (filename.endsWith('.md')) {
				// Handle filename.md
				base = filename.substring(0, filename.length - 3);
				ext = 'md';
			} else {
				console.log(`Skipping file with unknown extension: ${filename}`);
				continue;
			}

			if (!map.has(base)) map.set(base, new Set());
			map.get(base)!.add(ext);
		}
		return map;
	}

	// Find bases missing any of the three required files
	function getMissingBases(map: Map<string, Set<string>>): string[] {
		return Array.from(map.entries())
			.filter(([_, exts]) => !exts.has('py') || !exts.has('py.json') || !exts.has('md'))
			.map(([base]) => base);
	}

	// Store files into IndexedDB
	async function storeZipContents(map: Map<string, Set<string>>, zip: JSZip): Promise<void> {
		const db = await resetDB();

		// Process one base at a time with a new transaction for each
		for (const base of map.keys()) {
			// First fetch all file contents
			const [codeTxt, metaTxt, mdTxt] = await Promise.all([
				zip.file(`${base}.py`)!.async('text'),
				zip.file(`${base}.py.json`)!.async('text'),
				zip.file(`${base}.md`)!.async('text')
			]);

			// Remove first and last line from markdown
			const mdLines = mdTxt.split('\n');
			const trimmedMd =
				mdLines.length > 2 ? mdLines.slice(1, mdLines.length - 1).join('\n') : mdTxt;

			// Then create a new transaction and immediately use it
			const tx = db.transaction(['pythonCode', 'pythonMeta', 'markdown', 'stateComparison'], 'readwrite');

			tx.objectStore('pythonCode').put({ base, code: codeTxt } as PythonCode);
			tx.objectStore('pythonMeta').put({ base, meta: JSON.parse(metaTxt) } as PythonMeta);
			tx.objectStore('markdown').put({ base, md: trimmedMd } as Markdown);
			tx.objectStore('stateComparison').put({ base, state: 'not-compared' } as stateComparison);
			// Wait for this transaction to complete before moving to the next base
			await new Promise((resolve, reject) => {
				tx.oncomplete = () => resolve(undefined);
				tx.onerror = () => reject(tx.error);
			});
		}
	}

	// Delete and recreate the PIBIC DB
	function resetDB(): Promise<IDBDatabase> {
		const name = 'PIBIC';
		return new Promise((resolve, reject) => {
			const delReq = indexedDB.deleteDatabase(name);
			delReq.onerror = () => reject(delReq.error);
			delReq.onsuccess = () => {
				const openReq = indexedDB.open(name, 1);
				openReq.onupgradeneeded = () => {
					const db = openReq.result;
					db.createObjectStore('pythonCode', { keyPath: 'base' });
					db.createObjectStore('pythonMeta', { keyPath: 'base' });
					db.createObjectStore('markdown', { keyPath: 'base' });
					db.createObjectStore('stateComparison', { keyPath: 'base' });
				};
				openReq.onsuccess = () => resolve(openReq.result);
				openReq.onerror = () => reject(openReq.error);
			};
		});
	}

	// Drag & drop and file picker handlers
	function openFilePicker(): void {
		fileInput.click();
	}

	function onFileSelected(e: Event): void {
		const files = (e.target as HTMLInputElement).files;
		if (files?.length) handleZip(files[0]);
	}

	function onDragOver(e: DragEvent): void {
		e.preventDefault();
		uploadArea.classList.add('drag-over');
	}

	function onDragLeave(): void {
		uploadArea.classList.remove('drag-over');
	}

	function onDrop(e: DragEvent): void {
		e.preventDefault();
		const files = e.dataTransfer?.files;
		if (files?.length) handleZip(files[0]);
	}
	function onKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openFilePicker();
		}
	}
</script>

<div
	bind:this={uploadArea}
	class="upload-area"
	role="button"
	tabindex="0"
	onclick={openFilePicker}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
	onkeydown={onKeyDown}
>
	{#if loading}
		<p>Carregando…</p>
	{:else}
		<p>Drag and drop zip file,<br />or click here to select file</p>
	{/if}
	<input bind:this={fileInput} class="hidden" type="file" accept=".zip" onchange={onFileSelected} />
</div>

{#if error}
	<p class="message error">{error}</p>
{:else if success}
	<p class="message success">Upload e inicialização concluídos!</p>
{/if}

<style>
	.upload-area {
		border: 2px dashed #aaa;
		border-radius: 8px;
		padding: 2rem;
		text-align: center;
		cursor: pointer;
		transition: border-color 0.2s;
	}

	.hidden {
		display: none;
	}
	.message {
		margin-top: 1rem;
		font-weight: bold;
	}
	.error {
		color: crimson;
	}
	.success {
		color: green;
	}
</style>
