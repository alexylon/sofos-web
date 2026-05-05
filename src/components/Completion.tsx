import React from "react";
import { Grid, Box, Chip, Card, useTheme } from "@mui/material";
import MarkdownText from "@/components/MarkdownText";
import { CopyToClipboardButton } from '@/components/CopyToClipboardButton';
import { UIMessage } from '@ai-sdk/react'
import PulsingDotSVG from '@/components/PulsingDotSVG';
import { ChatStatus } from 'ai';
import { useThemeMode } from '@/theme/ThemeProvider';
import { themeColors } from '@/theme/theme';
import { Status } from '@/types/types';


interface CompletionProps {
	messages?: UIMessage[],
	messagesEndRef: React.RefObject<HTMLDivElement>,
	scrollContainerRef: React.RefObject<HTMLDivElement>,
	status:  ChatStatus,
	error?: Error,
}

const getMessageReasoningPartTextTitle = (messageReasoningPartText: string) => {
	const firstLine = messageReasoningPartText && messageReasoningPartText?.split("\n")[0];
	const match = firstLine?.match(/\*\*(.*?)\*\*/);
	return match ? `${match[1]}...` : "";
}

export default function Completion({
									   messages,
									   messagesEndRef,
									   scrollContainerRef,
									   status,
									   error
								   }: CompletionProps) {
	const { mode } = useThemeMode();
	const theme = useTheme();
	const colors = themeColors[mode];
	const lastUserMessageRef = React.useRef<HTMLDivElement>(null);

	// Scroll last user message to top when user sends a message
	React.useEffect(() => {
		if (messages && messages.length > 0 && messages[messages.length - 1].role === 'user') {
			setTimeout(() => {
				const scrollContainer = scrollContainerRef.current;
				const lastUserMessage = lastUserMessageRef.current;

				if (scrollContainer && lastUserMessage) {
					// Get the position of the message relative to the scroll container
					const containerRect = scrollContainer.getBoundingClientRect();
					const messageRect = lastUserMessage.getBoundingClientRect();

					// Calculate the scroll position to put the message at the top
					const scrollOffset = scrollContainer.scrollTop + (messageRect.top - containerRect.top);

					scrollContainer.scrollTo({ top: scrollOffset, behavior: 'smooth' });
				}
			}, 100);
		}
	}, [messages, scrollContainerRef]);

	return (
		<div style={{ minHeight: '100%', paddingBottom: '70vh' }}>
			{messages?.map((message: UIMessage, index: number) => {
				const isUserMessage = message.role === 'user';
				const messageTextParts = message.parts.filter((part) => part.type === 'text');
			const messageTextPart = messageTextParts.length > 0
				? { type: 'text' as const, text: messageTextParts.map((p) => p.text).join('') }
				: undefined;
				const messageReasoningPart = [...message.parts].reverse().find((part) =>
					part.type === 'reasoning' && part.text && getMessageReasoningPartTextTitle(part.text)
				);
				// @ts-ignore
				const messageReasoningPartTextTitle = getMessageReasoningPartTextTitle(messageReasoningPart?.text);
				const isLastMessage = index === messages.length - 1;
				const isLastUserMessage = isUserMessage && isLastMessage;
				const isLoading = status === Status.SUBMITTED || status === Status.STREAMING;
				const isStreamingThisMessage = !isUserMessage && isLastMessage && status !== 'ready';

				return (
					<div
						key={message.id}
						data-role={message.role}
						ref={isLastUserMessage ? lastUserMessageRef : null}
					>
							{isUserMessage
								?
								<Grid item xs={12} sx={{paddingLeft: '25%'}}>
									<Box sx={{
										borderRadius: theme.shape.borderRadius,
										mt: 1,
										pb: 1,
										pl: 2,
										pr: 2,
										mb: 1,
										color: colors.userText,
										backgroundColor: colors.userMessage,
									}}
									>
										<Box sx={{
													display: 'flex',
													justifyContent: 'flex-end',
													height: '40px',
													mr: 0,
													pt: 2,
												}}
												>
													{messageTextPart &&
														<Box sx={{ display: 'flex', justifyContent: 'flex-end', mr: -1, mt: '5px' }}>
															<CopyToClipboardButton
																value={messageTextPart.text || ''}
															/>
														</Box>
													}
												</Box>
												<Box sx={{
													mt: -2,
												}}
												>
													<>
														{messageTextPart &&
															<MarkdownText>
															  {messageTextPart.text || ''}
															</MarkdownText>
														}
														{message?.parts
															?.filter((attachment: any) =>
																attachment.type === 'file' && attachment?.mediaType?.startsWith('image/'),
															)
															.map((attachment: any, index: number) => (
																<Card
																	key={`${message.id}-image-${index}`}
																	sx={{
																		maxHeight: 200,
																		borderRadius: theme.shape.borderRadius,
																		mr: 2,
																		mb: 1,
																		display: 'inline-block',
																		overflow: 'hidden',
																	}}
																>
																	<Box
																		component="img"
																		sx={{
																			maxHeight: 200,
																			width: 'auto',
																			height: 'auto',
																			maxWidth: {
																				xs: 350, // On extra-small devices
																				sm: 1280, // On small devices and up
																			},
																		}}
																		alt={attachment.name ?? `attachment-${index}`}
																		src={attachment.url}
																	/>
																</Card>
															))}
														<Box sx={{ display: 'flex', flexDirection: 'row' }}>
															{message?.parts
																?.filter((attachment: any) =>
																	attachment.type === 'file' && !attachment?.mediaType?.startsWith('image/'),
																)
																.map((attachment: any, index: number) => (
																	<Box key={`${message.id}-file-${index}`} sx={{ display: 'flex' }}>
																		<Card
																			sx={{
																				maxWidth: 300,
																				height: 35,
																				position: 'relative',
																				display: 'flex',
																				alignItems: 'center',
																				paddingRight: '10px',
																				mr: 1,
																				mb: 1,
																				backgroundColor: colors.attachmentBackground,
																				borderRadius: theme.shape.borderRadius,
																			}}
																		>
																			<Box
																				sx={{
																					overflow: 'hidden',
																					textOverflow: 'ellipsis',
																					whiteSpace: 'nowrap',
																					ml: 1,
																					color: '#707070',
																				}}
																			>
																				{attachment.name}
																			</Box>
																		</Card>
																	</Box>
																))}
														</Box>
													</>
												</Box>
											</Box>
										</Grid>
										:
										<Grid item xs={12}>
											<Box sx={{
												borderRadius: theme.shape.borderRadius,
												pb: 1,
												pl: 2,
												pr: 2,
												mt: 1,
												mb: 1,
												backgroundColor: colors.assistantMessage,
											}}>
												<Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', height: '10px', pt: 2 }}>
													<Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
														{// @ts-ignore
															message?.modelId &&
															<Chip
															  // @ts-ignore
																label={message.modelId}
																variant="outlined"
																size="small"
																sx={{ fontSize: '0.70rem' }}
															/>
														}
														{messageReasoningPartTextTitle && isLoading && (
															<Box sx={{
																fontSize: '0.85em',
																color: colors.userText,
																fontStyle: 'italic',
																opacity: 0.6,
																marginLeft: '10px',
																marginTop: '1px',
															}}>
																{messageReasoningPartTextTitle}
															</Box>
														)}
													</Box>
													{// @ts-ignore
														messageTextPart && message?.modelId &&
														<Box sx={{ display: 'flex', justifyContent: 'flex-end', mr: -1, mt: '5px' }}>
															<CopyToClipboardButton value={messageTextPart.text || ''} />
														</Box>
													}
												</Box>
												<Box sx={{
													pt: 3,
													pb: 0,
													minHeight: '50px',
												}}
												>
													{messageTextPart?.text
														?
														<MarkdownText>
															{`${messageTextPart.text}${isStreamingThisMessage ? '●' : ''}`}
														</MarkdownText>
														:
														isStreamingThisMessage
															?
															<Box sx={{
																mt: '15px',
															}}
															>
																<PulsingDotSVG />
															</Box>
															:
															<Box sx={{
																mt: '15px',
																color: '#555555',
															}}
															>
																No response
															</Box>
													}
												</Box>
											</Box>
										</Grid>
									}
					</div>
				)
			})}
			{
				error && (
						<Grid item xs={12}>
							<Box sx={{
								borderRadius: theme.shape.borderRadius,
								pb: 1,
								pl: 2,
								pr: 2,
								mt: 1,
								mb: 1,
								backgroundColor: colors.errorMessage,
							}}>
								<Box sx={{
									pt: 2,
									pb: 1,
								}}
								>
									{error.toString()}
								</Box>
							</Box>
						</Grid>
					)
				}
			<div ref={messagesEndRef} />
		</div>
	)
}
