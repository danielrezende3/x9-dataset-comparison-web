<script lang="ts">
	import Highlight from 'svelte-highlight';
	import python from 'svelte-highlight/languages/python';
	import tomorrow from 'svelte-highlight/styles/atom-one-dark';
	// Destructure props to receive `code` from parent components
	let { code }: { code: string } = $props();
</script>

<svelte:head>
	{@html tomorrow}
</svelte:head>

<!-- Render the provided `code` string with syntax highlighting -->
<Highlight {code} language={python} />
