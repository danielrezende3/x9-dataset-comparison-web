<script lang="ts">
	import { onMount } from 'svelte';
	import Pager from '$lib/components/Pager.svelte';
	import CodeHighlighter from '$lib/components/CodeHighlighter.svelte';
	import PanZoomMermaid from '$lib/components/PanZoomMermaid.svelte';
	import type { FilterOptions } from '$lib/types/filterOptions';
	import FilterButtons from '$lib/components/FilterButtons.svelte';
	import FileNameDisplay from '$lib/components/FileNameDisplay.svelte';
	import ComparisonStatusButtons from '$lib/components/ComparisonStatusButtons.svelte';
	import CommentSection from '$lib/components/CommentSection.svelte';
	type Comment = { id: number; base: string; comment: string; timestamp: Date };
	type ComparisonStatus = Exclude<FilterOptions, 'all'>;
	let allItems: Array<{
		base: string;
		code: string;
		meta: any;
		md: string;
		state: ComparisonStatus;
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
	let currentComments: Comment[] = $state([]); // State for current item's comments
	$effect(() => {
		// This code runs whenever currentFilter changes
		page = 1;
		console.log('Filter changed, page reset to 1. New filter:', currentFilter);
	});

	$effect(() => {
		if (current) {
			// Update previous state when item changes or on initial load
			if (current.base !== previousBase) {
				previousBase = current.base;
				previousState = current.state;
				fetchComments(current.base); // Fetch comments when item changes
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
			currentComments = []; // Clear comments when no item is selected
		}
	});
	async function updateItemState(base: string, newState: ComparisonStatus) {
		console.log(`Updating state for ${base} to ${newState}`);
		try {
			const db = await openDB();
			const tx = db.transaction('stateComparison', 'readwrite');
			const store = tx.objectStore('stateComparison');
			await requestToPromise(store.put({ base: base, state: newState }));
			await transactionComplete(tx); // Ensure transaction completes

			// Update the local state to reflect the change immediately
			// Find the item and update its state
			const itemIndex = allItems.findIndex((item) => item.base === base);
			if (itemIndex !== -1) {
				// Create a new array to trigger reactivity if needed, or directly mutate for $state
				allItems[itemIndex].state = newState;
				// If not using $state runes, you might need: allItems = [...allItems];
			}
			console.log(`State updated successfully for ${base}`);
		} catch (e: any) {
			console.error('Failed to update state in DB:', e);
			error = `Failed to save status change: ${e.message}`;
			// Optionally revert local state change here if DB update fails
		}
	}
	async function openDB(): Promise<IDBDatabase> {
		return new Promise((res, rej) => {
			const req = indexedDB.open('PIBIC', 1);
			req.onerror = () => rej(req.error);
			req.onsuccess = () => res(req.result);
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
	onMount(async () => {
		try {
			const db = await openDB();
			const tx = db.transaction(
				['pythonCode', 'pythonMeta', 'markdown', 'stateComparison'],
				'readonly'
			);

			// Convert IDBRequests to Promises
			const [codes, metas, mds, states] = await Promise.all([
				requestToPromise(tx.objectStore('pythonCode').getAll()),
				requestToPromise(tx.objectStore('pythonMeta').getAll()),
				requestToPromise(tx.objectStore('markdown').getAll()),
				requestToPromise(tx.objectStore('stateComparison').getAll())
			]);

			// combinando por `base`
			const map = new Map<string, any>();
			for (const c of codes) map.set(c.base, { base: c.base, code: c.code });
			for (const m of metas) map.get(m.base).meta = m.meta;
			for (const m of mds) map.get(m.base).md = m.md;
			for (const s of states) map.get(s.base).state = s.state;
			allItems = Array.from(map.values());
		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	});
</script>

{#if loading}
	<p>Carregando arquivos…</p>
{:else if error}
	<p class="error">{error}</p>
{:else if allItems.length > 0}
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
						<CommentSection on:submit={handleCommentSubmit} />
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
	/* ... existing styles for .error etc ... */

	.main-content-grid {
		display: grid;
		/* Define 2 columns for code/diagram, rows will be implicit or defined */
		grid-template-columns: 1fr 1fr;
		/* Define rows explicitly: auto for controls, auto for code/diagram */
		/* grid-template-rows: auto auto; */ /* Often not needed if using grid-column */
		gap: 1rem;
		margin-top: 1rem;
		align-items: start;
	}

	/* Controls section spans both columns */
	.controls-section {
		grid-column: 1 / -1; /* Span from first column line to last */

		/* Keep its internal grid layout */
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1rem;
		align-items: start;
		min-width: 0;
		margin-bottom: 1rem; /* Add space below controls */
	}

	/* Code section goes in the first column (implicitly second row) */
	.code-section {
		grid-column: 1 / 2;
		min-width: 0;
	}

	/* Diagram section goes in the second column (implicitly second row) */
	.diagram-section {
		grid-column: 2 / 3;
		min-width: 0;
	}

	.controls-left {
		display: flex;
		flex-direction: column;
		gap: 1rem; /* Space between file name and comment section */
		min-width: 0; /* Allow shrinking */
	}

	.controls-right {
		min-width: 150px; /* Example: Ensure status buttons have some minimum width */
	}

	/* Responsive design adjustments */
	@media (max-width: 1024px) {
		/* Or your preferred breakpoint */
		.main-content-grid {
			grid-template-columns: 1fr; /* Stack code and diagram below controls */
			/* Rows adjust automatically */
		}
		.controls-section {
			grid-column: 1 / -1; /* Still span full width */
		}
		.code-section {
			grid-column: 1 / -1; /* Take full width */
		}
		.diagram-section {
			grid-column: 1 / -1; /* Take full width */
		}
		/* Optional: Adjust internal controls layout */
		/* .controls-section { grid-template-columns: 1fr; } */
	}

	@media (max-width: 768px) {
		/* Stack inner controls on small screens */
		.controls-section {
			grid-template-columns: 1fr;
		}
		.controls-right {
			min-width: auto; /* Reset min-width */
		}
	}

	.error {
		color: crimson;
	}
</style>
