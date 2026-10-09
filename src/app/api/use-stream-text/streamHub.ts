import { randomUUID } from 'crypto';
import type { UIMessageChunk } from 'ai';

// On iOS, putting the PWA in the background drops its connection, which used to
// cut the answer off with an error. So the server keeps generating on its own:
// POST stores the output per chat as it arrives, and GET replays it and then
// continues live when the app reconnects. Entries are temporary, belong to one
// device and live only in memory, so a restart loses them; chat history itself
// stays in the browser.

export interface GenerationHandle {
	chatId: string;
	generationId: string;
}

interface HubEntry {
	generationId: string;
	deviceId: string;
	chunks: UIMessageChunk[];
	done: boolean;
	listeners: Set<(chunk: UIMessageChunk | null) => void>;
	evictTimer?: ReturnType<typeof setTimeout>;
	createdAt: number;
}

const RESUME_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 50;

// Kept on globalThis so hot reloading in development doesn't reset it.
const globalForHub = globalThis as unknown as { __sofosStreamHub?: Map<string, HubEntry> };
const store: Map<string, HubEntry> = globalForHub.__sofosStreamHub ?? (globalForHub.__sofosStreamHub = new Map());

const evictIfNeeded = (): void => {
	if (store.size <= MAX_ENTRIES) return;

	let oldestKey: string | undefined;
	let oldestAt = Infinity;

	store.forEach((entry, key) => {
		if (entry.createdAt < oldestAt) {
			oldestAt = entry.createdAt;
			oldestKey = key;
		}
	});

	if (oldestKey) {
		const entry = store.get(oldestKey);
		if (entry?.evictTimer) clearTimeout(entry.evictTimer);
		store.delete(oldestKey);
	}
};

// A new answer replaces any earlier entry for the chat. Each entry gets its own
// id, so output still arriving for the replaced answer can't write into or end
// the new one.
export const registerGeneration = (chatId: string, deviceId: string): GenerationHandle => {
	const existing = store.get(chatId);
	if (existing?.evictTimer) clearTimeout(existing.evictTimer);
	if (existing) {
		existing.done = true;
		existing.listeners.forEach(listener => listener(null));
		existing.listeners.clear();
	}

	const generationId = randomUUID();

	store.set(chatId, {
		generationId,
		deviceId,
		chunks: [],
		done: false,
		listeners: new Set(),
		createdAt: Date.now(),
	});

	evictIfNeeded();
	return { chatId, generationId };
};

const getCurrentEntry = (handle: GenerationHandle): HubEntry | undefined => {
	const entry = store.get(handle.chatId);
	return entry?.generationId === handle.generationId ? entry : undefined;
};

export const publishChunk = (handle: GenerationHandle, chunk: UIMessageChunk): void => {
	const entry = getCurrentEntry(handle);
	if (!entry) return;
	entry.chunks.push(chunk);
	entry.listeners.forEach(listener => listener(chunk));
};

export const finishGeneration = (handle: GenerationHandle): void => {
	const entry = getCurrentEntry(handle);
	if (!entry) return;
	entry.done = true;
	entry.listeners.forEach(listener => listener(null));
	entry.listeners.clear();
	entry.evictTimer = setTimeout(() => store.delete(handle.chatId), RESUME_TTL_MS);
};

// Replays what was saved, then continues live until the answer is done. Returns
// null if there is nothing to resume or the answer belongs to another device.
export const subscribe = (chatId: string, deviceId: string): ReadableStream<UIMessageChunk> | null => {
	const entry = store.get(chatId);
	if (!entry || entry.deviceId !== deviceId) return null;

	let listener: ((chunk: UIMessageChunk | null) => void) | undefined;

	return new ReadableStream<UIMessageChunk>({
		start(controller) {
			for (const chunk of entry.chunks) {
				try {
					controller.enqueue(chunk);
				} catch {
					return; // consumer already gone
				}
			}

			if (entry.done) {
				try { controller.close(); } catch { /* already closed */ }
				return;
			}

			listener = (chunk) => {
				if (chunk === null) {
					try { controller.close(); } catch { /* already closed */ }
				} else {
					try { controller.enqueue(chunk); } catch { /* closed */ }
				}
			};

			entry.listeners.add(listener);
		},
		cancel() {
			if (listener) entry.listeners.delete(listener);
		},
	});
};
