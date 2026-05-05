import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UIMessage } from '@ai-sdk/react';
import { MAX_PERSISTED_CHATS, models } from '@/components/utils/constants';
import {
	loadPersistedState,
	saveChatHistoryToStorage,
	saveCurrentChatIndex,
	sanitizeChatHistory,
} from '@/components/utils/storage';
import {
	Model,
	ReasoningEffortValue,
	StoredUIMessage,
	TextVerbosityValue,
} from '@/types/types';

const NEW_CHAT_INDEX = -1;
const NEW_CHAT_PREV_LENGTH = 2;

export interface ChatPersistenceApi {
	chatHistory: UIMessage[][];
	currentChatIndex: number;
	setChatHistory: React.Dispatch<React.SetStateAction<UIMessage[][]>>;
	setCurrentChatIndex: React.Dispatch<React.SetStateAction<number>>;
	saveChatHistory: (history: UIMessage[][]) => void;
	handleStartNewChat: () => void;
	onFinishCallback: (message: UIMessage) => void;
}

type SetMessages = (messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])) => void;

interface UseChatPersistenceArgs {
	error?: Error;
	setMessages: SetMessages;
	setModel: React.Dispatch<React.SetStateAction<Model>>;
	setReasoningEffort: React.Dispatch<React.SetStateAction<ReasoningEffortValue>>;
	setTextVerbosity: React.Dispatch<React.SetStateAction<TextVerbosityValue>>;
}

export const useChatPersistence = ({
	error,
	setMessages,
	setModel,
	setReasoningEffort,
	setTextVerbosity,
}: UseChatPersistenceArgs): ChatPersistenceApi => {
	const router = useRouter();
	const [chatHistory, setChatHistory] = useState<UIMessage[][]>([]);
	const [currentChatIndex, setCurrentChatIndex] = useState<number>(NEW_CHAT_INDEX);

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
				setChatHistory(normalized);

				if (persistedCurrentChatIndex >= 0 && persistedCurrentChatIndex < normalized.length) {
					const persistedMessages = normalized[persistedCurrentChatIndex];
					if (persistedMessages?.length > 0) {
						setMessages(persistedMessages);
					}
				}
			} catch (loadError) {
				console.error('Error loading data from IndexedDB:', loadError);
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

	const handleStartNewChat = useCallback(() => {
		setMessages([]);
		setCurrentChatIndex(NEW_CHAT_INDEX);
		saveCurrentChatIndex(NEW_CHAT_INDEX);
		router.push('/new');
	}, [router, setMessages]);

	const onFinishCallback = useCallback((message: UIMessage) => {
		if (error) return;

		const stored = message as StoredUIMessage;
		stored.createdAt = new Date();

		setModel(prevModel => {
			stored.modelId = prevModel.label;
			return prevModel;
		});

		setMessages((prevMessages: UIMessage[]): UIMessage[] => {
			const isNewChat = prevMessages.length <= NEW_CHAT_PREV_LENGTH;
			const updatedMessages: UIMessage[] = [...prevMessages];
			updatedMessages[updatedMessages.length - 1] = message;

			if (updatedMessages.length === 0) return updatedMessages;

			setChatHistory(prevChatHistory => {
				if (isNewChat) {
					setCurrentChatIndex(prevChatHistory.length);
					saveCurrentChatIndex(prevChatHistory.length);
				}

				const updated = [...prevChatHistory];

				if (isNewChat || prevChatHistory.length === 0) {
					updated.push(updatedMessages);
				} else {
					updated[updated.length - 1] = updatedMessages;
				}

				const final = updated.slice(-MAX_PERSISTED_CHATS);
				void saveChatHistoryToStorage(final);
				return final;
			});

			return updatedMessages;
		});
	}, [error, setMessages, setModel]);

	return {
		chatHistory,
		currentChatIndex,
		setChatHistory,
		setCurrentChatIndex,
		saveChatHistory,
		handleStartNewChat,
		onFinishCallback,
	};
};
