<script lang="ts">
	import { onMount } from 'svelte';
	import Pager from '$lib/components/Pager.svelte';
	import CodeHighlighter from '$lib/components/CodeHighlighter.svelte';
	import PanZoomMermaid from '$lib/components/PanZoomMermaid.svelte';
	import type { FilterOptions } from '$lib/types/filterOptions';
	import FilterButtons from '$lib/components/FilterButtons.svelte';
	import FileNameDisplay from '$lib/components/FileNameDisplay.svelte';
	import ComparisonStatusButtons from '$lib/components/ComparisonStatusButtons.svelte';
	import { goto } from '$app/navigation';
	type ComparisonStatus = Exclude<FilterOptions, 'all'>;
	let csvImportInput: HTMLInputElement;
	let allItems: Array<{
		base: string;
		code: string;
		meta: any;
		md: string;
		state: ComparisonStatus;
		comment?: string; // Add comment field
	}> = $state([]);

	let loading = $state(true);
	let error = $state('');
	let page = $state(1);
	let currentFilter: FilterOptions = $state('all');
	let filteredItems = $derived(
		allItems.filter((item) => {
			if (currentFilter === 'all') {
				return true; // Show all items
			}
			// Ensure item.state exists and matches the filter
			// Treat 'not-compared' from data as a valid state for filtering
			return item.state && item.state === currentFilter;
		})
	);
	let totalPages = $derived(filteredItems.length);
	let current = $derived(filteredItems[page - 1] ?? null);
	let previousState: ComparisonStatus | null = $state(null);
	let previousBase: string | null = $state(null);
	// Remove currentComments state
	// let currentComments: Comment[] = $state([]); // State for current item's comments
	let currentComment = $state(''); // State for the single comment string

	$effect(() => {
		// This code runs whenever currentFilter changes
		page = 1;
		console.log('Filter changed, page reset to 1. New filter:', currentFilter);
	});

	$effect(() => {
		if (current) {
			// Update previous state and load comment when item changes or on initial load
			if (current.base !== previousBase) {
				previousBase = current.base;
				previousState = current.state;
				currentComment = current.comment || ''; // Load comment for the current item
				// Remove fetchComments call
				// fetchComments(current.base); // Fetch comments when item changes
			} else {
				// Item is the same, check if state changed from the previous known state
				if (current.state !== previousState) {
					console.log('State changed via UI binding, attempting DB update...');
					updateItemState(current.base, current.state);
					previousState = current.state; // Update previous state after successful save attempt
				}
			}
		} else {
			// Reset when there's no current item
			previousBase = null;
			previousState = null;
			currentComment = ''; // Clear comment when no item is selected
			// Remove currentComments reset
			// currentComments = []; // Clear comments when no item is selected
		}
	});

	async function updateItemState(base: string, newState: ComparisonStatus) {
		console.log(`Updating state for ${base} to ${newState}`);
		try {
			const db = await openDB();
			// Only need 'stateComparison' store for this transaction
			const tx = db.transaction('stateComparison', 'readwrite');
			const store = tx.objectStore('stateComparison');
			await requestToPromise(store.put({ base: base, state: newState }));
			await transactionComplete(tx); // Ensure transaction completes

			// Update the local state to reflect the change immediately
			const itemIndex = allItems.findIndex((item) => item.base === base);
			if (itemIndex !== -1) {
				allItems[itemIndex].state = newState;
			}
			console.log(`State updated successfully for ${base}`);
		} catch (e: any) {
			console.error('Failed to update state in DB:', e);
			error = `Failed to save status change: ${e.message}`;
		}
	}

	// Function to save the comment to IndexedDB
	async function saveComment(base: string, comment: string) {
		console.log(`Saving comment for ${base}`);
		try {
			const db = await openDB();
			const tx = db.transaction('comments', 'readwrite');
			const store = tx.objectStore('comments');
			await requestToPromise(store.put({ base, comment }));
			await transactionComplete(tx);

			// Update local state as well
			const itemIndex = allItems.findIndex((item) => item.base === base);
			if (itemIndex !== -1) {
				allItems[itemIndex].comment = comment;
			}
			console.log(`Comment saved successfully for ${base}`);
		} catch (e: any) {
			console.error('Failed to save comment:', e);
			error = `Failed to save comment: ${e.message}`;
			// Optionally revert local comment state if save fails
			// currentComment = allItems.find(item => item.base === base)?.comment || '';
		}
	}

	async function openDB(): Promise<IDBDatabase> {
		return new Promise((res, rej) => {
			const req = indexedDB.open('PIBIC', 1); // Version remains 1, upgrade handled below
			req.onerror = () => rej(req.error);
			req.onsuccess = () => res(req.result);
			// Add onupgradeneeded to handle creation of the new store if DB exists but is older version (or first time)
			req.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				// Check if stores exist before creating
				if (!db.objectStoreNames.contains('pythonCode')) {
					db.createObjectStore('pythonCode', { keyPath: 'base' });
				}
				if (!db.objectStoreNames.contains('pythonMeta')) {
					db.createObjectStore('pythonMeta', { keyPath: 'base' });
				}
				if (!db.objectStoreNames.contains('markdown')) {
					db.createObjectStore('markdown', { keyPath: 'base' });
				}
				if (!db.objectStoreNames.contains('stateComparison')) {
					db.createObjectStore('stateComparison', { keyPath: 'base' });
				}
				if (!db.objectStoreNames.contains('comments')) {
					db.createObjectStore('comments', { keyPath: 'base' }); // Create comments store
				}
			};
		});
	}

	// Helper to convert IDBRequest to Promise
	function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}
	function transactionComplete(tx: IDBTransaction): Promise<void> {
		return new Promise((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
		});
	}
	function sendAnotherZip() {
		goto('/'); // Navigate to the root page
	}

	// Function to trigger CSV export
	async function exportCsv() {
		error = ''; // Clear previous errors
		try {
			const db = await openDB();
			const tx = db.transaction(['stateComparison', 'comments'], 'readonly');
			const [states, commentsData] = await Promise.all([
				requestToPromise(tx.objectStore('stateComparison').getAll()),
				requestToPromise(tx.objectStore('comments').getAll())
			]);
			await transactionComplete(tx);

			const stateMap = new Map(states.map((s) => [s.base, s.state]));
			const commentMap = new Map(commentsData.map((c) => [c.base, c.comment]));
			const allBases = new Set([...stateMap.keys(), ...commentMap.keys()]);

			let csvContent = 'base,state,comment\n';
			for (const base of allBases) {
				const state = stateMap.get(base) || 'not-compared'; // Default state if missing
				const comment = commentMap.get(base) || '';
				// Escape commas and quotes in comment
				const escapedComment = `"${comment.replace(/"/g, '""')}"`;
				csvContent += `${base},${state},${escapedComment}\n`;
			}

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

	// Function to trigger the hidden file input
	function triggerCsvImport() {
		error = ''; // Clear previous errors
		csvImportInput.click();
	}

	// Function to handle the selected CSV file
	async function handleCsvImport(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) {
			return;
		}
		const file = input.files[0];
		input.value = ''; // Reset input for same-file selection

		if (!file.name.endsWith('.csv')) {
			error = 'Por favor selecione um arquivo CSV.';
			return;
		}

		loading = true; // Show loading indicator
		error = '';

		try {
			const fileContent = await file.text();
			const lines = fileContent.split('\n').map((line) => line.trim());

			if (lines.length < 2 || lines[0].toLowerCase() !== 'base,state,comment') {
				throw new Error('CSV inválido. Cabeçalho esperado: base,state,comment');
			}

			const db = await openDB();
			// Use separate transactions for safety or a single one if atomicity is crucial
			const stateTx = db.transaction('stateComparison', 'readwrite');
			const commentTx = db.transaction('comments', 'readwrite');
			const stateStore = stateTx.objectStore('stateComparison');
			const commentStore = commentTx.objectStore('comments');

			const updatePromises: Promise<any>[] = [];

			const validStates: Set<ComparisonStatus> = new Set(['not-compared', 'equal', 'different']);

			for (let i = 1; i < lines.length; i++) {
				if (!lines[i]) continue; // Skip empty lines

				// Basic CSV parsing (assumes commas only as delimiters, quoted comments)
				const parts = lines[i].split(',');
				if (parts.length < 2) {
					console.warn(`Skipping invalid line ${i + 1}: ${lines[i]}`);
					continue;
				}
				const base = parts[0].trim();
				const state = parts[1].trim() as ComparisonStatus;
				// Join remaining parts for comment, remove surrounding quotes if present
				let comment = parts.slice(2).join(',');
				if (comment.startsWith('"') && comment.endsWith('"')) {
					comment = comment.substring(1, comment.length - 1);
				}
				// Unescape double quotes
				comment = comment.replace(/""/g, '"');

				if (!base) {
					console.warn(`Skipping line ${i + 1} due to missing base.`);
					continue;
				}

				// Validate state
				if (!validStates.has(state)) {
					console.warn(`Skipping line ${i + 1} due to invalid state: ${state}`);
					continue; // Skip if state is not valid
				}

				// Check if base exists in the current items (optional, but good practice)
				const existingItem = allItems.find((item) => item.base === base);
				if (!existingItem) {
					console.warn(`Skipping line ${i + 1} as base "${base}" not found in current dataset.`);
					continue;
				}

				// Add update operations to promises
				updatePromises.push(requestToPromise(stateStore.put({ base, state })));
				updatePromises.push(requestToPromise(commentStore.put({ base, comment })));
			}

			// Wait for all DB updates and transactions to complete
			await Promise.all(updatePromises);
			await Promise.all([transactionComplete(stateTx), transactionComplete(commentTx)]);

			// Refresh data from DB to show changes
			await refreshAllItems();
			console.log('CSV importado com sucesso.');
		} catch (e: any) {
			console.error('Falha ao importar CSV:', e);
			error = `Falha ao importar CSV: ${e.message}`;
		} finally {
			loading = false;
		}
	}

	// Helper function to reload all items from DB
	async function refreshAllItems() {
		try {
			const db = await openDB();
			const tx = db.transaction(
				['pythonCode', 'pythonMeta', 'markdown', 'stateComparison', 'comments'],
				'readonly'
			);
			const [codes, metas, mds, states, commentsData] = await Promise.all([
				requestToPromise(tx.objectStore('pythonCode').getAll()),
				requestToPromise(tx.objectStore('pythonMeta').getAll()),
				requestToPromise(tx.objectStore('markdown').getAll()),
				requestToPromise(tx.objectStore('stateComparison').getAll()),
				requestToPromise(tx.objectStore('comments').getAll())
			]);
			await transactionComplete(tx);

			const map = new Map<string, any>();
			for (const c of codes) map.set(c.base, { base: c.base, code: c.code });
			for (const m of metas) map.get(m.base).meta = m.meta;
			for (const m of mds) map.get(m.base).md = m.md;
			for (const s of states) map.get(s.base).state = s.state;
			for (const c of commentsData) {
				if (map.has(c.base)) {
					map.get(c.base).comment = c.comment;
				}
			}
			allItems = Array.from(map.values());
			// Reset current item based on refreshed data and current page/filter
			page = 1; // Reset page after import/refresh
			// current derived state will update automatically
		} catch (e: any) {
			error = `Failed to refresh data: ${e.message}`;
		}
	}

	onMount(async () => {
		loading = true;
		await refreshAllItems(); // Use the refresh function on mount
		loading = false;
	});
</script>

{#if loading}
	<p>Carregando arquivos…</p>
{:else if error}
	<p class="error">{error}</p>
{:else if allItems.length > 0}
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
	<FilterButtons bind:selectedFilter={currentFilter} />

	{#if filteredItems.length > 0}
		<Pager
			{page}
			{totalPages}
			onPrev={page > 1 ? () => page-- : null}
			onNext={page < totalPages ? () => page++ : null}
		/>

		{#if current}
			<div class="main-content-grid">
				<!-- Moved Controls Section to the top -->
				<div class="controls-section">
					<!-- Inner Left Column -->
					<div class="controls-left">
						<FileNameDisplay fileName={current.base} />
						<!-- Replace CommentSection with a textarea -->
						<textarea
							class="comment-textarea"
							bind:value={currentComment}
							onblur={() => saveComment(current.base, currentComment)}
							placeholder="Adicione seu comentário aqui..."
							rows="4"
						></textarea>
						<!-- Removed CommentSection -->
						<!-- <CommentSection on:submit={handleCommentSubmit} /> -->
					</div>
					<!-- Inner Right Column -->
					<div class="controls-right">
						<ComparisonStatusButtons bind:selectedStatus={current.state} />
					</div>
				</div>

				<!-- Code Section (now second item) -->
				<div class="code-section">
					<CodeHighlighter code={current.code} />
				</div>

				<!-- Diagram Section (now third item) -->
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
	/* ... existing styles ... */
	.error {
		color: crimson;
	}

	.main-content-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1rem;
		align-items: start;
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

	/* Add style for the textarea */
	.comment-textarea {
		width: 100%; /* Take full width of its container */
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-family: inherit; /* Use the same font as the rest of the page */
		font-size: 1rem;
		box-sizing: border-box; /* Include padding and border in the element's total width and height */
		resize: vertical; /* Allow vertical resizing */
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
</style>
