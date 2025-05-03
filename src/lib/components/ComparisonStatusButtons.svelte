<script lang="ts">
	import type { FilterOptions } from '$lib/types/filterOptions'; // Reuse FilterOptions type

	// Use FilterOptions excluding 'all'
	type ComparisonStatus = Exclude<FilterOptions, 'all'>;

	let { selectedStatus = $bindable() }: { selectedStatus: ComparisonStatus } = $props();

	// Define the possible statuses and their labels
	const statuses: { value: ComparisonStatus; label: string }[] = [
		{ value: 'equal', label: 'Igual' },
		{ value: 'not-compared', label: 'Não comparado' },
		{ value: 'different', label: 'Diferente' }
	];

	function selectStatus(status: ComparisonStatus) {
		selectedStatus = status;
		console.log('Selected status:', selectedStatus);
		// Parent component will react via the binding
	}
</script>

<div class="status-buttons-container">
	{#each statuses as status}
		<button
			class="status-button"
			class:active={selectedStatus === status.value}
			onclick={() => selectStatus(status.value)}
			aria-pressed={selectedStatus === status.value}
		>
			{status.label}
		</button>
	{/each}
</div>

<style>
	.status-buttons-container {
		display: flex;
		flex-direction: column; /* Stack buttons vertically */
		gap: 0.5rem;
	}

	.status-button {
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
		text-align: center;
		width: 100%;
	}

	.status-button:hover {
		background-color: #e0e0e0; /* Standard hover */
	}

	.status-button.active {
		background-color: #d0d0d0; /* Keep active distinct */
		border-color: #aaa; /* Adjust active border */
		font-weight: bold;
	}
</style>
