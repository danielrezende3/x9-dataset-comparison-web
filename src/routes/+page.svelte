<script lang="ts">
	import { goto } from '$app/navigation';
	import JSZip from 'jszip';
	// Importação de funções do banco de dados
	import { resetDB, transactionComplete, openDB, STORE_NAMES } from '$lib/db';

	// Referências a elementos do DOM
	let uploadArea: HTMLElement;
	let fileInput: HTMLInputElement;

	// Estados reativos
	let error = $state<string>('');
	let loading = $state(false);
	let success = $state(false);
	let loadingMessage = $state('Carregando...');
	let selectedFileName = $state<string | null>(null);

	/**
	 * handleZip: processa o arquivo ZIP enviado pelo usuário.
	 */
	async function handleZip(file: File): Promise<void> {
		resetState();
		selectedFileName = file.name;

		try {
			validateFile(file);
			loading = true;
			loadingMessage = 'Validando arquivo...';

			if (!confirm(`Uploading "${file.name}" will replace all existing data. Continue?`)) {
				resetState();
				return;
			}

			loadingMessage = 'Limpando dados antigos...';
			await resetDB();

			loadingMessage = 'Lendo arquivo ZIP...';
			const zip = await JSZip.loadAsync(file);
			const entries = getFileEntries(zip);

			loadingMessage = 'Verificando estrutura do ZIP...';
			const invalidFiles = entries.filter((name) => !/^(.*)\.(py\.json|py\.py|py|md)$/.test(name));
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

			loadingMessage = 'Armazenando dados...';
			await storeZipContents(map, zip);

			success = true;
			loadingMessage = 'Carregamento concluído!';
			await new Promise((resolve) => setTimeout(resolve, 1000));
			goto('/files');
		} catch (err: any) {
			console.error(err);
			error = err.message || 'Erro desconhecido ao processar o arquivo ZIP.';
			selectedFileName = null;
		} finally {
			loading = false;
			uploadArea?.classList.remove('drag-over');
		}
	}

	/**
	 * resetState: redefine estados de erro, sucesso e carregamento.
	 */
	function resetState(): void {
		error = '';
		success = false;
		loading = false;
		selectedFileName = null;
		loadingMessage = 'Carregando...';
	}

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
				continue;
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
		return Array.from(map.entries())
			.filter(([_, exts]) => !exts.has('py') || !exts.has('py.json') || !exts.has('md'))
			.map(([base]) => base);
	}

	/**
	 * storeZipContents: armazena conteúdos do ZIP no IndexedDB.
	 */
	async function storeZipContents(map: Map<string, Set<string>>, zip: JSZip): Promise<void> {
		const db = await openDB();

		for (const base of map.keys()) {
			const [codeTxt, metaTxt, mdTxt] = await Promise.all([
				zip.file(`${base}.py`)!.async('text'),
				zip.file(`${base}.py.json`)!.async('text'),
				zip.file(`${base}.md`)!.async('text')
			]);

			const mdLines = mdTxt.split('\n');
			const trimmedMd = mdLines.length > 2 ? mdLines.slice(1, -1).join('\n') : mdTxt;

			const tx = db.transaction(Object.values(STORE_NAMES), 'readwrite');
			const codeStore = tx.objectStore(STORE_NAMES.CODE);
			const metaStore = tx.objectStore(STORE_NAMES.META);
			const mdStore = tx.objectStore(STORE_NAMES.MARKDOWN);
			const stateStore = tx.objectStore(STORE_NAMES.STATE);

			codeStore.put({ base, code: codeTxt });
			metaStore.put({ base, meta: JSON.parse(metaTxt) });
			mdStore.put({ base, md: trimmedMd });
			stateStore.put({ base, state: 'not-compared' });

			await transactionComplete(tx);
			console.log(`Stored data for base: ${base}`);
		}
	}

	/**
	 * openFilePicker: abre o seletor de arquivos.
	 */
	function openFilePicker(): void {
		fileInput.click();
	}

	/**
	 * onFileSelected: trata seleção via input de arquivo.
	 */
	function onFileSelected(e: Event): void {
		const files = (e.target as HTMLInputElement).files;
		if (files?.length) handleZip(files[0]);
	}

	/**
	 * onDragOver: aplica estilo durante arraste sobre área.
	 */
	function onDragOver(e: DragEvent): void {
		e.preventDefault();
		uploadArea.classList.add('drag-over');
	}

	/**
	 * onDragLeave: remove estilo após arraste sair da área.
	 */
	function onDragLeave(): void {
		uploadArea.classList.remove('drag-over');
	}

	/**
	 * onDrop: trata arquivo largado na área.
	 */
	function onDrop(e: DragEvent): void {
		e.preventDefault();
		const files = e.dataTransfer?.files;
		if (files?.length) handleZip(files[0]);
	}

	/**
	 * onKeyDown: abre seletor ao pressionar Enter ou Espaço.
	 */
	function onKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openFilePicker();
		}
	}
</script>

<p>
	Faça upload de um arquivo ZIP contendo os arquivos .py, .py.json e .md para cada item a ser
	comparado.
</p>
<p>Se você já fez o upload pro banco, <a href="/files">clique aqui</a></p>
<div
	bind:this={uploadArea}
	class="upload-area"
	role="button"
	tabindex="0"
	aria-describedby="upload-instructions"
	onclick={openFilePicker}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
	onkeydown={onKeyDown}
>
	{#if loading}
		<p>{loadingMessage}</p>
		<!-- Optional: Add a spinner SVG or component here -->
	{:else if selectedFileName}
		<p>Arquivo selecionado: <strong>{selectedFileName}</strong></p>
		<p>Arraste outro arquivo ou clique para substituir.</p>
	{:else}
		<p id="upload-instructions">
			Arraste e solte o arquivo ZIP aqui,<br />ou clique para selecionar.
		</p>
	{/if}
	<input bind:this={fileInput} class="hidden" type="file" accept=".zip" onchange={onFileSelected} />
</div>

<!-- Add aria-live for feedback messages -->
{#if error}
	<p class="message error" role="alert">{error}</p>
{:else if success && !loading}
	<!-- Show success only briefly before redirect -->
	<p class="message success" role="status">{loadingMessage}</p>
{/if}

<!-- Style remains the same -->
<style>
	.upload-area {
		border: 2px dashed #aaa;
		border-radius: 8px;
		padding: 2rem;
		text-align: center;
		cursor: pointer;
		transition: border-color 0.2s;
	}
	.upload-area p {
		/* Add some margin between lines if needed */
		margin-bottom: 0.5rem;
	}
	.upload-area p:last-child {
		margin-bottom: 0;
	}
	strong {
		font-weight: bold;
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
