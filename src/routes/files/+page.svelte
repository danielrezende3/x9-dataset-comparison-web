<script lang="ts">
	import { onMount } from 'svelte';
	import Pager from '$lib/components/Pager.svelte';
	import CodeHighlighter from '$lib/components/CodeHighlighter.svelte';
	import PanZoomMermaid from '$lib/components/PanZoomMermaid.svelte';

	let items: Array<{
		base: string;
		code: string;
		meta: any;
		md: string;
	}> = $state([]);
	let loading = $state(true);
	let error = $state('');
	let page = $state(1);
	let totalPages = $derived(items.length);
	let current = $derived(items[page - 1] ?? null);

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

	onMount(async () => {
		try {
			const db = await openDB();
			const tx = db.transaction(['pythonCode', 'pythonMeta', 'markdown'], 'readonly');

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
			items = Array.from(map.values());
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
{:else if current}
	<Pager
		{page}
		{totalPages}
		onPrev={page > 1 ? () => page-- : null}
		onNext={page < totalPages ? () => page++ : null}
	/>

	<div class="content-container">
		<div class="code-section">
			<CodeHighlighter code={current.code} />
		</div>
		<div class="diagram-section">
			{console.log(current.md)}
			<PanZoomMermaid diagram={current.md} />
		</div>
	</div>
{:else}
	<p>Nenhum item para exibir.</p>
{/if}

<style>
	.content-container {
		display: flex;
		flex-direction: row;
		gap: 1rem;
		margin-top: 1rem;
	}

	.code-section {
		flex: 1;
		min-width: 0; /* Important for proper flex behavior */
	}

	.diagram-section {
		flex: 1;
		min-width: 0; /* Important for proper flex behavior */
	}

	/* Responsive design for mobile */
	@media (max-width: 768px) {
		.content-container {
			flex-direction: column;
		}
	}

	.file-card {
		border: 1px solid #ccc;
		padding: 1rem;
		margin: 1rem 0;
	}

	.error {
		color: crimson;
	}
</style>
