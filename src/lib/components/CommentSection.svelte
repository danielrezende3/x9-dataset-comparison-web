<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    let comment = $state('');
    const dispatch = createEventDispatcher<{ submit: string }>();

    function handleSubmit() {
        if (comment.trim()) {
            dispatch('submit', comment);
            // Optionally clear the comment after submit:
            // comment = '';
        }
    }
</script>

<div class="comment-section">
    <textarea bind:value={comment} placeholder="Comentário" aria-label="Comentário"></textarea>
    <button onclick={handleSubmit}>Enviar</button>
</div>

<style>
    .comment-section {
        border: 1px solid #ccc;
        padding: 1rem;
        margin-bottom: 1rem; /* Add space below */
        border-radius: 4px;
        background-color: #f9f9f9;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    textarea {
        width: 100%;
        min-height: 80px;
        padding: 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-family: inherit;
        resize: vertical; /* Allow vertical resizing */
        box-sizing: border-box; /* Include padding and border in element's total width and height */
    }

    button {
        align-self: flex-end; /* Align button to the right */
        padding: 0.5rem 1rem;
        border: 1px solid #ccc;
        background-color: #eee;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    button:hover {
        background-color: #ddd;
    }
</style>