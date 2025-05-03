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
		background: #fff;
		border: 1px solid #ccc;
		padding: 0.5em 1em;
		font: inherit;
		cursor: pointer;
		border-radius: 4px;
	}
	.pager button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.status {
		text-align: center;
		font-weight: bold;
	}
</style>
