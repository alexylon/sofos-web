import { Box, Card, Grid, useTheme } from '@mui/material';
import type { UIMessage } from '@ai-sdk/react';
import MarkdownText from '@/components/MarkdownText';
import { CopyToClipboardButton } from '@/components/CopyToClipboardButton';
import { useThemeMode } from '@/theme/ThemeProvider';
import { themeColors } from '@/theme/theme';
import { getFileAttachments, getImageAttachments, getMessageText } from '@/components/messages/messageParts';

const IMAGE_MAX_HEIGHT = 200;
const FILE_CARD_HEIGHT = 35;
const FILE_CARD_MAX_WIDTH = 300;

interface UserMessageProps {
	message: UIMessage;
}

export const UserMessage = ({ message }: UserMessageProps) => {
	const { mode } = useThemeMode();
	const theme = useTheme();
	const colors = themeColors[mode];

	const text = getMessageText(message.parts);
	const imageAttachments = getImageAttachments(message.parts);
	const fileAttachments = getFileAttachments(message.parts);

	return (
		<Grid item xs={12} sx={{ paddingLeft: '25%' }}>
			<Box sx={{
				borderRadius: theme.shape.borderRadius,
				mt: 1,
				pb: 1,
				pl: 2,
				pr: 2,
				mb: 1,
				color: colors.userText,
				backgroundColor: colors.userMessage,
			}}>
				<Box sx={{
					display: 'flex',
					justifyContent: 'flex-end',
					height: '40px',
					mr: 0,
					pt: 2,
				}}>
					{text && (
						<Box sx={{ display: 'flex', justifyContent: 'flex-end', mr: -1, mt: '5px' }}>
							<CopyToClipboardButton value={text} />
						</Box>
					)}
				</Box>
				<Box sx={{ mt: -2 }}>
					{text && <MarkdownText>{text}</MarkdownText>}
					{imageAttachments.map((attachment, index) => (
						<Card
							key={`${message.id}-image-${index}`}
							sx={{
								maxHeight: IMAGE_MAX_HEIGHT,
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
									maxHeight: IMAGE_MAX_HEIGHT,
									width: 'auto',
									height: 'auto',
									maxWidth: { xs: 350, sm: 1280 },
								}}
								alt={attachment.name ?? `attachment-${index}`}
								src={attachment.url}
							/>
						</Card>
					))}
					<Box sx={{ display: 'flex', flexDirection: 'row' }}>
						{fileAttachments.map((attachment, index) => (
							<Box key={`${message.id}-file-${index}`} sx={{ display: 'flex' }}>
								<Card sx={{
									maxWidth: FILE_CARD_MAX_WIDTH,
									height: FILE_CARD_HEIGHT,
									position: 'relative',
									display: 'flex',
									alignItems: 'center',
									paddingRight: '10px',
									mr: 1,
									mb: 1,
									backgroundColor: colors.attachmentBackground,
									borderRadius: theme.shape.borderRadius,
								}}>
									<Box sx={{
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										whiteSpace: 'nowrap',
										ml: 1,
										color: '#707070',
									}}>
										{attachment.name}
									</Box>
								</Card>
							</Box>
						))}
					</Box>
				</Box>
			</Box>
		</Grid>
	);
};
