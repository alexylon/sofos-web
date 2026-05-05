'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useChat, UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { SelectChangeEvent } from '@mui/material/Select';
import { Model, ReasoningEffort, ReasoningEffortValue, Status, TextVerbosityValue } from '@/types/types';
import { useFileUploads } from '@/context/useFileUploads';
import { useModelSettings } from '@/context/useModelSettings';
import { useChatPersistence } from '@/context/useChatPersistence';

const STREAM_THROTTLE_MS = 100;
const SCROLL_BOTTOM_OFFSET_RATIO = 0.6;

interface ChatContextType {
	model: Model;
	reasoningEffort: ReasoningEffortValue;
	textVerbosity: TextVerbosityValue;
	images: File[];
	files: File[];
	chatHistory: UIMessage[][];
	currentChatIndex: number;
	open: boolean;
	input: string;
	messages: UIMessage[];
	status: string;
	error?: Error;
	isLoading: boolean;
	isDisabled: boolean;
	hasImages: boolean;
	hasFiles: boolean;
	updatedReasoningEfforts: ReasoningEffort[];
	messagesEndRef: React.RefObject<HTMLDivElement>;
	scrollContainerRef: React.RefObject<HTMLDivElement>;

	setModel: React.Dispatch<React.SetStateAction<Model>>;
	setMessages: (messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])) => void;
	setChatHistory: React.Dispatch<React.SetStateAction<UIMessage[][]>>;
	setCurrentChatIndex: React.Dispatch<React.SetStateAction<number>>;
	setInput: React.Dispatch<React.SetStateAction<string>>;

	handleModelChange: (event: SelectChangeEvent<string | number>) => void;
	handleReasoningEffortChange: (event: SelectChangeEvent<string | number>) => void;
	handleTextVerbosityChange: (event: SelectChangeEvent<string | number>) => void;
	handleDrawerOpen: () => void;
	handleDrawerClose: () => void;
	handleStartNewChat: () => void;
	handleFilesChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
	handleRemoveImage: (index: number) => void;
	handleRemoveFile: (index: number) => void;
	onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
	scrollToBottom: () => void;
	saveChatHistory: (history: UIMessage[][]) => void;

	regenerate: () => void;
	stop: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
	const context = useContext(ChatContext);
	if (!context) {
		throw new Error('useChatContext must be used within ChatProvider');
	}
	return context;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const fileUploads = useFileUploads();
	const modelSettings = useModelSettings();

	const [open, setOpen] = useState(false);
	const [input, setInput] = useState('');
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	const {
		status,
		messages,
		sendMessage,
		setMessages,
		regenerate,
		stop,
		error,
	} = useChat({
		transport: new DefaultChatTransport({ api: '/api/use-stream-text' }),
		onFinish: ({ message }) => persistence.onFinishCallback(message),
		experimental_throttle: STREAM_THROTTLE_MS,
	});

	const persistence = useChatPersistence({
		error,
		setMessages,
		setModel: modelSettings.setModel,
		setReasoningEffort: modelSettings.setReasoningEffort,
		setTextVerbosity: modelSettings.setTextVerbosity,
	});

	const isLoading = status === Status.SUBMITTED || status === Status.STREAMING;
	const isDisabled = isLoading || !!error;

	const handleDrawerOpen = useCallback(() => setOpen(true), []);
	const handleDrawerClose = useCallback(() => setOpen(false), []);

	const scrollToBottom = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		const offsetHeight = (typeof window !== 'undefined' ? window.innerHeight : 0) * SCROLL_BOTTOM_OFFSET_RATIO;
		container.scrollTo({
			top: container.scrollHeight - container.clientHeight - offsetHeight,
			behavior: 'smooth',
		});
	}, []);

	const { images, files, setImages, setFiles } = fileUploads;
	const { model, reasoningEffort, textVerbosity } = modelSettings;

	const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		const allFiles = [...images, ...files];
		const dataTransfer = new DataTransfer();
		allFiles.forEach(file => dataTransfer.items.add(file));
		const fileList = dataTransfer.files;

		const messageOptions = {
			body: { model, reasoningEffort, textVerbosity },
		};

		const messageData = fileList?.length > 0
			? { text: input, files: fileList }
			: { text: input };

		sendMessage(messageData, messageOptions).then();
		setInput('');
		setImages([]);
		setFiles([]);
	}, [input, images, files, model, reasoningEffort, textVerbosity, sendMessage, setImages, setFiles]);

	const value: ChatContextType = {
		model: modelSettings.model,
		reasoningEffort: modelSettings.reasoningEffort,
		textVerbosity: modelSettings.textVerbosity,
		images: fileUploads.images,
		files: fileUploads.files,
		chatHistory: persistence.chatHistory,
		currentChatIndex: persistence.currentChatIndex,
		open,
		input,
		messages,
		status,
		error,
		isLoading,
		isDisabled,
		hasImages: fileUploads.hasImages,
		hasFiles: fileUploads.hasFiles,
		updatedReasoningEfforts: modelSettings.updatedReasoningEfforts,
		messagesEndRef,
		scrollContainerRef,
		setModel: modelSettings.setModel,
		setMessages,
		setChatHistory: persistence.setChatHistory,
		setCurrentChatIndex: persistence.setCurrentChatIndex,
		setInput,
		handleModelChange: modelSettings.handleModelChange,
		handleReasoningEffortChange: modelSettings.handleReasoningEffortChange,
		handleTextVerbosityChange: modelSettings.handleTextVerbosityChange,
		handleDrawerOpen,
		handleDrawerClose,
		handleStartNewChat: persistence.handleStartNewChat,
		handleFilesChange: fileUploads.handleFilesChange,
		handleRemoveImage: fileUploads.handleRemoveImage,
		handleRemoveFile: fileUploads.handleRemoveFile,
		onSubmit,
		scrollToBottom,
		saveChatHistory: persistence.saveChatHistory,
		regenerate,
		stop,
	};

	return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
