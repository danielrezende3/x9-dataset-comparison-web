<script lang="ts">
	import Highlight, { LineNumbers } from 'svelte-highlight';
	import python from 'svelte-highlight/languages/python';
	import tomorrow from 'svelte-highlight/styles/atom-one-dark';

	let { code }: { code: string } = $props();

	let fontSize = $state(14);

	function increaseFontSize() {
		if (fontSize < 24) fontSize += 2;
	}

	function decreaseFontSize() {
		if (fontSize > 10) fontSize -= 2;
	}
</script>

<svelte:head>
	{@html tomorrow}
</svelte:head>

<div class="code-wrapper">
	<div class="highlight-container" style="font-size: {fontSize}px;">
		<Highlight {code} language={python} let:highlighted>
			<LineNumbers {highlighted} hideBorder />
		</Highlight>
	</div>

	<div class="controls">
		<button class="control-button" onclick={decreaseFontSize} aria-label="Decrease font size">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M8 12h8"></path>
			</svg>
		</button>
		<button class="control-button" onclick={increaseFontSize} aria-label="Increase font size">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M12 8v8"></path>
				<path d="M8 12h8"></path>
			</svg>
		</button>
	</div>
</div>

<style>
	.code-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.highlight-container {
		width: 100%;
		overflow: auto;
		border-radius: 4px;
	}

	.controls {
		position: absolute;
		top: 25px;
		right: 10px;
		display: flex;
		gap: 5px;
		z-index: 10;
	}

	.control-button {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: white;
		border: 1px solid #ccc;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}
</style>
