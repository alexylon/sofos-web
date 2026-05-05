import { useEffect, useRef } from 'react';
import { UIMessage } from '@ai-sdk/react';
import { ChatStatus } from 'ai';
import { Status } from '@/types/types';
import { INPUT_FOCUS_DELAY_MS } from '@/components/utils/constants';
import { UserMessage } from '@/components/messages/UserMessage';
import { AssistantMessage } from '@/components/messages/AssistantMessage';
import { ErrorMessage } from '@/components/messages/ErrorMessage';

interface CompletionProps {
	messages?: UIMessage[];
	messagesEndRef: React.RefObject<HTMLDivElement>;
	scrollContainerRef: React.RefObject<HTMLDivElement>;
	status: ChatStatus;
	error?: Error;
}

export default function Completion({
	messages,
	messagesEndRef,
	scrollContainerRef,
	status,
	error,
}: CompletionProps) {
	const lastUserMessageRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!messages?.length) return;
		if (messages[messages.length - 1].role !== 'user') return;

		const id = setTimeout(() => {
			const scrollContainer = scrollContainerRef.current;
			const lastUserMessage = lastUserMessageRef.current;

			if (!scrollContainer || !lastUserMessage) return;

			const containerRect = scrollContainer.getBoundingClientRect();
			const messageRect = lastUserMessage.getBoundingClientRect();
			const scrollOffset = scrollContainer.scrollTop + (messageRect.top - containerRect.top);

			scrollContainer.scrollTo({ top: scrollOffset, behavior: 'smooth' });
		}, INPUT_FOCUS_DELAY_MS);

		return () => clearTimeout(id);
	}, [messages, scrollContainerRef]);

	const isLoading = status === Status.SUBMITTED || status === Status.STREAMING;

	return (
		<div style={{ minHeight: '100%', paddingBottom: '70vh' }}>
			{messages?.map((message, index) => {
				const isLastMessage = index === messages.length - 1;
				const isUserMessage = message.role === 'user';
				const isLastUserMessage = isUserMessage && isLastMessage;
				const isStreamingThisMessage = !isUserMessage && isLastMessage && status !== Status.READY;

				return (
					<div
						key={message.id}
						data-role={message.role}
						ref={isLastUserMessage ? lastUserMessageRef : null}
					>
						{isUserMessage
							? <UserMessage message={message} />
							: (
								<AssistantMessage
									message={message}
									isLoading={isLoading}
									isStreamingThisMessage={isStreamingThisMessage}
								/>
							)
						}
					</div>
				);
			})}
			{error && <ErrorMessage error={error} />}
			<div ref={messagesEndRef} />
		</div>
	);
}
