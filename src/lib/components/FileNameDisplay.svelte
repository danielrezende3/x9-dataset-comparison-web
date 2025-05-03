<script lang="ts">
	let { fileName = 'N/A' }: { fileName: string } = $props();
</script>

<div class="file-name-container">
	<span>{fileName}</span>
</div>

<style>
	.file-name-container {
		border: 1px solid #ccc;
		padding: 1rem;
		margin-bottom: 1rem; /* Add space below */
		border-radius: 4px;
		background-color: #f9f9f9;
		font-weight: bold;
		text-align: center;
	}
</style>
