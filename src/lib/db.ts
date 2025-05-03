// filepath: src/lib/db.ts
import type { PythonCode } from '$lib/types/pythonCode';
import type { PythonMeta } from '$lib/types/pythonMeta';
import type { Markdown } from '$lib/types/markdown';
import type { stateComparison } from '$lib/types/stateComparison';
import type { FilterOptions } from '$lib/types/filterOptions';

type ComparisonStatus = Exclude<FilterOptions, 'all'>;

interface Comment {
	base: string;
	comment: string;
}

export interface CombinedItem {
	base: string;
	code: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	meta: any;
	md: string;
	state: ComparisonStatus;
	comment: string;
}

const DB_NAME = 'PIBIC';
const DB_VERSION = 1;

export const STORE_NAMES = {
	CODE: 'pythonCode',
	META: 'pythonMeta',
	MARKDOWN: 'markdown',
	STATE: 'stateComparison',
	COMMENTS: 'comments'
} as const;

type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES];

// --- Core DB Functions ---

/**
 * Opens the IndexedDB database.
 * Handles creation and upgrades.
 */
export function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			console.log(`Upgrading database to version ${DB_VERSION}`);
			for (const storeName of Object.values(STORE_NAMES)) {
				if (!db.objectStoreNames.contains(storeName)) {
					db.createObjectStore(storeName, { keyPath: 'base' });
					console.log(`Created object store: ${storeName}`);
				}
			}
		};
	});
}

/**
 * Deletes the entire IndexedDB database.
 */
export function deleteDB(): Promise<void> {
	return new Promise((resolve, reject) => {
		const delReq = indexedDB.deleteDatabase(DB_NAME);
		delReq.onerror = () => reject(delReq.error);
		delReq.onsuccess = () => resolve();
		delReq.onblocked = () => {
			console.warn('Database delete blocked, likely due to open connections.');
			reject(new Error('Database delete blocked. Please close other tabs using the app.'));
		};
	});
}

/**
 * Helper to convert an IDBRequest to a Promise.
 */
export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/**
 * Helper to await the completion of an IDBTransaction.
 */
export function transactionComplete(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
	});
}

// --- Data Access Functions ---

/**
 * Gets a single item from a store by its base key.
 */
async function getItem<T>(storeName: StoreName, base: string): Promise<T | undefined> {
	const db = await openDB();
	const tx = db.transaction(storeName, 'readonly');
	const store = tx.objectStore(storeName);
	return requestToPromise(store.get(base));
}

/**
 * Gets all items from a store.
 */
async function getAllItems<T>(storeName: StoreName): Promise<T[]> {
	const db = await openDB();
	const tx = db.transaction(storeName, 'readonly');
	const store = tx.objectStore(storeName);
	return requestToPromise(store.getAll());
}

/**
 * Adds or updates an item in a store.
 */
async function putItem<T>(storeName: StoreName, item: T): Promise<IDBValidKey> {
	const db = await openDB();
	const tx = db.transaction(storeName, 'readwrite');
	const store = tx.objectStore(storeName);
	const result = await requestToPromise(store.put(item));
	await transactionComplete(tx);
	return result;
}

/**
 * Clears all items from specified stores.
 */
export async function clearStores(storeNames: StoreName[]): Promise<void> {
	const db = await openDB();
	const tx = db.transaction(storeNames, 'readwrite');
	const promises: Promise<any>[] = [];
	for (const storeName of storeNames) {
		promises.push(requestToPromise(tx.objectStore(storeName).clear()));
	}
	promises.push(transactionComplete(tx));
	await Promise.all(promises);
}

// --- Specific CRUD Functions ---

// Python Code
export const getCode = (base: string) => getItem<PythonCode>(STORE_NAMES.CODE, base);
export const getAllCodes = () => getAllItems<PythonCode>(STORE_NAMES.CODE);
export const putCode = (item: PythonCode) => putItem<PythonCode>(STORE_NAMES.CODE, item);

// Python Meta
export const getMeta = (base: string) => getItem<PythonMeta>(STORE_NAMES.META, base);
export const getAllMetas = () => getAllItems<PythonMeta>(STORE_NAMES.META);
export const putMeta = (item: PythonMeta) => putItem<PythonMeta>(STORE_NAMES.META, item);

// Markdown
export const getMarkdown = (base: string) => getItem<Markdown>(STORE_NAMES.MARKDOWN, base);
export const getAllMarkdowns = () => getAllItems<Markdown>(STORE_NAMES.MARKDOWN);
export const putMarkdown = (item: Markdown) => putItem<Markdown>(STORE_NAMES.MARKDOWN, item);

// State Comparison
export const getState = (base: string) => getItem<stateComparison>(STORE_NAMES.STATE, base);
export const getAllStates = () => getAllItems<stateComparison>(STORE_NAMES.STATE);
export const putState = (item: stateComparison) =>
	putItem<stateComparison>(STORE_NAMES.STATE, item);
export const updateState = (base: string, state: ComparisonStatus) => putState({ base, state });

// Comments
export const getComment = (base: string) => getItem<Comment>(STORE_NAMES.COMMENTS, base);
export const getAllComments = () => getAllItems<Comment>(STORE_NAMES.COMMENTS);
export const putComment = (item: Comment) => putItem<Comment>(STORE_NAMES.COMMENTS, item);
export const updateComment = (base: string, comment: string) => putComment({ base, comment });

// --- Combined Operations ---

/**
 * Fetches and combines all data for display on the /files page.
 */
export async function getAllCombinedItems(): Promise<CombinedItem[]> {
	const db = await openDB();
	const tx = db.transaction(Object.values(STORE_NAMES), 'readonly');

	const [codes, metas, mds, states, commentsData] = await Promise.all([
		requestToPromise(tx.objectStore(STORE_NAMES.CODE).getAll()),
		requestToPromise(tx.objectStore(STORE_NAMES.META).getAll()),
		requestToPromise(tx.objectStore(STORE_NAMES.MARKDOWN).getAll()),
		requestToPromise(tx.objectStore(STORE_NAMES.STATE).getAll()),
		requestToPromise(tx.objectStore(STORE_NAMES.COMMENTS).getAll())
	]);
	await transactionComplete(tx); // Ensure transaction is complete before processing

	const map = new Map<string, Partial<CombinedItem>>();

	// Initialize map with code data
	for (const c of codes) {
		map.set(c.base, {
			base: c.base,
			code: c.code,
			state: 'not-compared', // Default state
			comment: '' // Default comment
		});
	}

	// Merge other data
	for (const m of metas) {
		if (map.has(m.base)) map.get(m.base)!.meta = m.meta;
	}
	for (const m of mds) {
		if (map.has(m.base)) map.get(m.base)!.md = m.md;
	}
	for (const s of states) {
		if (map.has(s.base)) map.get(s.base)!.state = s.state;
	}
	for (const c of commentsData) {
		if (map.has(c.base)) map.get(c.base)!.comment = c.comment;
	}

	// Filter out any potentially incomplete entries and ensure all fields are present
	return Array.from(map.values()).filter(
		(item): item is CombinedItem =>
			!!item.base &&
			item.code !== undefined &&
			item.meta !== undefined &&
			item.md !== undefined &&
			item.state !== undefined &&
			item.comment !== undefined
	);
}

/**
 * Deletes the database and reopens it to ensure a clean state with the correct schema.
 */
export async function resetDB(): Promise<IDBDatabase> {
	await deleteDB();
	return openDB(); // openDB handles creation and upgrades
}
