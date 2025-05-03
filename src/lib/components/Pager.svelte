<script lang="ts">
	// Pager.svelte
	// Props: callbacks for prev/next (or null to disable), current page and total pages
	let {
		onPrev = null as (() => void) | null,
		onNext = null as (() => void) | null,
		page = 1,
		totalPages = 1
	} = $props();
</script>

<div class="pager">
	<button onclick={onPrev!} disabled={!onPrev} aria-label="Anterior"> ← Anterior </button>

	<div class="status" aria-live="polite">
		{page} de {totalPages}
	</div>

	<button onclick={onNext!} disabled={!onNext} aria-label="Próximo"> Próximo → </button>
</div>

<style>
	.pager {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.5rem;
	}
	.pager button {
		/* Use similar properties as the base style */
		padding: 0.5rem 1rem; /* Or use var(--button-padding) if :root vars are accessible */
		border: 1px solid #ccc; /* Or var(--button-border) */
		background-color: #f0f0f0; /* Or var(--button-bg) */
		border-radius: 4px; /* Or var(--button-radius) */
		color: #333; /* Or var(--button-text-color) */
		font-size: 0.9rem; /* Or var(--button-font-size) */
		cursor: pointer; /* Or var(--button-cursor) */
		transition: background-color 0.2s;
	}
	.pager button:hover:not(:disabled) {
		background-color: #e0e0e0; /* Or var(--button-bg-hover) */
	}
	.pager button:disabled {
		opacity: 0.6; /* Or var(--button-opacity-disabled) */
		cursor: not-allowed; /* Or var(--button-cursor-disabled) */
	}
	.status {
		text-align: center;
		font-weight: bold;
	}
</style>
