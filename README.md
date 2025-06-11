# Code Comparison Tool

This is a web-based tool built with SvelteKit to facilitate the comparison of related code snippets, metadata, and Mermaid diagrams extracted from a ZIP archive. It allows users to review items, mark their comparison status (equal, different, not-compared), add comments, and export/import this review data.

## Features

- **ZIP Upload:** Upload a single ZIP file containing sets of `.[py|c]`, and `.[py|c].svg` files.
- **Data Storage:** Uses IndexedDB to store file contents and comparison data locally in the browser.
- **Comparison Interface:** Displays Python code (with syntax highlighting), a Mermaid diagram (with pan/zoom), and allows users to:
  - Navigate between items using pagination.
  - Filter items by comparison status (`all`, `not-compared`, `equal`, `different`).
  - Set the comparison status for each item.
  - Add and save comments for each item.
- **Data Export/Import:** Export the current comparison status and comments to a CSV file, and import data from a previously exported CSV to update the status and comments.
- **State Persistence:** Comparison status and comments are saved in the browser's IndexedDB and persist across sessions until the database is cleared (e.g., by uploading a new ZIP).

## Setup and Running

1.  **Clone the repository (if applicable):**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or pnpm install or yarn install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    This will start the application, typically available at `http://localhost:5173`.

## Usage

1.  **Prepare your ZIP file:** Ensure your ZIP file contains sets of files named like `basename.[py|c]` and `basename.[py|c].svg` for each item you want to compare. See the "ZIP File Structure" section below.
2.  **Upload:** Open the application in your browser. Drag and drop the ZIP file onto the upload area on the main page, or click to select the file. Uploading a new ZIP will clear any existing data.
3.  **Compare:** After successful processing, you'll be redirected to the `/files` page.
    - Use the filter buttons to view specific subsets of items.
    - Use the pager (`← Anterior`, `Próximo →`) to navigate between items.
    - Review the code and diagram displayed.
    - Select the appropriate comparison status (`not-compared`, `equal`, `different`) using the buttons on the right. The status is saved automatically.
    - Add comments in the text area below the filename. Comments are saved automatically when the text area loses focus.
4.  **Export (Optional):** Click "Exportar csv" to download a CSV file containing the `base` name, `state`, and `comment` for all items.
5.  **Import (Optional):** Click "Importar csv" to upload a previously exported CSV file. This will update the status and comments in the application based on the CSV content, matching items by the `base` name. Only items present in both the current dataset and the CSV will be updated.

## Building for Production

To create a production version of the app:

```bash
npm run build
```

## Tech Stack

- SvelteKit (with Svelte 5 Runes)
- TypeScript
- IndexedDB (for local storage)
- JSZip (for handling ZIP files)
- Mermaid (for rendering diagrams)
- Panzoom (for diagram interaction)
- svelte-highlight (for code syntax highlighting)
- Vite
