// Storage for resuming answers. It's read synchronously (for a request header
// and useChat's starting id), so it uses localStorage instead of the app's
// async IndexedDB storage.

const DEVICE_ID_KEY = 'sofos:deviceId';
const ACTIVE_CHAT_ID_KEY = 'sofos:activeChatId';

const randomId = (): string => {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const read = (key: string): string | null => {
	if (typeof window === 'undefined') return null;

	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
};

const write = (key: string, value: string): void => {
	if (typeof window === 'undefined') return;

	try {
		window.localStorage.setItem(key, value);
	} catch {
		// Ignore: storage can be blocked (private mode) or full.
	}
};

const remove = (key: string): void => {
	if (typeof window === 'undefined') return;

	try {
		window.localStorage.removeItem(key);
	} catch {
		// ignore
	}
};

export const newChatId = (): string => randomId();

// Random id for this device; only the device that started an answer can resume it.
export const getOrCreateDeviceId = (): string => {
	let id = read(DEVICE_ID_KEY);

	if (!id) {
		id = randomId();
		write(DEVICE_ID_KEY, id);
	}

	return id;
};

// Id of the chat whose answer is still in progress: set on send, cleared when the
// answer finishes normally, and kept across a reload so it can be resumed.
export const getActiveChatId = (): string | null => read(ACTIVE_CHAT_ID_KEY);
export const setActiveChatId = (chatId: string): void => write(ACTIVE_CHAT_ID_KEY, chatId);
export const clearActiveChatId = (): void => remove(ACTIVE_CHAT_ID_KEY);
