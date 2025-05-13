<script lang="ts">
	import panzoom from 'panzoom';

	// Props
	let { diagram }: { diagram: string } = $props();

	let container: HTMLDivElement;
	let panzoomInstance: any;

	$effect(() => {
		if (container) {
			container.innerHTML = diagram;

			const svgElement = container.querySelector('svg');
			if (svgElement) {
				panzoomInstance = panzoom(svgElement, {
					maxZoom: 5,
					minZoom: 0.5,
					bounds: true,
					boundsPadding: 0.1
				});
			}
		}

		return () => {
			if (panzoomInstance) {
				panzoomInstance.dispose();
			}
		};
	});

	function resetZoom() {
		if (panzoomInstance) {
			panzoomInstance.moveTo(0, 0);
			panzoomInstance.zoomAbs(0, 0, 1);
		}
	}
</script>

<div class="panzoom-wrapper">
	<div class="diagram-container" bind:this={container}></div>
	<button class="reset-button" onclick={resetZoom} aria-label="Reset zoom">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"></path>
			<path d="M17 12H7"></path>
			<path d="M12 17v-10"></path>
		</svg>
	</button>
</div>

<style>
	.panzoom-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.diagram-container {
		width: 100%;
		height: 100%;
		overflow: hidden;
		background-color: white;
		border-radius: 4px;
	}

	.reset-button {
		position: absolute;
		top: 10px;
		right: 10px;
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
