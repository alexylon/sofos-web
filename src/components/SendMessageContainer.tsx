import React, { useEffect, useRef } from 'react';
import { Box, Grid, IconButton, InputAdornment, TextField, useTheme } from '@mui/material';
import { TextareaAutosize } from '@mui/base';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import ArrowCircleUpOutlinedIcon from '@mui/icons-material/ArrowCircleUpOutlined';
import { styled } from '@mui/material/styles';
import AttachmentsContainer from '@/components/AttachmentsContainer';
import AudioRecorder from '@/components/AudioRecorder';
import ActionButton from '@/components/ActionButton';
import { useMediaQuery } from 'react-responsive';
import { useThemeMode } from '@/theme/ThemeProvider';
import { themeColors } from '@/theme/theme';
import { useChatContext } from '@/context/ChatContext';
import { ICON_SIZE_MD, ICON_SIZE_SM, INPUT_FOCUS_DELAY_MS } from '@/components/utils/constants';
import { isIOSSafari, isPWA } from '@/components/utils/platform';

const VisuallyHiddenInput = styled('input')({
	clip: 'rect(0 0 0 0)',
	clipPath: 'inset(50%)',
	height: 1,
	overflow: 'hidden',
	position: 'absolute',
	bottom: 0,
	left: 0,
	whiteSpace: 'nowrap',
	width: 1,
});

const FILE_INPUT_ID = 'file-input';

const SendMessageContainer: React.FC = () => {
	const inputRef = useRef<HTMLInputElement>(null);
	const isMobile = useMediaQuery({ maxWidth: 767 });
	const { mode } = useThemeMode();
	const theme = useTheme();
	const colors = themeColors[mode];

	const {
		hasImages,
		hasFiles,
		images,
		files,
		isDisabled,
		input,
		isLoading,
		messages,
		setInput,
		handleRemoveImage,
		handleRemoveFile,
		onSubmit,
		handleFilesChange,
		regenerate,
		stop,
	} = useChatContext();

	useEffect(() => {
		if (isLoading || !inputRef.current || isMobile) return;

		const element = inputRef.current;
		const timeout = setTimeout(() => {
			element.focus();
		}, INPUT_FOCUS_DELAY_MS);

		return () => clearTimeout(timeout);
	}, [isLoading, isMobile]);

	const handleButtonClick = () => {
		document.getElementById(FILE_INPUT_ID)?.click();
	};

	const handleTranscriptionResult = (text: string) => {
		try {
			const newText = input + (input ? ' ' : '') + text;
			setInput(newText);

			if (!(isIOSSafari() || isPWA()) || !inputRef.current) return;

			try {
				inputRef.current.focus();
			} catch (focusError) {
				console.warn('Could not focus input:', focusError);
			}

			inputRef.current.value = newText;
			inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
			inputRef.current.dispatchEvent(new Event('change', { bubbles: true }));

			const nativeSetter = Object.getOwnPropertyDescriptor(
				window.HTMLTextAreaElement.prototype,
				'value',
			)?.set;

			if (nativeSetter) {
				nativeSetter.call(inputRef.current, newText);
				inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
			}
		} catch (error) {
			console.error('Error in handleTranscriptionResult:', error);
		}
	};

	const handleTranscriptionError = (error: string) => {
		console.error('Transcription error:', error);
	};

	const handleSendClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		if (input?.trim()) onSubmit(event as unknown as React.FormEvent<HTMLFormElement>);
	};

	return (
		<Grid className="send-message-container" container sx={{ width: '100%', backgroundColor: 'transparent' }}>
			<Box sx={{ position: 'absolute', bottom: -8, left: 0, right: 0, backgroundColor: 'transparent' }}>
				<Grid item xs={12}>
					<Box sx={{ p: 1 }}>
						<AttachmentsContainer
							hasImages={hasImages}
							hasFiles={hasFiles}
							images={images}
							files={files}
							handleRemoveImage={handleRemoveImage}
							handleRemoveFile={handleRemoveFile}
						/>
						<TextField
							inputRef={inputRef}
							fullWidth
							id="user-input"
							label={!isDisabled && !input ? 'Send a message...' : ''}
							multiline
							disabled={isDisabled}
							size="small"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							variant="outlined"
							InputLabelProps={{
								shrink: false,
								sx: {
									marginLeft: '30px',
									display: 'flex',
									alignItems: 'center',
									height: '70%',
									'&.Mui-focused': { color: '#7d7d7d' },
								},
							}}
							InputProps={{
								inputComponent: TextareaAutosize,
								inputProps: {
									minRows: 1,
									maxRows: 10,
									style: { resize: 'none', fontFamily: "'SF Pro Text BG', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
									onKeyDown: (event) => {
										if (event.key === 'Enter' && !event.shiftKey) {
											event.preventDefault();
											if (!input?.trim()) return;
											onSubmit(event as unknown as React.FormEvent<HTMLFormElement>);
										}
									},
									onWheel: (event) => event.stopPropagation(),
								},
								startAdornment: !isDisabled && (
									<IconButton edge="start" onClick={handleButtonClick} disabled={false}>
										<AddCircleOutlineOutlinedIcon sx={{ height: ICON_SIZE_SM, width: ICON_SIZE_SM, color: theme.palette.text.secondary }} />
										<VisuallyHiddenInput
											id={FILE_INPUT_ID}
											type="file"
											onChange={handleFilesChange}
											multiple
										/>
									</IconButton>
								),
								endAdornment: (
									<InputAdornment position="end">
										{!isDisabled && (
											<>
												<AudioRecorder
													disabled={isDisabled}
													onTranscriptionResult={handleTranscriptionResult}
													onError={handleTranscriptionError}
												/>
												<IconButton
													edge="end"
													color="primary"
													disabled={isDisabled || !input}
													onClick={handleSendClick}
												>
													<ArrowCircleUpOutlinedIcon
														sx={{
															height: ICON_SIZE_MD,
															width: ICON_SIZE_MD,
														}}
													/>
												</IconButton>
											</>
										)}
										<ActionButton messages={messages} isLoading={isLoading} reload={regenerate} stop={stop} />
									</InputAdornment>
								),
							}}
							sx={{
								borderRadius: theme.shape.borderRadius,
								minHeight: '59px',
								backgroundColor: isDisabled ? colors.inputDisabled : colors.inputBackground,
								'& .MuiOutlinedInput-root': {
									borderRadius: theme.shape.borderRadius,
									minHeight: '59px',
									'&:hover fieldset': { borderRadius: theme.shape.borderRadius, minHeight: '53px' },
									'&.Mui-focused fieldset': { borderRadius: theme.shape.borderRadius, minHeight: '59px' },
								},
							}}
						/>
					</Box>
				</Grid>
			</Box>
		</Grid>
	);
};

export default SendMessageContainer;
