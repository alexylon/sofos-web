import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UIMessage } from '@ai-sdk/react';
import { MAX_PERSISTED_CHATS, models } from '@/components/utils/constants';
import {
	loadPersistedState,
	saveChatHistoryToStorage,
	saveCurrentChatIndex,
	sanitizeChatHistory,
} from '@/components/utils/storage';
import { clearActiveChatId } from '@/components/utils/resumeStorage';
import {
	Model,
	ReasoningEffortValue,
	StoredUIMessage,
	TextVerbosityValue,
} from '@/types/types';

const NEW_CHAT_INDEX = -1;

export interface FinishFlags {
	isAbort?: boolean;
	isDisconnect?: boolean;
	isError?: boolean;
}

export interface ChatPersistenceApi {
	chatHistory: UIMessage[][];
	currentChatIndex: number;
	isLoaded: boolean;
	setChatHistory: React.Dispatch<React.SetStateAction<UIMessage[][]>>;
	setCurrentChatIndex: React.Dispatch<React.SetStateAction<number>>;
	saveChatHistory: (history: UIMessage[][]) => void;
	handleStartNewChat: () => void;
	persistOptimistic: (messages: UIMessage[]) => void;
	onFinishCallback: (message: UIMessage, flags?: FinishFlags) => void;
}

type SetMessages = (messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])) => void;

interface UseChatPersistenceArgs {
	setMessages: SetMessages;
	setModel: React.Dispatch<React.SetStateAction<Model>>;
	setReasoningEffort: React.Dispatch<React.SetStateAction<ReasoningEffortValue>>;
	setTextVerbosity: React.Dispatch<React.SetStateAction<TextVerbosityValue>>;
}

export const useChatPersistence = ({
	setMessages,
	setModel,
	setReasoningEffort,
	setTextVerbosity,
}: UseChatPersistenceArgs): ChatPersistenceApi => {
	const router = useRouter();
	const [chatHistory, setChatHistory] = useState<UIMessage[][]>([]);
	const [currentChatIndex, setCurrentChatIndex] = useState<number>(NEW_CHAT_INDEX);
	const [isLoaded, setIsLoaded] = useState(false);

	// Mirror so the chatHistory updaters below can read the active index synchronously.
	const currentChatIndexRef = useRef(currentChatIndex);
	useEffect(() => {
		currentChatIndexRef.current = currentChatIndex;
	}, [currentChatIndex]);

	useEffect(() => {
		let isMounted = true;

		const load = async () => {
			try {
				const persisted = await loadPersistedState();

				if (!isMounted) return;

				if (persisted.model) {
					const foundModel = models.find(m => m.value === persisted.model);
					if (foundModel) setModel(foundModel);
				}

				if (persisted.reasoningEffort) {
					setReasoningEffort(persisted.reasoningEffort as ReasoningEffortValue);
				}

				if (persisted.textVerbosity) {
					setTextVerbosity(persisted.textVerbosity as TextVerbosityValue);
				}

				const persistedChatHistory = Array.isArray(persisted.chatHistory) ? persisted.chatHistory : null;
				const persistedCurrentChatIndex = persisted.currentChatIndex !== null
					&& !Number.isNaN(persisted.currentChatIndex)
					? persisted.currentChatIndex
					: null;

				if (!persistedChatHistory || persistedChatHistory.length === 0 || persistedCurrentChatIndex === null) {
					return;
				}

				const normalized = sanitizeChatHistory(persistedChatHistory);
				setCurrentChatIndex(persistedCurrentChatIndex);
				currentChatIndexRef.current = persistedCurrentChatIndex;
				setChatHistory(normalized);

				if (persistedCurrentChatIndex >= 0 && persistedCurrentChatIndex < normalized.length) {
					const persistedMessages = normalized[persistedCurrentChatIndex];
					if (persistedMessages?.length > 0) {
						setMessages(persistedMessages);
					}
				}
			} catch (loadError) {
				console.error('Error loading data from IndexedDB:', loadError);
			} finally {
				if (isMounted) setIsLoaded(true);
			}
		};

		load().catch(loadError => {
			console.error('Unexpected error loading persisted state:', loadError);
		});

		return () => {
			isMounted = false;
		};
	}, [setMessages, setModel, setReasoningEffort, setTextVerbosity]);

	const saveChatHistory = useCallback((history: UIMessage[][]) => {
		void saveChatHistoryToStorage(history);
	}, []);

	// Write the given messages into the active chat slot, creating it for a new
	// chat. Used both when a message is sent and when the answer finishes.
	const writeCurrentChat = useCallback((msgs: UIMessage[]) => {
		if (msgs.length === 0) return;

		// Captured once so the updater stays pure under StrictMode's double-invoke.
		const baseIndex = currentChatIndexRef.current;

		setChatHistory(prevChatHistory => {
			const updated = [...prevChatHistory];
			let index = baseIndex;

			if (index < 0 || index >= updated.length) {
				updated.push(msgs);
				index = updated.length - 1;
			} else {
				updated[index] = msgs;
			}

			const overflow = Math.max(0, updated.length - MAX_PERSISTED_CHATS);
			const final = overflow > 0 ? updated.slice(overflow) : updated;
			const finalIndex = index - overflow;

			if (finalIndex !== baseIndex) {
				currentChatIndexRef.current = finalIndex;
				setCurrentChatIndex(finalIndex);
				saveCurrentChatIndex(finalIndex);
			}

			void saveChatHistoryToStorage(final);
			return final;
		});
	}, []);

	const handleStartNewChat = useCallback(() => {
		setMessages([]);
		setCurrentChatIndex(NEW_CHAT_INDEX);
		currentChatIndexRef.current = NEW_CHAT_INDEX;
		saveCurrentChatIndex(NEW_CHAT_INDEX);
		clearActiveChatId();
		router.push('/new');
	}, [router, setMessages]);

	// Save the sent turn immediately so the user message survives a reload while
	// the answer is still generating.
	const persistOptimistic = useCallback((msgs: UIMessage[]) => {
		if (msgs.length === 0) return;
		const last = msgs[msgs.length - 1] as StoredUIMessage;
		if (!last.createdAt) last.createdAt = new Date();
		writeCurrentChat(msgs);
	}, [writeCurrentChat]);

	const onFinishCallback = useCallback((message: UIMessage, flags?: FinishFlags) => {
		// A dropped connection, hard error, or abandoned chat switch leaves a partial
		// message; keep the slot at the user message so the turn can resume or be
		// abandoned without corrupting another selected chat.
		if (flags?.isAbort || flags?.isDisconnect || flags?.isError) return;

		const stored = message as StoredUIMessage;
		stored.createdAt = new Date();
		setModel(prevModel => {
			stored.modelId = prevModel.label;
			return prevModel;
		});

		setMessages((prevMessages: UIMessage[]): UIMessage[] => {
			if (prevMessages.length === 0) return prevMessages;
			const updatedMessages = [...prevMessages];
			updatedMessages[updatedMessages.length - 1] = message;
			writeCurrentChat(updatedMessages);
			return updatedMessages;
		});
	}, [setMessages, setModel, writeCurrentChat]);

	return {
		chatHistory,
		currentChatIndex,
		isLoaded,
		setChatHistory,
		setCurrentChatIndex,
		saveChatHistory,
		handleStartNewChat,
		persistOptimistic,
		onFinishCallback,
	};
};
