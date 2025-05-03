<!-- filepath: src/routes/files/+page.svelte -->
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
	// Import DB functions and types
	import {
		updateState as dbUpdateState,
		updateComment as dbUpdateComment,
		getAllCombinedItems,
		getAllStates,
		getAllComments,
		type CombinedItem,
		openDB, // Still needed for direct transaction in import/export
		requestToPromise, // Still needed for direct transaction in import/export
		transactionComplete, // Still needed for direct transaction in import/export
		STORE_NAMES // Still needed for direct transaction in import/export
	} from '$lib/db';

	type ComparisonStatus = Exclude<FilterOptions, 'all'>;
	let csvImportInput: HTMLInputElement;
	let allItems: CombinedItem[] = $state([]); // Use CombinedItem type

	let loading = $state(true);
	let error = $state('');
	let page = $state(1);
	let currentFilter: FilterOptions = $state('all');
	let filteredItems = $derived(
		allItems.filter((item) => {
			if (currentFilter === 'all') {
				return true;
			}
			return item.state === currentFilter;
		})
	);
	let totalPages = $derived(filteredItems.length);
	let current = $derived(filteredItems[page - 1] ?? null);
	let previousState: ComparisonStatus | null = $state(null);
	let previousBase: string | null = $state(null);
	let currentComment = $state('');

	$effect(() => {
		page = 1;
		console.log('Filter changed, page reset to 1. New filter:', currentFilter);
	});

	function handleStatusChange(event: CustomEvent<ComparisonStatus>) {
		const newStatus = event.detail;
		if (current && current.state !== newStatus) {
			console.log(`Status change requested for ${current.base} to ${newStatus}`);
			const itemIndex = allItems.findIndex((item) => item.base === current.base);
			if (itemIndex !== -1) {
				// Update local state directly (runes handle reactivity)
				allItems[itemIndex].state = newStatus;
				// The $effect below will detect the change in `current.state` and trigger DB update
			} else {
				console.error('Current item not found in allItems during status change');
			}
		}
	}

	$effect(() => {
		if (current) {
			if (current.base !== previousBase) {
				console.log('Item changed. Base:', current.base);
				previousBase = current.base;
				previousState = current.state;
				currentComment = current.comment || ''; // Load comment for new item
			} else {
				// Item is the same, check if state changed
				if (current.state !== previousState) {
					console.log('State changed (detected by effect), attempting DB update...');
					updateItemState(current.base, current.state); // Call DB update function
					previousState = current.state; // Update previous state after successful save attempt
				}
			}
		} else {
			previousBase = null;
			previousState = null;
			currentComment = '';
		}
	});

	// Use the imported DB function
	async function updateItemState(base: string, newState: ComparisonStatus) {
		console.log(`Updating state for ${base} to ${newState}`);
		try {
			await dbUpdateState(base, newState); // Use imported function
			console.log(`State updated successfully for ${base}`);
			// No need to update local state here, it was updated in handleStatusChange
		} catch (e: any) {
			console.error('Failed to update state in DB:', e);
			error = `Failed to save status change: ${e.message}`;
			// Optionally revert local state if DB update fails
			// refreshAllItems(); // Or find and revert the specific item
		}
	}

	// Use the imported DB function
	async function saveComment(base: string, comment: string) {
		console.log(`Saving comment for ${base}`);
		try {
			await dbUpdateComment(base, comment); // Use imported function

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

	// Removed local openDB, requestToPromise, transactionComplete

	function sendAnotherZip() {
		goto('/');
	}

	// Use imported DB functions for export
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
		csvImportInput.click();
	}

	// Use imported DB functions for import (still needs direct transaction for bulk)
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

	// Use the combined fetch function
	async function refreshAllItems() {
		console.log('Refreshing all items from DB...');
		try {
			allItems = await getAllCombinedItems(); // Use the new function
			page = 1; // Reset page after refresh
			console.log(`Refreshed ${allItems.length} items.`);
		} catch (e: any) {
			error = `Failed to refresh data: ${e.message}`;
			console.error('Error during refreshAllItems:', e);
			allItems = []; // Clear items on error
		}
	}

	onMount(async () => {
		loading = true;
		await refreshAllItems();
		loading = false;
	});
</script>

<!-- HTML structure remains the same -->
{#if loading}
	<p>Carregando arquivos…</p>
{:else if error}
	<p class="error">{error}</p>
{:else if allItems.length > 0}
	<div class="top-controls-wrapper">
		<FilterButtons bind:selectedFilter={currentFilter} />
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
			onPrev={page > 1 ? () => page-- : null}
			onNext={page < totalPages ? () => page++ : null}
		/>

		{#if current}
			<div class="main-content-grid">
				<div class="controls-section">
					<div class="controls-left">
						<FileNameDisplay fileName={current.base} />
						<textarea
							class="comment-textarea"
							bind:value={currentComment}
							onblur={() => saveComment(current.base, currentComment)}
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

<!-- Styles remain the same -->
<style>
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
	.top-controls-wrapper {
		display: flex;
		justify-content: space-between; /* Pushes items to ends */
		align-items: center; /* Vertically align items */
		margin-bottom: 1rem; /* Keep the margin */
		flex-wrap: wrap; /* Allow wrapping on smaller screens */
		gap: 1rem; /* Add gap between filter and action buttons if they wrap */
	}
	.action-buttons {
		display: flex; /* Keep buttons in a row */
		gap: 1rem; /* Space between action buttons */
		flex-wrap: wrap; /* Allow action buttons themselves to wrap */
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
