'use client';

import { Drawer, IconButton, Typography, useTheme } from '@mui/material';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import List from '@mui/material/List';
import Divider from '@mui/material/Divider';
import { styled } from '@mui/material/styles';
import { signOut } from 'next-auth/react';
import ClearIcon from '@mui/icons-material/Clear';
import Box from '@mui/material/Box';
import {
	ICON_SIZE_SM,
	MAX_PERSISTED_CHATS,
	models,
} from '@/components/utils/constants';
import { saveCurrentChatIndex, saveModel } from '@/components/utils/storage';
import { clearActiveChatId } from '@/components/utils/resumeStorage';
import { useChatContext } from '@/context/ChatContext';
import { StoredUIMessage } from '@/types/types';

const DrawerHeader = styled('div')(({ theme }) => ({
	display: 'flex',
	alignItems: 'center',
	...theme.mixins.toolbar,
	justifyContent: 'center',
}));

const formattedDate = (dateString: Date | string | undefined): string => {
	if (!dateString) {
		return 'No Messages';
	}

	const date = new Date(dateString);
	const now = new Date();
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);

	const isToday = date.toDateString() === now.toDateString();
	const isYesterday = date.toDateString() === yesterday.toDateString();

	const timeString = date.toLocaleTimeString('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});

	if (isToday) return `Today ${timeString}`;
	if (isYesterday) return `Yesterday ${timeString}`;

	return date.toLocaleString('en-GB', {
		day: '2-digit',
		month: '2-digit',
		year: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	}).replace(/\//g, '.');
};

const drawerWidth = 200;

const SideBar = () => {
	const theme = useTheme();
	const chatListBackground = theme.palette.background.paper;

	const {
		chatHistory,
		currentChatIndex,
		open,
		setMessages,
		setChatHistory,
		setCurrentChatIndex,
		setModel,
		handleStartNewChat,
		saveChatHistory,
	} = useChatContext();

	const handleSelectChat = (chatIndex: number) => {
		// Switching chats abandons any in-flight turn, so it shouldn't resume here.
		clearActiveChatId();
		setMessages(chatHistory[chatIndex]);
		setCurrentChatIndex(chatIndex);
		saveCurrentChatIndex(chatIndex);

		const lastMessage = chatHistory[chatIndex]?.at(-1) as StoredUIMessage | undefined;
		const storedModelValue = lastMessage?.name;
		const storedModel = storedModelValue
			? models.find(model => model.value === storedModelValue)
			: undefined;

		if (storedModel) {
			setModel(storedModel);
			saveModel(storedModel.value);
		}
	};

	const handleRemoveChat = (index: number) => {
		const updatedChats = chatHistory.filter((_, i) => i !== index);

		setChatHistory(updatedChats);
		void saveChatHistory(updatedChats);

		if (index === currentChatIndex) {
			handleStartNewChat();
		}

		if (index < currentChatIndex) {
			setCurrentChatIndex(currentChatIndex - 1);
			saveCurrentChatIndex(currentChatIndex - 1);
		}
	};

	return (
		<Drawer
			sx={{
				width: drawerWidth,
				flexShrink: 0,
				'& .MuiDrawer-paper': {
					width: drawerWidth,
					boxSizing: 'border-box',
					backgroundColor: theme.palette.background.paper,
				},
			}}
			variant="persistent"
			anchor="left"
			open={open}
		>
			<DrawerHeader>
				<Typography
					align="center"
					fontWeight="bold"
					color={theme.palette.text.secondary}
				>
					Last {MAX_PERSISTED_CHATS} Chats
				</Typography>
			</DrawerHeader>
			<Divider />
			<List>
				{chatHistory.slice().reverse().map((chat, index) => {
					const chatIndex = chatHistory.length - 1 - index;
					const isSelected = chatIndex === currentChatIndex;
					const lastMessage = chat?.at(-1) as StoredUIMessage | undefined;
					const primary = chat && chat.length > 0
						? formattedDate(lastMessage?.createdAt)
						: 'No Messages';

					return (
						<div key={index}>
							<ListItem disablePadding>
								<ListItemButton
									onClick={(e) => {
										e.preventDefault();
										handleSelectChat(chatIndex);
									}}
									sx={{
										height: '34px',
										backgroundColor: isSelected
											? theme.palette.secondary.main
											: chatListBackground,
									}}
								>
									<ListItemText
										primary={primary}
										sx={{ color: theme.palette.text.secondary }}
									/>
								</ListItemButton>
								<IconButton
									sx={{
										position: 'absolute',
										right: 4,
										height: ICON_SIZE_SM,
										width: ICON_SIZE_SM,
									}}
									onClick={() => handleRemoveChat(chatIndex)}
								>
									<ClearIcon sx={{ height: ICON_SIZE_SM, width: ICON_SIZE_SM, color: theme.palette.text.secondary, backgroundColor: 'transparent' }} />
								</IconButton>
							</ListItem>
						</div>
					);
				})}
			</List>
			<Box sx={{ flexGrow: 1 }} />
			<Divider />
			<List>
				<ListItem key="logout" disablePadding>
					<ListItemButton
						onClick={(e) => {
							e.preventDefault();
							signOut().then();
						}}
					>
						<ListItemIcon>
							<LogoutOutlinedIcon
								sx={{ height: ICON_SIZE_SM, width: ICON_SIZE_SM, color: theme.palette.text.secondary, backgroundColor: theme.palette.background.paper }}
							/>
						</ListItemIcon>
						<ListItemText primary="Log Out" sx={{ color: theme.palette.text.secondary }} />
					</ListItemButton>
				</ListItem>
			</List>
		</Drawer>
	);
};

export default SideBar;
