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
		padding: 0.75rem 1rem; /* Slightly larger padding */
		border: 2px solid #555;
		background-color: #f0f0f0;
		border-radius: 8px;
		cursor: pointer;
		font-size: 1rem; /* Slightly larger font */
		transition:
			background-color 0.2s,
			border-color 0.2s;
		color: #333;
		text-align: center;
		width: 100%; /* Make buttons fill container width */
	}

	.status-button:hover {
		background-color: #e0e0e0;
	}

	.status-button.active {
		background-color: #d0d0d0;
		border-color: #333;
		font-weight: bold;
	}
</style>
