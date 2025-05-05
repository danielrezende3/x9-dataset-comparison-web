<script lang="ts">
	import { goto } from '$app/navigation';
	import { processZip } from '$lib/zipProcessor';

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
		loading = true; // Set loading true early

		try {
			// Confirmation before potentially lengthy processing
			if (!confirm(`Uploading "${file.name}" will replace all existing data. Continue?`)) {
				resetState(); // Reset if user cancels
				return;
			}

			// Pass the state update function to the processor
			await processZip(file, (message) => {
				loadingMessage = message;
			});

			// Success state handling remains in the component
			success = true;
			loadingMessage = 'Carregamento concluído!';
			await new Promise((resolve) => setTimeout(resolve, 1000)); // Keep delay for user feedback
			goto('/files');
		} catch (err: any) {
			console.error('Error during ZIP processing:', err); // Log the error
			error = err.message || 'Erro desconhecido ao processar o arquivo ZIP.';
			selectedFileName = null; // Clear selected file on error
		} finally {
			// Ensure loading is always set to false and drag-over is removed
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
		loadingMessage = 'Carregando...'; // Reset message
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
		// Avoid adding class if already loading
		if (!loading) {
			uploadArea.classList.add('drag-over');
		}
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
		uploadArea.classList.remove('drag-over'); // Ensure class is removed on drop
		if (loading) return; // Prevent drop while loading
		const files = e.dataTransfer?.files;
		if (files?.length) handleZip(files[0]);
	}

	/**
	 * onKeyDown: abre seletor ao pressionar Enter ou Espaço.
	 */
	function onKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (!loading) {
				// Prevent opening picker while loading
				openFilePicker();
			}
		}
	}
</script>

<main class="page-container">
	<h1>Comparador entre código-fonte e mermaid.</h1>
	<p>
		Faça upload de um arquivo ZIP contendo <b>apenas</b> os arquivos .py e .md para cada item a ser comparado.
	</p>
	<p>Se você já fez o upload pro banco, <a href="/files">clique aqui</a>.</p>
	<div
		bind:this={uploadArea}
		class="upload-area"
		role="button"
		tabindex={loading ? -1 : 0}
		aria-describedby="upload-instructions"
		aria-disabled={loading}
		onclick={loading ? undefined : openFilePicker}
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
		onkeydown={onKeyDown}
	>
		{#if loading}
			<p>{loadingMessage}</p>
		{:else if selectedFileName}
			<p>Arquivo selecionado: <strong>{selectedFileName}</strong></p>
			<p>Arraste outro arquivo ou clique para substituir.</p>
		{:else}
			<p id="upload-instructions">
				Arraste e solte o arquivo ZIP aqui,<br />ou clique para selecionar.
			</p>
		{/if}
		<input
			bind:this={fileInput}
			class="hidden"
			type="file"
			accept=".zip"
			onchange={onFileSelected}
			disabled={loading}
		/>
	</div>

	{#if error}
		<p class="message error" role="alert">{error}</p>
	{:else if success && !loading}
		<p class="message success" role="status">{loadingMessage}</p>
	{/if}
</main>


<style>
	.page-container {
		padding-left: 2rem;
		padding-right: 2rem; 
		max-width: 900px; 
		margin-left: auto; 
		margin-right: auto; 
	}

	.upload-area {
		border: 2px dashed #aaa;
		border-radius: 8px;
		padding: 2rem;
		text-align: center;
		cursor: pointer;
		transition:
			border-color 0.2s,
			background-color 0.2s;
	}
	.upload-area {
		border: 2px dashed #aaa;
		border-radius: 8px;
		padding: 2rem;
		text-align: center;
		cursor: pointer;
		transition:
			border-color 0.2s,
			background-color 0.2s;
	}
	.upload-area[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.7;
		background-color: #f8f8f8;
	}
	.upload-area p {
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
