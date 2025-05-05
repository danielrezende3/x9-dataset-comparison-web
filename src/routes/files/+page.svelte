<script lang="ts">
	// Svelte lifecycle & navigation
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// Components
	import Pager from '$lib/components/Pager.svelte';
	import CodeHighlighter from '$lib/components/CodeHighlighter.svelte';
	import PanZoomMermaid from '$lib/components/PanZoomMermaid.svelte';
	import FilterButtons from '$lib/components/FilterButtons.svelte';
	import FileNameDisplay from '$lib/components/FileNameDisplay.svelte';
	import ComparisonStatusButtons from '$lib/components/ComparisonStatusButtons.svelte';

	// Types
	import type { FilterOptions } from '$lib/types/filterOptions';
	import type { CombinedItem } from '$lib/db';

	// IndexedDB helpers
	import {
		updateState as dbUpdateState,
		updateComment as dbUpdateComment,
		getAllCombinedItems,
		getAllStates,
		getAllComments,
		openDB,
		requestToPromise,
		transactionComplete,
		STORE_NAMES
	} from '$lib/db';

	// Aliases
	type ComparisonStatus = Exclude<FilterOptions, 'all'>;

	// Local state
	let csvImportInput: HTMLInputElement | null = $state(null);
	let allItems: CombinedItem[] = $state([]);

	let loading = $state(true);
	let error = $state('');

	let page = $state(1);
	let currentFilter: FilterOptions = $state('all');
	let currentComment = $state('');
	let nameFilter: string = $state('');
	let selectedTag = $state('');

	let previousState: ComparisonStatus | null = $state(null);
	let previousBase: string | null = $state(null);

	// Derived state
	let filteredItems = $derived(
		allItems
			.filter((item) => currentFilter === 'all' || item.state === currentFilter)
			.filter((item) => !nameFilter || item.base.includes(nameFilter))
			.filter((item) => {
				if (!selectedTag) return true;
				const re = new RegExp(`#${selectedTag}`, 'g');
				return item.comment.match(re);
			})
	);
	let totalPages = $derived(filteredItems.length);
	let current = $derived(filteredItems[page - 1] ?? null);
	let allTags = $derived.by(() => {
		const set = new Set<string>();
		const re = /#([\w-]+)/g;
		for (const item of allItems) {
			const text = item.comment;
			let match: RegExpExecArray | null;
			while ((match = re.exec(text))) {
				set.add(match[1]);
			}
		}
		return Array.from(set);
	});
	// Effects
	$effect(() => {
		page = 1;
		console.log('Filter changed, resetting page to 1:', currentFilter);
	});

	$effect(() => {
		if (!current) {
			previousBase = null;
			previousState = null;
			currentComment = '';
			return;
		}

		if (current.base !== previousBase) {
			previousBase = current.base;
			previousState = current.state;
			currentComment = current.comment || '';
			console.log('Loaded new item:', current.base);
		} else if (current.state !== previousState) {
			console.log('State changed for', current.base, 'to', current.state);
			updateItemState(current.base, current.state);
			previousState = current.state;
		}
	});

	// Handlers
	function filterByTag(tag: string) {
		selectedTag = tag;
	}
	function handleStatusChange(event: CustomEvent<ComparisonStatus>) {
		const newStatus = event.detail;
		if (!current || current.state === newStatus) return;

		const idx = allItems.findIndex((item) => item.base === current.base);
		if (idx === -1) {
			console.error('Item not found during status change');
			return;
		}

		allItems[idx].state = newStatus;
	}

	async function updateItemState(base: string, newState: ComparisonStatus) {
		try {
			await dbUpdateState(base, newState);
			console.log(`State updated for ${base}`);
		} catch (e: any) {
			console.error('DB update failed:', e);
			error = `Failed to save status: ${e.message}`;
		}
	}

	async function saveComment(base: string, comment: string) {
		try {
			await dbUpdateComment(base, comment);
			const idx = allItems.findIndex((item) => item.base === base);
			if (idx > -1) allItems[idx].comment = comment;
			console.log(`Comment saved for ${base}`);
		} catch (e: any) {
			console.error('Comment save failed:', e);
			error = `Failed to save comment: ${e.message}`;
		}
	}

	const debouncedSaveComment = debounce(saveComment, 500);
	function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
		let timeout: number;
		return (...args: Parameters<T>) => {
			clearTimeout(timeout);
			timeout = window.setTimeout(() => func(...args), wait);
		};
	}

	// CSV export/import
	async function exportCsv() {
		error = '';
		try {
			// Fetch data using specific functions
			const [states, commentsData] = await Promise.all([getAllStates(), getAllComments()]);

			const stateMap = new Map(states.map((s) => [s.base, s.state]));
			const commentMap = new Map(commentsData.map((c) => [c.base, c.comment]));
			const allBases = new Set([...stateMap.keys(), ...commentMap.keys()]);

			let csvContent = 'base,state,comment\n';
			for (const base of allBases) {
				const state = stateMap.get(base) || 'not-compared';
				const comment = commentMap.get(base) || '';
				const escapedComment = `"${comment.replace(/"/g, '""')}"`;
				csvContent += `${base},${state},${escapedComment}\n`;
			}

			// Blob creation and download logic remains the same
			const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
			const link = document.createElement('a');
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);
			link.setAttribute('download', 'pibic_export.csv');
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		} catch (e: any) {
			console.error('Failed to export CSV:', e);
			error = `Failed to export CSV: ${e.message}`;
		}
	}

	function triggerCsvImport() {
		error = '';
		csvImportInput?.click();
	}

	async function handleCsvImport(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;
		const file = input.files[0];
		input.value = '';

		if (!file.name.endsWith('.csv')) {
			error = 'Por favor selecione um arquivo CSV.';
			return;
		}

		loading = true;
		error = '';

		try {
			const fileContent = await file.text();
			const lines = fileContent.split('\n').map((line) => line.trim());

			if (lines.length < 2 || lines[0].toLowerCase() !== 'base,state,comment') {
				throw new Error('CSV inválido. Cabeçalho esperado: base,state,comment');
			}

			const db = await openDB();
			// Use a single transaction for atomicity during import
			const tx = db.transaction([STORE_NAMES.STATE, STORE_NAMES.COMMENTS], 'readwrite');
			const stateStore = tx.objectStore(STORE_NAMES.STATE);
			const commentStore = tx.objectStore(STORE_NAMES.COMMENTS);

			const updatePromises: Promise<any>[] = [];
			const validStates: Set<ComparisonStatus> = new Set(['not-compared', 'equal', 'different']);

			// Fetch current bases to validate against
			const currentBases = new Set(allItems.map((item) => item.base));

			for (let i = 1; i < lines.length; i++) {
				if (!lines[i]) continue;

				const parts = lines[i].split(',');
				if (parts.length < 2) {
					console.warn(`Skipping invalid line ${i + 1}: ${lines[i]}`);
					continue;
				}
				const base = parts[0].trim();
				const state = parts[1].trim() as ComparisonStatus;
				let comment = parts.slice(2).join(',');
				if (comment.startsWith('"') && comment.endsWith('"')) {
					comment = comment.substring(1, comment.length - 1);
				}
				comment = comment.replace(/""/g, '"');

				if (!base) {
					console.warn(`Skipping line ${i + 1} due to missing base.`);
					continue;
				}
				if (!validStates.has(state)) {
					console.warn(`Skipping line ${i + 1} due to invalid state: ${state}`);
					continue;
				}
				// Check if base exists in the current dataset loaded from the zip
				if (!currentBases.has(base)) {
					console.warn(`Skipping line ${i + 1} as base "${base}" not found in current dataset.`);
					continue;
				}

				// Add put operations to the transaction (don't await individually)
				updatePromises.push(requestToPromise(stateStore.put({ base, state })));
				updatePromises.push(requestToPromise(commentStore.put({ base, comment })));
			}

			// Wait for all puts within the transaction
			await Promise.all(updatePromises);
			// Wait for the transaction itself to complete
			await transactionComplete(tx);

			await refreshAllItems(); // Refresh data from DB
			console.log('CSV importado com sucesso.');
		} catch (e: any) {
			console.error('Falha ao importar CSV:', e);
			error = `Falha ao importar CSV: ${e.message}`;
		} finally {
			loading = false;
		}
	}

	// Refresh items
	async function refreshAllItems() {
		try {
			allItems = await getAllCombinedItems();
			page = 1;
		} catch (e: any) {
			error = `Data refresh failed: ${e.message}`;
			allItems = [];
		}
	}

	// Navigation
	function sendAnotherZip() {
		goto('/');
	}

	// Initialization
	onMount(async () => {
		loading = true;
		await refreshAllItems();
		loading = false;
	});
</script>

{#if loading}
	<p>Carregando arquivos…</p>
{:else if error}
	<p class="error">{error}</p>
{:else if allItems.length > 0}
	<div class="top-controls-wrapper">
		<FilterButtons bind:selectedFilter={currentFilter} />

		<div>
			<strong>Filtrar por tag: </strong>
			<select bind:value={selectedTag} onchange={() => filterByTag(selectedTag)}>
				<option value="">— Todos —</option>
				{#each allTags as tag}
					<option value={tag}>#{tag}</option>
				{/each}
			</select>
		</div>

		<div class="action-buttons">
			<button onclick={sendAnotherZip}>Enviar outro zip</button>
			<button onclick={exportCsv}>Exportar csv</button>
			<button onclick={triggerCsvImport}>Importar csv</button>
			<input
				type="file"
				accept=".csv"
				bind:this={csvImportInput}
				onchange={handleCsvImport}
				style="display: none;"
			/>
		</div>
	</div>

	{#if filteredItems.length > 0}
		<Pager
			{page}
			{totalPages}
			onPrev={totalPages > 0 ? () => (page = page > 1 ? page - 1 : totalPages) : null}
			onNext={totalPages > 0 ? () => (page = page < totalPages ? page + 1 : 1) : null}
		/>

		{#if current}
			<div class="main-content-grid">
				<div class="controls-section">
					<div class="controls-left">
						<FileNameDisplay fileName={current.base} bind:filter={nameFilter} />

						<textarea
							class="comment-textarea"
							bind:value={currentComment}
							oninput={() => current && debouncedSaveComment(current.base, currentComment)}
							placeholder="Adicione seu comentário aqui..."
							rows="4"
						></textarea>
					</div>
					<div class="controls-right">
						<ComparisonStatusButtons
							selectedStatus={current.state}
							on:changeStatus={handleStatusChange}
						/>
					</div>
				</div>

				<div class="code-section">
					<CodeHighlighter code={current.code} />
				</div>

				<div class="diagram-section">
					<PanZoomMermaid diagram={current.md} />
				</div>
			</div>
		{/if}
	{:else}
		<p>Nenhum item corresponde ao filtro selecionado.</p>
	{/if}
{:else}
	<p>Nenhum item para exibir.</p>
{/if}

<style>
	:global(html) {
		scrollbar-gutter: stable;
	}
	:root {
		--button-padding: 0.5rem 1rem;
		--button-border: 1px solid #ccc;
		--button-radius: 4px;
		--button-bg: #f0f0f0;
		--button-bg-hover: #e0e0e0;
		--button-text-color: #333;
		--button-font-size: 0.9rem;
		--button-cursor: pointer;
		--button-cursor-disabled: not-allowed;
		--button-opacity-disabled: 0.6;
	}
	.error {
		color: crimson;
	}

	.main-content-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1rem;
	}

	.controls-section {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1rem;
		align-items: start;
		min-width: 0;
		margin-bottom: 1rem;
	}

	.code-section {
		grid-column: 1 / 2;
		min-width: 0;
	}

	.diagram-section {
		grid-column: 2 / 3;
		min-width: 0;
	}

	.controls-left {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}

	.controls-right {
		min-width: 150px;
	}

	.comment-textarea {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-family: inherit;
		font-size: 1rem;
		box-sizing: border-box;
		resize: vertical;
	}

	@media (max-width: 1024px) {
		.main-content-grid {
			grid-template-columns: 1fr;
		}
		.controls-section {
			grid-column: 1 / -1;
		}
		.code-section {
			grid-column: 1 / -1;
		}
		.diagram-section {
			grid-column: 1 / -1;
		}
	}

	@media (max-width: 768px) {
		.controls-section {
			grid-template-columns: 1fr;
		}
		.controls-right {
			min-width: auto;
		}
	}
	.top-controls-wrapper {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 1rem;
	}
	.top-controls-wrapper > div:nth-of-type(1) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.top-controls-wrapper select {
		padding: var(--button-padding);
		border: var(--button-border);
		background-color: var(--button-bg);
		border-radius: var(--button-radius);
		color: var(--button-text-color);
		font-size: var(--button-font-size);
		cursor: var(--button-cursor);
		transition: background-color 0.2s;
		min-width: 150px;
	}

	.top-controls-wrapper select:hover {
		background-color: var(--button-bg-hover);
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.action-buttons button {
		padding: var(--button-padding);
		border: var(--button-border);
		background-color: var(--button-bg);
		border-radius: var(--button-radius);
		color: var(--button-text-color);
		font-size: var(--button-font-size);
		cursor: var(--button-cursor);
		transition: background-color 0.2s;
	}

	.action-buttons button:hover {
		background-color: var(--button-bg-hover);
	}

	.action-buttons button:disabled {
		cursor: var(--button-cursor-disabled);
		opacity: var(--button-opacity-disabled);
	}
</style>
