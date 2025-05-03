<script lang="ts">
	import type { FilterOptions } from '$lib/types/filterOptions';

	let { selectedFilter = $bindable() } = $props();

	const filters: { value: FilterOptions; label: string }[] = [
		{ value: 'all', label: 'Todos' },
		{ value: 'not-compared', label: 'Não comparado' },
		{ value: 'equal', label: 'Igual' },
		{ value: 'different', label: 'Diferente' }
	];

	// This function would typically emit an event or update a bound prop
	function selectFilter(filter: FilterOptions) {
		selectedFilter = filter;
		// TODO: Add logic to notify the parent component about the change
		console.log('Selected filter:', selectedFilter);
	}
</script>

<div class="filter-container">
	<span class="filter-label">Filtrar por:</span>
	<div class="button-group">
		{#each filters as filter}
			<button
				class="filter-button"
				class:active={selectedFilter === filter.value}
				onclick={() => selectFilter(filter.value)}
				aria-pressed={selectedFilter === filter.value}
			>
				{filter.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.filter-container {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem; /* Add some space below */
	}

	.filter-label {
		font-weight: bold;
	}

	.button-group {
		display: flex;
		gap: 0.3rem; /* Small gap between buttons */
	}

	.filter-button {
		padding: 0.5rem 1rem; /* Standard padding */
		border: 1px solid #ccc; /* Standard border */
		background-color: #f0f0f0; /* Standard background */
		border-radius: 4px; /* Standard radius */
		cursor: pointer;
		font-size: 0.9rem; /* Standard font size */
		transition:
			background-color 0.2s,
			border-color 0.2s;
		color: #333; /* Standard text color */
	}

	.filter-button:hover {
		background-color: #e0e0e0; /* Standard hover */
	}

	.filter-button.active {
		background-color: #d0d0d0; /* Keep active distinct */
		border-color: #aaa; /* Adjust active border */
		font-weight: bold;
	}

	/* Basic responsiveness */
	@media (max-width: 600px) {
		.filter-container {
			flex-direction: column;
			align-items: flex-start;
		}
		.button-group {
			flex-wrap: wrap; /* Allow buttons to wrap on small screens */
			margin-top: 0.5rem;
		}
		.filter-button {
			margin-bottom: 0.3rem; /* Add space when wrapped */
		}
	}
</style>
