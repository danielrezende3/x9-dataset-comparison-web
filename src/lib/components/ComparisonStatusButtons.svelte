<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { FilterOptions } from '$lib/types/filterOptions';

	type ComparisonStatus = Exclude<FilterOptions, 'all'>;

	// Use 'export let' for props in Svelte components
	export let selectedStatus: ComparisonStatus = 'not-compared';

	const dispatch = createEventDispatcher<{ changeStatus: ComparisonStatus }>();

	const statuses: ComparisonStatus[] = ['not-compared', 'equal', 'different']; // Or your actual statuses

	function selectStatus(status: ComparisonStatus) {
		if (status !== selectedStatus) {
			// Dispatch an event instead of modifying a bound prop
			dispatch('changeStatus', status);
		}
	}
</script>

<div class="status-buttons">
	{#each statuses as status}
		<button class:selected={selectedStatus === status} on:click={() => selectStatus(status)}>
			{status}
		</button>
	{/each}
</div>

<style>
	.status-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	button {
		padding: 0.5rem;
		border: 1px solid #ccc;
		background-color: #f0f0f0;
		cursor: pointer;
		text-align: center;
	}
	button.selected {
		background-color: #d0d0ff;
		border-color: #a0a0ff;
		font-weight: bold;
	}
	button:hover {
		background-color: #e0e0e0;
	}
	button.selected:hover {
		background-color: #c0c0ee;
	}
</style>
