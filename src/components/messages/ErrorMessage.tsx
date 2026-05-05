import { Box, Grid, useTheme } from '@mui/material';
import { useThemeMode } from '@/theme/ThemeProvider';
import { themeColors } from '@/theme/theme';

interface ErrorMessageProps {
	error: Error;
}

export const ErrorMessage = ({ error }: ErrorMessageProps) => {
	const { mode } = useThemeMode();
	const theme = useTheme();
	const colors = themeColors[mode];

	return (
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
				<Box sx={{ pt: 2, pb: 1 }}>
					{error.toString()}
				</Box>
			</Box>
		</Grid>
	);
};
