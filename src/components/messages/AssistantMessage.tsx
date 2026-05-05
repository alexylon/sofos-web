import { Box, Chip, Grid, useTheme } from '@mui/material';
import type { UIMessage } from '@ai-sdk/react';
import MarkdownText from '@/components/MarkdownText';
import { CopyToClipboardButton } from '@/components/CopyToClipboardButton';
import PulsingDotSVG from '@/components/PulsingDotSVG';
import { useThemeMode } from '@/theme/ThemeProvider';
import { themeColors } from '@/theme/theme';
import { StoredUIMessage } from '@/types/types';
import {
	getMessageText,
	getReasoningTitleFromMessage,
} from '@/components/messages/messageParts';

const ASSISTANT_MIN_HEIGHT_PX = 50;
const STREAMING_DOT = '●';

interface AssistantMessageProps {
	message: UIMessage;
	isLoading: boolean;
	isStreamingThisMessage: boolean;
}

export const AssistantMessage = ({ message, isLoading, isStreamingThisMessage }: AssistantMessageProps) => {
	const { mode } = useThemeMode();
	const theme = useTheme();
	const colors = themeColors[mode];

	const text = getMessageText(message.parts);
	const reasoningTitle = getReasoningTitleFromMessage(message.parts);
	const modelId = (message as StoredUIMessage).modelId;

	return (
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
						{modelId && (
							<Chip
								label={modelId}
								variant="outlined"
								size="small"
								sx={{ fontSize: '0.70rem' }}
							/>
						)}
						{reasoningTitle && isLoading && (
							<Box sx={{
								fontSize: '0.85em',
								color: colors.userText,
								fontStyle: 'italic',
								opacity: 0.6,
								marginLeft: '10px',
								marginTop: '1px',
							}}>
								{reasoningTitle}
							</Box>
						)}
					</Box>
					{text && modelId && (
						<Box sx={{ display: 'flex', justifyContent: 'flex-end', mr: -1, mt: '5px' }}>
							<CopyToClipboardButton value={text} />
						</Box>
					)}
				</Box>
				<Box sx={{ pt: 3, pb: 0, minHeight: `${ASSISTANT_MIN_HEIGHT_PX}px` }}>
					{text
						? (
							<MarkdownText>
								{`${text}${isStreamingThisMessage ? STREAMING_DOT : ''}`}
							</MarkdownText>
						)
						: isStreamingThisMessage
							? (
								<Box sx={{ mt: '15px' }}>
									<PulsingDotSVG />
								</Box>
							)
							: (
								<Box sx={{ mt: '15px', color: '#555555' }}>
									No response
								</Box>
							)
					}
				</Box>
			</Box>
		</Grid>
	);
};
