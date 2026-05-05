import { useMediaQuery } from 'react-responsive';
import { AppBar, Box, Button, Grid, IconButton, Toolbar } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MapsUgcOutlinedIcon from '@mui/icons-material/MapsUgcOutlined';
import { signIn, useSession } from 'next-auth/react';
import SelectSmall from '@/components/SelectSmall';
import SideBar from '@/components/SideBar';
import { useChatContext } from '@/context/ChatContext';
import { ICON_SIZE_SM, models, textVerbosities } from '@/components/utils/constants';

const SMALL_SCREEN_BREAKPOINT_PX = 420;

export default function HeaderAppBar() {
	const { data: session, status } = useSession();
	const loading = status === 'loading';
	const user = session?.user;
	const isSmallScreen = useMediaQuery({ maxWidth: SMALL_SCREEN_BREAKPOINT_PX });

	const {
		model,
		reasoningEffort,
		textVerbosity,
		updatedReasoningEfforts,
		open,
		isDisabled,
		isLoading,
		handleModelChange,
		handleReasoningEffortChange,
		handleTextVerbosityChange,
		handleDrawerOpen,
		handleStartNewChat,
	} = useChatContext();

	const selectMargin = (small: string, regular: string) =>
		({ marginRight: isSmallScreen ? small : regular });

	return (
		<>
			<Grid container spacing={2} sx={{ position: 'fixed', top: 15, zIndex: 10 }}>
				<Box sx={{ flexGrow: 1 }}>
					<AppBar position="static">
						<Toolbar variant="dense">
							{user
								? (
									<>
										<IconButton
											color="inherit"
											disabled={isLoading}
											aria-label="open drawer"
											onClick={(e) => {
												e.stopPropagation();
												if (!isLoading) handleDrawerOpen();
											}}
											sx={[
												{
													[isSmallScreen ? 'ml' : 'mr']: isSmallScreen ? -1 : 1,
													cursor: isLoading ? 'default' : 'pointer',
												},
												open && { display: 'none' },
											]}
										>
											<MenuIcon />
										</IconButton>
										<SelectSmall
											options={models}
											handleChange={handleModelChange}
											value={model.value}
											style={selectMargin('0', '7px')}
											disabled={isDisabled}
										/>
										<SelectSmall
											options={updatedReasoningEfforts}
											handleChange={handleReasoningEffortChange}
											value={reasoningEffort}
											style={selectMargin('0', '7px')}
											disabled={isDisabled}
										/>
										{model.value.startsWith('gpt-5') &&
											<SelectSmall
												options={textVerbosities}
												handleChange={handleTextVerbosityChange}
												value={textVerbosity}
												style={selectMargin('-7px', '3px')}
												disabled={isDisabled}
											/>
										}
										<Box sx={{
											ml: 'auto',
											display: 'flex',
											...(isSmallScreen && { mr: -1 }),
										}}>
											<IconButton onClick={() => handleStartNewChat()}>
												<MapsUgcOutlinedIcon
													sx={{
														height: ICON_SIZE_SM,
														width: ICON_SIZE_SM,
														color: 'white',
													}}
												/>
											</IconButton>
										</Box>
									</>
								)
								: (
									<Box sx={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
										<Button color="inherit" onClick={(e) => {
											e.preventDefault();
											signIn().then();
										}}>
											Login
										</Button>
									</Box>
								)}
						</Toolbar>
					</AppBar>
					{user && <SideBar />}
				</Box>
			</Grid>
			<div>{!user && loading ? 'loading...' : ''}</div>
		</>
	);
}
