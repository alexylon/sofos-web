import { Box, Grid, Typography } from '@mui/material';
import Completion from '@/components/Completion';
import { useChatContext } from '@/context/ChatContext';
import { ChatStatus } from 'ai';

const MessagesContainer = () => {
	const {
		messages,
		messagesEndRef,
		scrollContainerRef,
		status,
		error,
		hasFiles,
		hasImages,
	} = useChatContext();

	const hasAttachments = hasFiles || hasImages;

	return (
		<Grid
			className="messages-container"
			container
			sx={{
				width: '100%',
			}}
		>
			<Grid
				ref={scrollContainerRef}
				id="messages-scroll-container"
				item xs={12}
				sx={{
					height: hasAttachments
						? {
							xs: 'calc(85vh - 138px)',
							sm: 'calc(90vh - 142px)',
						}
						: {
							xs: 'calc(85vh - 62px)',
							sm: 'calc(90vh - 65px)',
						},
					overflow: 'auto',
					width: '100%',
					'&::-webkit-scrollbar': {
						display: 'none',
					},
					scrollbarWidth: 'none',
					msOverflowStyle: 'none',
				}}
			>
				{messages.length
					?
					<Box sx={{
						p: 1,
						flex: 1,
					}}>
						<Completion
							messages={messages}
							messagesEndRef={messagesEndRef}
							scrollContainerRef={scrollContainerRef}
							status={status as ChatStatus}
							error={error}
						/>
					</Box>
					:
					<Box sx={{
						mt: 25,
					}}>
						<Typography
							variant="h2"
							component="h2"
							color="#D1D5DB"
							align="center"
							fontWeight="bold"
							sx={{
								userSelect: 'none',
							}}
						>
							sofos
						</Typography>
					</Box>
				}
			</Grid>
		</Grid>
	);
};

export default MessagesContainer;
