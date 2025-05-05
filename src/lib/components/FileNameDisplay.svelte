<script lang="ts">
	// expose both `fileName` (read-only) and `filter` (two-way)
	let { fileName = 'N/A', filter = $bindable() }: { fileName: string; filter: string } = $props();

	let segments = $derived(
		!filter
			? [{ text: fileName, match: false }]
			: fileName
					.split(new RegExp(`(${filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
					.map((seg) => ({ text: seg, match: seg.toLowerCase() === filter.toLowerCase() }))
	);
</script>

<div class="file-name-container">
	<!-- Container that holds both the highlight layer and the real input -->
	<div class="highlight-wrapper">
		<!-- The styled text, sits underneath -->
		<div class="highlight-text" aria-hidden="true">
			{#each segments as { text, match }, i}
				<span style="opacity: {match ? 0.5 : 1};">{text}</span>
			{/each}
		</div>

		<!-- The real input, transparent text so you see the highlight layer -->
		<input
			type="text"
			bind:value={filter}
			placeholder={fileName}
			aria-label="Filter by file name"
			class="transparent-input"
		/>
	</div>
</div>

<style>
	.file-name-container {
		margin-bottom: 1rem;
	}

	.highlight-wrapper {
		position: relative;
		width: 100%;
	}

	/* The layer that shows your matched/unmatched styling */
	.highlight-text {
		position: absolute;
		top: 0;
		left: 0;
		/* match font / padding of your input exactly */
		width: 100%;
		padding: 0.5rem;
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
		white-space: pre; /* preserves spaces */
		pointer-events: none; /* clicks go through to input */
		color: #000; /* input text color fallback */
		text-align: center
	}

	/* The real input on top */
	.transparent-input {
		position: relative;
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		background: transparent;
		color: transparent; /* hide real text */
		caret-color: black; /* show caret */
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
		box-sizing: border-box;
		text-align: center
	}

	.transparent-input::selection {
		background: rgba(0, 122, 204, 0.3); /* match your focus color */
	}

	.transparent-input:focus {
		outline: 2px solid #007acc;
	}
</style>
