<script lang="ts">
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
		padding: 0.5rem 1rem;
		border: 1px solid #ccc;
		background-color: #f0f0f0;
		border-radius: 4px;
		color: #333;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.pager button:hover:not(:disabled) {
		background-color: #e0e0e0;
	}
	.pager button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.status {
		text-align: center;
		font-weight: bold;
	}
</style>
